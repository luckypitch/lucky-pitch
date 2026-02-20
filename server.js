const express = require("express");
const cors = require("cors");
const path = require("path");

// BIZTONSÁGOS FETCH: Kezeli a node-fetch 2-es és 3-as verzióját is, megakadályozva a leállást
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

require('dotenv').config({ path: path.resolve(__dirname, 'api.env') });

const app = express();
app.use(express.json());
app.use(cors());

// Statikus fájlok kiszolgálása
app.use(express.static(path.join(__dirname)));

const FOOTBALL_DATA_API_KEY = process.env.FOOTBALL_DATA_API_KEY;
const ODDS_API_KEY = process.env.ODDS_API_KEY;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const stripe = require('stripe')(STRIPE_SECRET_KEY);

// --- CACHE TÁROLÓK ---
let matchCache = { data: null, lastFetch: 0 };
let oddsCache = { data: null, lastFetch: 0 };
let standingsCache = {};

// --- API VÉGPONTOK ---

// ⚽ MECCSEK (Optimalizált 30 mp-es cache az élő adatokhoz)
app.get("/live-matches", async (req, res) => {
    const now = Date.now();
    
    // Ha van cache és friss (30mp), azt adjuk vissza
    if (matchCache.data && (now - matchCache.lastFetch < 30000)) {
        return res.json(matchCache.data);
    }

    try {
        // Időintervallum kiszámítása (3 nap vissza, 3 nap előre)
        const dateFrom = new Date();
        dateFrom.setDate(dateFrom.getDate() - 3);
        const dateTo = new Date();
        dateTo.setDate(dateTo.getDate() + 3);

        const fromStr = dateFrom.toISOString().split('T')[0];
        const toStr = dateTo.toISOString().split('T')[0];

        // URL kiegészítése az intervallummal
        const url = `https://api.football-data.org/v4/matches?dateFrom=${fromStr}&dateTo=${toStr}`;
        
        console.log("Lekérés az API-ból:", url);

        const response = await fetch(url, { 
            headers: { 
                "X-Auth-Token": FOOTBALL_DATA_API_KEY,
                "Accept-Encoding": "identity"
            } 
        });

        if (!response.ok) throw new Error(`API hiba: ${response.status}`);

        const data = await response.json();

        if (data.matches) {
            matchCache.data = data;
            matchCache.lastFetch = now;
        }

        res.json(matchCache.data || data);
    } catch (error) {
        console.error("Szerver hiba lekéréskor:", error.message);
        if (matchCache.data) res.json(matchCache.data);
        else res.status(500).json({ error: "API elérhetetlen" });
    }
});

// 📊 TABELLA (10 perces cache)
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
    } catch (err) { 
        console.error("Tabella hiba:", err.message);
        res.status(500).json({ error: "Nem sikerült betölteni a tabellát" }); 
    }
});

// 📈 ODDS (5 perces cache)
app.get('/api/odds-data', async (req, res) => {
    const now = Date.now();
    if (oddsCache.data && (now - oddsCache.lastFetch < 300000)) {
        return res.json(oddsCache.data);
    }
    try {
        const url = `https://api.the-odds-api.com/v4/sports/soccer/odds/?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h&bookmakers=betfair,unibet,williamhill`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (!Array.isArray(data)) throw new Error("Érvénytelen válasz az Odds API-tól");

        oddsCache = { data: data, lastFetch: now };
        res.json(data);
    } catch (error) { 
        console.error("Odds API hiba:", error.message);
        res.status(500).json({ error: "Az oddsok jelenleg nem elérhetőek" }); 
    }
});

// 💳 STRIPE FIZETÉS
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

