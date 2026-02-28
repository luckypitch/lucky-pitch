// 1. KÖRNYEZETI VÁLTOZÓK BETÖLTÉSE
require('dotenv').config({ path: require('path').resolve(__dirname, 'api.env') });

const express = require("express");
const cors = require("cors");
const path = require("path");
const { createClient } = require('@supabase/supabase-js');
const fetch = require("node-fetch");
const http = require('http');
const { Server } = require('socket.io');

const app = express(); 
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// 2. INICIALIZÁLÁS
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname)));

// 3. SUPABASE ÉS API KULCSOK
const supabase = createClient(
    process.env.SUPABASE_URL, 
    process.env.SUPABASE_KEY
);

// Összefésült API kulcs kezelés (Render-en FOOTBALL_API_KEY van megadva)
const FOOTBALL_DATA_API_KEY = process.env.FOOTBALL_DATA_API_KEY || process.env.FOOTBALL_API_KEY;
const ODDS_API_KEY = process.env.ODDS_API_KEY;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const stripe = require('stripe')(STRIPE_SECRET_KEY);

if (!FOOTBALL_DATA_API_KEY) {
    console.error("❌ HIBA: Egyik Football API kulcs sem található!");
}

// --- MEMÓRIA TÁROLÓK (CACHE) ---
let matchCache = { data: null, lastFetch: 0 };
let oddsCache = { data: null, lastFetch: 0 };
let standingsCache = {};

// --- SEGÉDFÜGGVÉNYEK ---
function escapeHtml(unsafe) {
    if (!unsafe || typeof unsafe !== 'string') return unsafe;
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

// --- SUPABASE EGYENLEG API ---

app.get('/api/user/balance', async (req, res) => {
    try {
        const userId = req.query.userId;
        if (!userId) return res.status(400).json({ error: "No UserID" });

        let { data, error } = await supabase
            .from('user_balances')
            .select('balance')
            .eq('user_id', userId)
            .single();

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

        const { error: balanceError } = await supabase
            .from('user_balances')
            .update({ balance: balance })
            .eq('user_id', userId);

        if (balanceError) throw balanceError;

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
        res.status(500).json({ error: "Szerver hiba" });
    }
});

// --- FOGADÁSOK AUTOMATIKUS KIÉRTÉKELÉSE ---
const autoCheckResults = async () => {
    if (!FOOTBALL_DATA_API_KEY) return;

    try {
        const { data: pendingBets, error } = await supabase
            .from('bets')
            .select('*')
            .eq('status', 'OPEN');

        if (error || !pendingBets || pendingBets.length === 0) return;

        console.log(`[Auto-Check] ${pendingBets.length} fogadás ellenőrzése...`);

        for (let bet of pendingBets) {
            try {
                const apiRes = await fetch(`https://api.football-data.org/v4/matches/${bet.match_id}`, {
                    headers: { 'X-Auth-Token': FOOTBALL_DATA_API_KEY }
                });
                
                if (!apiRes.ok) continue;
                const match = await apiRes.json();

                if (match.status === 'FINISHED') {
                    const homeScore = match.score.fullTime.home;
                    const awayScore = match.score.fullTime.away;
                    let actualResult = (homeScore > awayScore) ? 'H' : (homeScore < awayScore ? 'V' : 'D');

                    if (bet.type === actualResult) {
                        const winAmount = Math.floor(bet.amount * bet.odds);
                        
                        // Biztonságos kifizetés RPC-vel (megakadályozza az egyenleg felülírást)
                        const { error: rpcError } = await supabase.rpc('settle_winning_bet', { 
                            u_id: bet.user_id, 
                            win_amount: winAmount 
                        });

                        if (!rpcError) {
                            await supabase.from('bets').update({ status: 'WON' }).eq('id', bet.id);
                        }
                    } else {
                        await supabase.from('bets').update({ status: 'LOST' }).eq('id', bet.id);
                    }
                }
            } catch (innerErr) {
                console.error(`Meccs hiba (${bet.match_id}):`, innerErr.message);
            }
            // Rate limit védelem (1 mp szünet kérésenként)
            await new Promise(r => setTimeout(r, 1000));
        }
    } catch (err) {
        console.error("Globális auto-check hiba:", err);
    }
};

// 5 percenkénti futtatás
setInterval(autoCheckResults, 300000);
autoCheckResults();

// --- FOOTBALL DATA API VÉGPONTOK ---

app.get("/live-matches", async (req, res) => {
    const now = Date.now();
    if (matchCache.data && (now - matchCache.lastFetch < 30000)) return res.json(matchCache.data);

    try {
        const d = new Date();
        const from = new Date(d); from.setDate(d.getDate() - 3);
        const to = new Date(d); to.setDate(d.getDate() + 3);
        
        const response = await fetch(`https://api.football-data.org/v4/matches?dateFrom=${from.toISOString().split('T')[0]}&dateTo=${to.toISOString().split('T')[0]}`, { 
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
    } catch (err) { res.json(["Neural Link Stable..."]); }
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

// --- OLDALAK KISZOLGÁLÁSA ---
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "Home.html")));
app.get("/go", (req, res) => res.sendFile(path.join(__dirname, "go.html")));
app.get("/meccsek", (req, res) => res.sendFile(path.join(__dirname, "meccsek.html")));
app.get("/elemzes", (req, res) => res.sendFile(path.join(__dirname, "elemzes.html")));
app.get("/kontakt", (req, res) => res.sendFile(path.join(__dirname, "kontakt.html")));

app.get('/keep-alive', (req, res) => {
    res.status(200).send('LuckyPitch szerver ébren van!');
});

// Ébresztő funkció Render-hez
setInterval(async () => {
    try {
        await fetch("https://lucky-pitch.onrender.com/keep-alive");
    } catch (e) { console.log("Keep-alive error"); }
}, 840000);

// --- SOCKET.IO CHAT LOGIKA ---
const processedGoals = new Set();

io.on('connection', (socket) => {
    socket.on('join-chat', (matchId) => {
        socket.join(`match_${matchId}`);
    });

    socket.on('send-msg', (data) => {
        const cleanUser = escapeHtml(data.user);
        const cleanMessage = escapeHtml(data.message);
        if (!cleanMessage.trim()) return;

        io.to(`match_${data.matchId}`).emit('new-msg', {
            matchId: data.matchId,
            user: cleanUser,
            message: cleanMessage,
            color: data.color || '#00d4ff'
        });
    });

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

        setTimeout(() => processedGoals.delete(goalKey), 60000);
    });
});

// BIZTONSÁGOS FALLBACK
app.get("*", (req, res) => {
    if (req.path.includes('.')) return res.status(404).send("Fájl nem található");
    res.redirect("/");
});

// SZERVER INDÍTÁSA
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 LuckyPitch Szerver ONLINE a ${PORT} porton!`);
});
