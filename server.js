// 1. KÖRNYEZETI VÁLTOZÓK BETÖLTÉSE
require('dotenv').config({ path: require('path').resolve(__dirname, 'api.env') });

const express = require("express");
const cors = require("cors");
const path = require("path");
const { createClient } = require('@supabase/supabase-js');
const fetch = require("node-fetch");
const http = require('http');
const { Server } = require('socket.io');

// 1. ELŐSZÖR létrehozzuk az express app-ot!
const app = express(); 

// 2. MOST már átadhatjuk az app-ot a szervernek, mert már létezik
const server = http.createServer(app);

// 3. Végül inicializáljuk a socketet a szerveren
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]}});

// 2. INICIALIZÁLÁS
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname)));

// 3. SUPABASE KLÍENS LÉTREHOZÁSA (A process.env-ből, amit a Render-en megadtál)
const supabase = createClient(
    process.env.SUPABASE_URL, 
    process.env.SUPABASE_KEY
);

// API Kulcsok a környezeti változókból
const FOOTBALL_DATA_API_KEY = process.env.FOOTBALL_DATA_API_KEY;
const ODDS_API_KEY = process.env.ODDS_API_KEY;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const stripe = require('stripe')(STRIPE_SECRET_KEY);

// --- MEMÓRIA TÁROLÓK (CACHE) ---
let matchCache = { data: null, lastFetch: 0 };
let oddsCache = { data: null, lastFetch: 0 };
let standingsCache = {};

// --- SUPABASE EGYENLEG API (USER BALANCES) ---

app.get('/api/user/balance', async (req, res) => {
    try {
        const userId = req.query.userId;
        if (!userId) return res.status(400).json({ error: "No UserID" });

        let { data, error } = await supabase
            .from('user_balances')
            .select('balance')
            .eq('user_id', userId)
            .single();

        // Ha nincs még ilyen user az adatbázisban, létrehozzuk 1000 Ft-tal
        if (error && (error.code === 'PGRST116' || error.message.includes("0 rows"))) {
            const { data: newUser, error: insertError } = await supabase
                .from('user_balances')
                .insert({ user_id: userId, balance: 1000 })
                .select()
                .single();

            if (insertError) throw insertError;
            return res.json({ balance: 1000 });
        }

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error("Balance fetch error:", err);
        res.status(500).json({ error: "Adatbázis hiba" });
    }
});

app.post('/api/user/update-balance', async (req, res) => {
    try {
        const { userId, balance, bet } = req.body;
        if (!userId) return res.status(400).json({ error: "No UserID" });

        // 1. Egyenleg frissítése a Supabase-ben
        const { error: balanceError } = await supabase
            .from('user_balances')
            .update({ balance: balance })
            .eq('user_id', userId);

        if (balanceError) throw balanceError;

        // 2. HA VAN FOGADÁS (bet objektum), MENTJÜK A 'bets' TÁBLÁBA
        if (bet) {
            const { error: betError } = await supabase
                .from('bets')
                .insert([{ 
                    user_id: userId, 
                    match_id: String(bet.matchId), 
                    team_name: bet.teamName,
                    amount: bet.amount,
                    odds: bet.odds,
                    type: bet.type,
                    status: 'OPEN'
                }]);

            if (betError) console.error("Supabase mentési hiba (bets):", betError);
        }

        res.json({ success: true, newBalance: balance });
    } catch (err) {
        console.error("Balance update error:", err);
        res.status(500).json({ error: "Frissítés sikertelen" });
    }
});

app.get('/api/user/bets', async (req, res) => {
    try {
        const userId = req.query.userId;
        if (!userId) return res.status(400).json({ error: "No UserID" });

        const { data, error } = await supabase
            .from('bets')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error("Hiba a fogadások lekérésekor:", err);
        res.status(500).json({ error: "Szerver hiba" });
    }
});

// --- 2. Admin: Eredmények ellenőrzése és kifizetése ---
app.post('/api/admin/check-results', async (req, res) => {
    console.log("Admin: Ellenőrzés indul...");
    try {
        // Csak az OPEN státuszúakat nézzük meg
        const { data: pendingBets, error: fetchError } = await supabase
            .from('bets')
            .select('*')
            .eq('status', 'OPEN');

        if (fetchError) throw fetchError;

        if (!pendingBets || pendingBets.length === 0) {
            return res.json({ success: true, message: "Nincs feldolgozandó fogadás." });
        }

        for (let bet of pendingBets) {
            const apiRes = await fetch(`https://api.football-data.org/v4/matches/${bet.match_id}`, {
                headers: { 'X-Auth-Token': process.env.FOOTBALL_API_KEY }
            });
            const match = await apiRes.json();

            if (match.status === 'FINISHED') {
                const homeScore = match.score.fullTime.home;
                const awayScore = match.score.fullTime.away;
                let actualResult = (homeScore > awayScore) ? 'H' : (homeScore < awayScore ? 'V' : 'D');

                if (bet.type === actualResult) {
                    const winAmount = Math.floor(bet.amount * bet.odds);

                    // SQL RPC hívás a pénz jóváírásához
                    await supabase.rpc('settle_winning_bet', { 
                        u_id: bet.user_id, 
                        win_amount: winAmount 
                    });

                    await supabase.from('bets').update({ status: 'WON' }).eq('id', bet.id);
                } else {
                    await supabase.from('bets').update({ status: 'LOST' }).eq('id', bet.id);
                }
            }
            // API limit védelem
            await new Promise(r => setTimeout(r, 500));
        }

        res.json({ success: true, message: "Fogadások frissítve!" });
    } catch (err) {
        console.error("Admin hiba:", err);
        res.status(500).json({ error: err.message });
    }
});

// --- FOOTBALL DATA API VÉGPONTOK ---

app.get("/live-matches", async (req, res) => {
    const now = Date.now();
    if (matchCache.data && (now - matchCache.lastFetch < 30000)) return res.json(matchCache.data);

    try {
        const d = new Date();
        const from = new Date(d); from.setDate(d.getDate() - 3);
        const to = new Date(d); to.setDate(d.getDate() + 3);
        const fromStr = from.toISOString().split('T')[0];
        const toStr = to.toISOString().split('T')[0];

        const response = await fetch(`https://api.football-data.org/v4/matches?dateFrom=${fromStr}&dateTo=${toStr}`, { 
            headers: { "X-Auth-Token": FOOTBALL_DATA_API_KEY, "Accept-Encoding": "identity" } 
        });

        if (!response.ok) throw new Error(`API hiba: ${response.status}`);
        const data = await response.json();

        matchCache.data = data;
        matchCache.lastFetch = now;
        res.json(data);
    } catch (error) {
        if (matchCache.data) res.json(matchCache.data);
        else res.status(502).json({ error: "API elérhetetlen" });
    }
});

app.get('/api/live-ticker', async (req, res) => {
    try {
        const response = await fetch(`https://api.football-data.org/v4/matches`, {
            headers: { 'X-Auth-Token': FOOTBALL_DATA_API_KEY }
        });
        const data = await response.json();
        if (!data.matches) return res.json(["LuckyPitch Engine Online"]);

        const ticker = data.matches.slice(0, 10).map(m => `${m.homeTeam.name} vs ${m.awayTeam.name}`);
        res.json(ticker);
    } catch (err) { res.status(500).json(["Neural Link Stable..."]); }
});

app.get("/api/standings/:leagueCode", async (req, res) => {
    const league = req.params.leagueCode;
    const now = Date.now();
    if (standingsCache[league] && (now - standingsCache[league].lastFetch < 600000)) return res.json(standingsCache[league].data);
    try {
        const response = await fetch(`https://api.football-data.org/v4/competitions/${league}/standings`, {
            headers: { "X-Auth-Token": FOOTBALL_DATA_API_KEY }
        });
        const data = await response.json();
        standingsCache[league] = { data: data, lastFetch: now };
        res.json(data);
    } catch (err) { res.status(500).json({ error: "Standings error" }); }
});

// --- ODDS API ---
app.get('/api/odds-data', async (req, res) => {
    const now = Date.now();
    if (oddsCache.data && (now - oddsCache.lastFetch < 300000)) return res.json(oddsCache.data);
    try {
        const response = await fetch(`https://api.the-odds-api.com/v4/sports/soccer/odds/?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h`);
        const data = await response.json();
        oddsCache = { data: data, lastFetch: now };
        res.json(data);
    } catch (error) { res.status(500).json({ error: "Odds unavailable" }); }
});

// --- STRIPE FIZETÉS ---
app.post('/create-checkout-session', async (req, res) => {
    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{ 
                price_data: { currency: 'huf', product_data: { name: 'LuckyPitch Támogatás' }, unit_amount: 100000 }, 
                quantity: 1 
            }],
            mode: 'payment',
            success_url: `${req.headers.origin}/Home.html?success=true`,
            cancel_url: `${req.headers.origin}/Home.html?cancel=true`,
        });
        res.json({ id: session.id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- AUTO CHECK FUNKCIÓ JAVÍTVA ---
const autoCheckResults = async () => {
    const apiKey = process.env.FOOTBALL_API_KEY ? String(process.env.FOOTBALL_API_KEY).trim() : null;
    if (!apiKey) return;

    try {
        const { data: pendingBets, error } = await supabase
            .from('bets')
            .select('*')
            .eq('status', 'OPEN');

        if (error || !pendingBets || pendingBets.length === 0) return;

        for (let bet of pendingBets) {
            const apiRes = await fetch(`https://api.football-data.org/v4/matches/${bet.match_id}`, {
                headers: { 'X-Auth-Token': apiKey }
            });
            const match = await apiRes.json();

            if (match.status === 'FINISHED') {
                const homeScore = match.score.fullTime.home;
                const awayScore = match.score.fullTime.away;
                let actualResult = (homeScore > awayScore) ? 'H' : (homeScore < awayScore ? 'V' : 'D');

                if (bet.type === actualResult) {
                    const winAmount = Math.floor(bet.amount * bet.odds);

                    // --- JAVÍTOTT RÉSZ: user_balances tábla használata ---
                    // 1. Lekérjük az aktuális egyenleget
                    const { data: currentWallet } = await supabase
                        .from('user_balances')
                        .select('balance')
                        .eq('user_id', bet.user_id)
                        .single();

                    if (currentWallet) {
                        const newTotal = currentWallet.balance + winAmount;

                        // 2. Frissítjük a user_balances-t
                        await supabase
                            .from('user_balances')
                            .update({ balance: newTotal })
                            .eq('user_id', bet.user_id);

                        // 3. Lezárjuk a fogadást
                        await supabase.from('bets').update({ status: 'WON' }).eq('id', bet.id);
                        console.log(`NYERTES: ${bet.user_id} kapott ${winAmount} pontot. Új egyenleg: ${newTotal}`);
                    }
                } else {
                    await supabase.from('bets').update({ status: 'LOST' }).eq('id', bet.id);
                    console.log(`VESZTETT: Bet ID ${bet.id}`);
                }
            }
            await new Promise(r => setTimeout(r, 1000));
        }
    } catch (err) {
        console.error("Hiba az auto-check során:", err);
    }
};

// 5 percenkénti indítás
setInterval(autoCheckResults, 300000);
// Első futtatás azonnal
autoCheckResults();

// server.js - Fogadások kiértékelése

// --- OLDALAK KISZOLGÁLÁSA ---
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "Home.html")));
app.get("/go", (req, res) => res.sendFile(path.join(__dirname, "go.html")));
app.get("/meccsek", (req, res) => res.sendFile(path.join(__dirname, "meccsek.html")));
app.get("/elemzes", (req, res) => res.sendFile(path.join(__dirname, "elemzes.html")));
app.get("/kontakt", (req, res) => res.sendFile(path.join(__dirname, "kontakt.html")));

// BIZTONSÁGOS FALLBACK
// Csak akkor irányítunk át, ha nem konkrét fájlt (.css, .js, .png) keres a böngésző
app.get("*", (req, res) => {
    if (req.path.includes('.')) return res.status(404).send("Fájl nem található");
    res.redirect("/");
});

// 1. Végpont a pingeléshez (marad)
app.get('/keep-alive', (req, res) => {
    res.status(200).send('LuckyPitch szerver ébren van!');
});

// 2. Az ébresztő funkció AXIOS NÉLKÜL
const keepServerAlive = async () => {
    const url = "https://lucky-pitch.onrender.com/keep-alive"; 
    
    try {
        // A beépített fetch-et használjuk, amihez nem kell külön modul
        const response = await fetch(url);
        console.log(`[Keep-Alive] Sikeres ping: ${new Date().toLocaleString()} - Status: ${response.status}`);
    } catch (error) {
        console.error("[Keep-Alive] Hiba az ébresztés során:", error.message);
    }
};

// 3. 14 percenkénti indítás
setInterval(keepServerAlive, 840000);

// 1. Segédfüggvény a kártékony kódok semlegesítéséhez (a fájl elejére)
function escapeHtml(unsafe) {
    if (!unsafe || typeof unsafe !== 'string') return unsafe;
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

const processedGoals = new Set();

io.on('connection', (socket) => {
    console.log('Egy felhasználó csatlakozott a chathoz');

    socket.on('join-chat', (matchId) => {
        socket.join(`match_${matchId}`);
    });

    // 2. Trash-talk ÜZENETEK TISZTÍTÁSA
    socket.on('send-msg', (data) => {
        // Megtisztítjuk a felhasználó nevét és az üzenetet is
        const cleanUser = escapeHtml(data.user);
        const cleanMessage = escapeHtml(data.message);

        // Ha üres az üzenet a tisztítás után, nem küldjük ki
        if (!cleanMessage.trim()) return;

        io.to(`match_${data.matchId}`).emit('new-msg', {
            matchId: data.matchId,
            user: cleanUser,
            message: cleanMessage,
            color: data.color || '#00d4ff'
        });
    });

    // 3. Gól jelentés (itt nem kell tisztítás, mert mi generáljuk a szöveget)
    socket.on('goal-detected-client', (data) => {
        const goalKey = `${data.matchId}-${data.score}`;

        if (processedGoals.has(goalKey)) return;

        processedGoals.add(goalKey);

        io.emit('new-msg', {
            matchId: data.matchId,
            user: "🏟️ STADION",
            message: `GÓÓÓÓL! ${data.teamName} betalált! Állás: ${data.score}`,
            color: "#ff3e3e"
        });

        setTimeout(() => {
            processedGoals.delete(goalKey);
        }, 60000);
    });

    socket.on('disconnect', () => {
        console.log('Felhasználó lecsatlakozott');
    });
});

// SZERVER INDÍTÁSA
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`
    🚀 LuckyPitch Szerver ONLINE
    📡 Port: ${PORT}
    ⚽ Supabase: ${process.env.SUPABASE_URL ? "KAPCSOLÓDVA" : "HIÁNYZIK"}
    📈 Odds API: AKTÍV
    `);
});













