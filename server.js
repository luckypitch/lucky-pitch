const express = require("express");
const cors = require("cors");
const path = require("path");
const fetch = require("node-fetch");

// Konfiguráció beolvasása az api.env fájlból
require('dotenv').config({ path: path.resolve(__dirname, 'api.env') });

const app = express();
app.use(express.json());
app.use(cors());

// Nagyon fontos: Statikus fájlok kiszolgálása a főkönyvtárból
app.use(express.static(path.join(__dirname)));

// --- API KULCSOK ---
const FOOTBALL_DATA_API_KEY = process.env.FOOTBALL_DATA_API_KEY;
const ODDS_API_KEY = process.env.ODDS_API_KEY;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

const stripe = require('stripe')(STRIPE_SECRET_KEY);

// --- CACHE (API Kímélő tároló) ---
let matchCache = { data: null, lastFetch: 0 };
let oddsCache = { data: null, lastFetch: 0 };
let standingsCache = {};

// --- VÉGPONTOK ---

// 1. Meccsek (1 perces cache)
app.get("/live-matches", async (req, res) => {
    const now = Date.now();
    if (matchCache.data && (now - matchCache.lastFetch < 60000)) {
        return res.json(matchCache.data);
    }

    try {
        const today = new Date();
        const dFrom = new Date(today); dFrom.setDate(today.getDate() - 4);
        const dTo = new Date(today); dTo.setDate(today.getDate() + 4);
        const url = `https://api.football-data.org/v4/matches?dateFrom=${dFrom.toISOString().split('T')[0]}&dateTo=${dTo.toISOString().split('T')[0]}`;
        
        const response = await fetch(url, { headers: { "X-Auth-Token": FOOTBALL_DATA_API_KEY } });
        const data = await response.json();
        matchCache = { data: data, lastFetch: now };
        res.json(data);
    } catch (err) { res.status(500).json({ error: "API hiba" }); }
});

// 2. Tabella (10 perces cache)
app.get("/api/standings/:leagueCode", async (req, res) => {
    const league = req.params.leagueCode;
    const now = Date.now();
    if (standingsCache[league] && (now - standingsCache[league].lastFetch < 600000)) {
        return res.json(standingsCache[league].data);
    }

    try {
        const url = `https://api.football-data.org/v4/competitions/${league}/standings`;
        const response = await fetch(url, { headers: { "X-Auth-Token": FOOTBALL_DATA_API_KEY } });
        const data = await response.json();
        standingsCache[league] = { data: data, lastFetch: now };
        res.json(data);
    } catch (err) { res.status(500).json({ error: "Tabella hiba" }); }
});

// 3. Oddsok (5 perces cache - Nagyon spórolós!)
app.get('/api/odds-data', async (req, res) => {
    const now = Date.now();
    if (oddsCache.data && (now - oddsCache.lastFetch < 300000)) {
        return res.json(oddsCache.data);
    }

    try {
        const url = `https://api.the-odds-api.com/v4/sports/soccer/odds/?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h`;
        const response = await fetch(url);
        const data = await response.json();
        oddsCache = { data: data, lastFetch: now };
        res.json(data);
    } catch (error) { res.status(500).json({ error: "Odds hiba" }); }
});

// 4. Stripe
app.post('/create-checkout-session', async (req, res) => {
    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: { currency: 'huf', product_data: { name: 'LuckyPitch Támogatás' }, unit_amount: 100000 },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `${req.headers.origin}/Home.html?success=true`,
            cancel_url: `${req.headers.origin}/Home.html?cancel=true`,
        });
        res.json({ id: session.id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- OLDALAK IRÁNYÍTÁSA (Fix a "Cannot GET /" hibára) ---
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "Home.html"));
});

app.get("/home", (req, res) => {
    res.sendFile(path.join(__dirname, "Home.html"));
});

app.get("/meccsek", (req, res) => {
    res.sendFile(path.join(__dirname, "meccsek.html"));
});

app.get("/elemzes", (req, res) => {
    res.sendFile(path.join(__dirname, "elemzes.html"));
});

// Szerver indítás
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 LuckyPitch Szerver ONLINE a ${PORT} porton`);
});
