// 1. KÖRNYEZETI VÁLTOZÓK BETÖLTÉSE
require('dotenv').config({ path: require('path').resolve(__dirname, 'api.env') });

const express = require("express");
const cors = require("cors");
const path = require("path");
const { createClient } = require('@supabase/supabase-js');
const fetch = require("node-fetch");

// 2. INICIALIZÁLÁS
const app = express();
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

        // Lekérjük a Supabase 'bets' táblájából a júzer fogadásait
        const { data, error } = await supabase
            .from('bets')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false }); // A legfrissebb legyen felül

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error("Hiba a fogadások lekérésekor:", err);
        res.status(500).json({ error: "Nem sikerült betölteni a fogadásokat" });
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

// server.js - Példa egy kiértékelő végpontra
app.post('/api/admin/settle-bets', async (req, res) => {
    try {
        // 1. Függő fogadások lekérése
        const { data: pendingBets } = await supabase.from('bets').select('*').eq('status', 'pending');

        for (let bet of pendingBets) {
            // 2. Meccs adat lekérése az API-ból
            const match = await fetchMatchFromAPI(bet.match_id); 
            
            if (match.status === 'FINISHED') {
                const result = getResult(match.score); // 'H', 'D' vagy 'V'
                const isWinner = bet.prediction === result;

                if (isWinner) {
                    const payout = bet.amount * bet.odds;
                    // Egyenleg növelése a Supabase-ben
                    await supabase.rpc('increment_balance', { user_id: bet.user_id, amount: payout });
                    await supabase.from('bets').update({ status: 'won' }).eq('id', bet.id);
                } else {
                    await supabase.from('bets').update({ status: 'lost' }).eq('id', bet.id);
                }
            }
        }
        res.json({ message: "Sikeres kiértékelés!" });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// --- OLDALAK KISZOLGÁLÁSA ---
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "Home.html")));
app.get("/meccsek", (req, res) => res.sendFile(path.join(__dirname, "meccsek.html")));
app.get("/elemzes", (req, res) => res.sendFile(path.join(__dirname, "elemzes.html")));

// Fallback minden másra (irányítás a főoldalra)
app.get("*", (req, res) => res.redirect("/"));

// SZERVER INDÍTÁSA
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
    🚀 LuckyPitch Szerver ONLINE
    📡 Port: ${PORT}
    ⚽ Supabase: ${process.env.SUPABASE_URL ? "KAPCSOLÓDVA" : "HIÁNYZIK"}
    📈 Odds API: AKTÍV
    `);
});








