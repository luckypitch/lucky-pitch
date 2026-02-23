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

app.get('/api/user/get-bets', async (req, res) => {
    const { userId } = req.query;
    
    try {
        // Itt kellene lekérdezni az adatbázisodból (pl. MongoDB, SQL vagy Supabase)
        // a user_id-hoz tartozó fogadásokat.
        
        // HA MÉG NINCS ADATBÁZISOD, küldj egy üres listát, hogy ne legyen hiba:
        res.json([]); 
        
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Szerver hiba történt" });
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




