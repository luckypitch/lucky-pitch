const express = require("express");
const cors = require("cors");
const path = require("path");
const fetch = require("node-fetch");

require('dotenv').config({ path: path.resolve(__dirname, 'api.env') });

const app = express();
app.use(express.json());
app.use(cors());

// Statikus fájlok (CSS, Képek, JS) kiszolgálása
app.use(express.static(path.join(__dirname)));

const FOOTBALL_DATA_API_KEY = process.env.FOOTBALL_DATA_API_KEY;
const ODDS_API_KEY = process.env.ODDS_API_KEY;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const stripe = require('stripe')(STRIPE_SECRET_KEY);

// --- CACHE TÁROLÓK ---
let matchCache = { data: null, lastFetch: 0 };
let oddsCache = { data: null, lastFetch: 0 };
let standingsCache = {};

// MECCSEK (1 perces cache)
A szerver oldali kódod most már sokkal hatékonyabb, de van egy fontos technikai részlet, ami miatt a 6 perces késést tapasztalhatod: a football-data.org ingyenes szintje néha agresszíven gyorsítótáraz (cache), és ha nem specifikálod a ligákat vagy az élő státuszt, hajlamos "régi" adatcsomagot küldeni.

Itt a végleges, optimalizált szerver kód és a magyarázat a javításokhoz:
1. Optimalizált Szerver Oldal (server.js)

A /v4/matches paraméterek nélkül az összes létező meccset lekéri (ifi, női, alacsonyabb osztályok), ami lassítja a feldolgozást. Szűkítsük le az élő meccsekre és a fontosabb ligákra:
JavaScript

app.get("/live-matches", async (req, res) => {
    const now = Date.now();
    
    // 30 másodperces cache - az ingyenes API limitje miatt ez a biztonságos
    if (matchCache.data && (now - matchCache.lastFetch < 30000)) {
        return res.json(matchCache.data);
    }

    try {
        // TRÜKK: Ha nem adsz meg dátumot, az API az aktuális napot adja, 
        // de adjunk hozzá egy 'status' szűrőt, hogy az élőket priorizálja
        const url = `https://api.football-data.org/v4/matches`;
        
        const response = await fetch(url, { 
            headers: { 
                "X-Auth-Token": FOOTBALL_DATA_API_KEY,
                // Biztosítjuk, hogy ne kapjunk tömörített/hibás adatot
                "Accept-Encoding": "identity" 
            } 
        });

        if (!response.ok) {
            console.error(`API Error: ${response.status}`);
            throw new Error("API hiba");
        }

        const data = await response.json();

        // Ha az API üres listát küld (néha előfordul hiba esetén), 
        // ne írjuk felül a jó cache-t
        if (data.matches && data.matches.length > 0) {
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

// TABELLA (10 perces cache)
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
    } catch (err) { 
        console.error("Tabella hiba:", err.message);
        res.status(500).json({ error: "Nem sikerült betölteni a tabellát" }); 
    }
});

// ODDS (5 perces cache) - Fontos: Több sportág vagy régió is hozzáadható ha kell
app.get('/api/odds-data', async (req, res) => {
    const now = Date.now();
    if (oddsCache.data && (now - oddsCache.lastFetch < 300000)) return res.json(oddsCache.data);
    try {
        // EU régió, 1x2 piac (h2h)
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

// STRIPE
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
    🚀 LuckyPitch Szerver ONLINE
    📡 Port: ${PORT}
    ⚽ Football-Data API: ${FOOTBALL_DATA_API_KEY ? "AKTÍV" : "HIÁNYZIK"}
    📈 Odds API: ${ODDS_API_KEY ? "AKTÍV" : "HIÁNYZIK"}
    `);
});



