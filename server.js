const express = require("express");
const cors = require("cors");
const path = require("path");
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// BIZTONSÁGOS FETCH: Kezeli a node-fetch verziókat
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// --- 1. Egyenleg LEKÉRÉSE ---
app.get('/api/user/balance', async (req, res) => {
    const { userId } = req.query;
    
    // Lekérjük az egyenleget, ha nincs, létrehozzuk 1000-el (upsert)
    const { data, error } = await supabase
        .from('user_balances')
        .select('balance')
        .eq('user_id', userId)
        .single();

    if (error && error.code === 'PGRST116') { // Nincs még ilyen user
        const { data: newUser } = await supabase
            .from('user_balances')
            .insert({ user_id: userId, balance: 1000 })
            .select()
            .single();
        return res.json({ balance: 1000 });
    }

    res.json(data);
});

// --- 2. Egyenleg FRISSÍTÉSE ---
app.post('/api/user/update-balance', async (req, res) => {
    const { userId, balance } = req.body;

    const { error } = await supabase
        .from('user_balances')
        .update({ balance: balance })
        .eq('user_id', userId);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// Konfiguráció betöltése
require('dotenv').config({ path: path.resolve(__dirname, 'api.env') });

const app = express(); // CSAK EGYSZER DEKLARÁLVA
app.use(express.json());
app.use(cors());

// Statikus fájlok kiszolgálása (A gyökérkönyvtárból)
app.use(express.static(path.join(__dirname)));

// API Kulcsok
const FOOTBALL_DATA_API_KEY = process.env.FOOTBALL_DATA_API_KEY;
const ODDS_API_KEY = process.env.ODDS_API_KEY;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const stripe = require('stripe')(STRIPE_SECRET_KEY);

// --- MEMÓRIA TÁROLÓK (EGYENLEG ÉS CACHE) ---
let userBalances = {}; 
let matchCache = { data: null, lastFetch: 0 };
let oddsCache = { data: null, lastFetch: 0 };
let standingsCache = {};

// --- VIRTUAL BALANCE API ---

// Egyenleg lekérése
app.get('/api/user/balance', (req, res) => {
    try {
        const userId = req.query.userId;
        if (!userId) return res.status(400).json({ error: "No UserID" });
        if (userBalances[userId] === undefined) userBalances[userId] = 1000;
        res.json({ balance: userBalances[userId] });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

// Pontlevonás vagy hozzáadás
app.post('/api/user/update-balance', (req, res) => {
    try {
        const { userId, amount } = req.body;
        if (!userId) return res.status(400).json({ error: "No UserID" });
        if (userBalances[userId] === undefined) userBalances[userId] = 1000;
        if (userBalances[userId] + amount < 0) {
            return res.status(400).json({ error: "Nincs elég egyenleged!" });
        }
        userBalances[userId] += amount;
        res.json({ success: true, newBalance: userBalances[userId] });
    } catch (err) {
        res.status(500).json({ error: "Update failed" });
    }
});

// --- FOOTBALL DATA API VÉGPONTOK ---

app.get("/live-matches", async (req, res) => {
    const now = Date.now();
    if (matchCache.data && (now - matchCache.lastFetch < 30000)) return res.json(matchCache.data);

    try {
        const dateFrom = new Date();
        dateFrom.setDate(dateFrom.getDate() - 3);
        const dateTo = new Date();
        dateTo.setDate(dateTo.getDate() + 3);
        const fromStr = dateFrom.toISOString().split('T')[0];
        const toStr = dateTo.toISOString().split('T')[0];

        const url = `https://api.football-data.org/v4/matches?dateFrom=${fromStr}&dateTo=${toStr}`;
        const response = await fetch(url, { 
            headers: { "X-Auth-Token": FOOTBALL_DATA_API_KEY, "Accept-Encoding": "identity" } 
        });

        if (!response.ok) throw new Error(`API hiba: ${response.status}`);
        const data = await response.json();
        if (data.matches) {
            matchCache.data = data;
            matchCache.lastFetch = now;
        }
        res.json(data);
    } catch (error) {
        if (matchCache.data) res.json(matchCache.data);
        else res.status(500).json({ error: "API elérhetetlen" });
    }
});

app.get('/api/live-ticker', async (req, res) => {
    try {
        const d = new Date();
        const from = new Date(d); from.setDate(d.getDate() - 1);
        const to = new Date(d); to.setDate(d.getDate() + 1);
        const fromStr = from.toISOString().split('T')[0];
        const toStr = to.toISOString().split('T')[0];

        const response = await fetch(`https://api.football-data.org/v4/matches?dateFrom=${fromStr}&dateTo=${toStr}`, {
            headers: { 'X-Auth-Token': FOOTBALL_DATA_API_KEY }
        });
        const data = await response.json();
        
        if (!data.matches || data.matches.length === 0) return res.json(["LuckyPitch Engine Online"]);

        const formattedMatches = data.matches.slice(0, 15).map(m => {
            const home = m.homeTeam.shortName || m.homeTeam.name;
            const away = m.awayTeam.shortName || m.awayTeam.name;
            if (m.status === "IN_PLAY" || m.status === "FINISHED") {
                return `${home} ${m.score.fullTime.home} - ${m.score.fullTime.away} ${away}`;
            }
            const time = new Date(m.utcDate).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
            return `${home} vs ${away} (${time})`;
        });
        res.json(formattedMatches);
    } catch (err) {
        res.status(500).json(["Neural Link Stable..."]);
    }
});

app.get("/api/standings/:leagueCode", async (req, res) => {
    const league = req.params.leagueCode;
    const now = Date.now();
    if (standingsCache[league] && (now - standingsCache[league].lastFetch < 600000)) return res.json(standingsCache[league].data);
    try {
        const url = `https://api.football-data.org/v4/competitions/${league}/standings`;
        const response = await fetch(url, { headers: { "X-Auth-Token": FOOTBALL_DATA_API_KEY } });
        const data = await response.json();
        standingsCache[league] = { data: data, lastFetch: now };
        res.json(data);
    } catch (err) { res.status(500).json({ error: "Standings error" }); }
});

app.get('/api/odds-data', async (req, res) => {
    const now = Date.now();
    if (oddsCache.data && (now - oddsCache.lastFetch < 300000)) return res.json(oddsCache.data);
    try {
        const url = `https://api.the-odds-api.com/v4/sports/soccer/odds/?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h&bookmakers=betfair,unibet,williamhill`;
        const response = await fetch(url);
        const data = await response.json();
        if (!Array.isArray(data)) throw new Error("Invalid API response");
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
                price_data: { 
                    currency: 'huf', 
                    product_data: { name: 'LuckyPitch Támogatás' }, 
                    unit_amount: 100000 
                }, 
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
app.get("/home", (req, res) => res.sendFile(path.join(__dirname, "Home.html")));
app.get("/meccsek", (req, res) => res.sendFile(path.join(__dirname, "meccsek.html")));
app.get("/elemzes", (req, res) => res.sendFile(path.join(__dirname, "elemzes.html")));
app.get("*", (req, res) => res.redirect("/"));

// Fallback: Ha olyan URL-t ütnek be ami nincs, irányítsuk a főoldalra
app.get("*", (req, res) => res.redirect("/"));

// SZERVER INDÍTÁSA
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
    🚀 LuckyPitch Szerver ONLINE
    📡 Port: ${PORT}
    ⚽ Football-Data API: ${FOOTBALL_DATA_API_KEY ? "AKTÍV" : "HIÁNYZIK"}
    📈 Odds API: ${ODDS_API_KEY ? "AKTÍV" : "HIÁNYZIK"}
    💳 Stripe: ${STRIPE_SECRET_KEY ? "AKTÍV" : "HIÁNYZIK"}
    `);
});









