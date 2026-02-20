const express = require("express");
const cors = require("cors");
const path = require("path");
const fetch = require("node-fetch");
require('dotenv').config({ path: path.resolve(__dirname, 'api.env') });

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));

const FOOTBALL_DATA_API_KEY = process.env.FOOTBALL_DATA_API_KEY;

// --- CACHE TÁROLÓK ---
let matchCache = { data: null, lastFetch: 0 };
let standingsCache = {}; // Ligánkénti tárolás: { 'PL': { data: ..., lastFetch: ... } }

// --- 1. MECCSEK (60 másodperces gyorsítótár) ---
app.get("/live-matches", async (req, res) => {
    const now = Date.now();
    // Ha van mentett adat és 60 másodpercnél frissebb, azt küldjük
    if (matchCache.data && (now - matchCache.lastFetch < 60000)) {
        console.log("Meccsek kiszolgálása CACHE-ből");
        return res.json(matchCache.data);
    }

    try {
        const today = new Date();
        const dFrom = new Date(today); dFrom.setDate(today.getDate() - 4);
        const dTo = new Date(today); dTo.setDate(today.getDate() + 4);
        const url = `https://api.football-data.org/v4/matches?dateFrom=${dFrom.toISOString().split('T')[0]}&dateTo=${dTo.toISOString().split('T')[0]}`;
        
        const response = await fetch(url, { headers: { "X-Auth-Token": FOOTBALL_DATA_API_KEY } });
        const data = await response.json();
        
        // Mentés a cache-be
        matchCache = { data: data, lastFetch: now };
        console.log("Meccsek frissítve az API-ról");
        res.json(data);
    } catch (err) { res.status(500).json({ error: "Hiba" }); }
});

// --- 2. TABELLA (10 perces gyorsítótár, mert ez ritkán változik) ---
app.get("/api/standings/:leagueCode", async (req, res) => {
    const league = req.params.leagueCode;
    const now = Date.now();

    if (standingsCache[league] && (now - standingsCache[league].lastFetch < 600000)) {
        console.log(`${league} tabella CACHE-ből`);
        return res.json(standingsCache[league].data);
    }

    try {
        const url = `https://api.football-data.org/v4/competitions/${league}/standings`;
        const response = await fetch(url, { headers: { "X-Auth-Token": FOOTBALL_DATA_API_KEY } });
        const data = await response.json();
        
        standingsCache[league] = { data: data, lastFetch: now };
        res.json(data);
    } catch (err) { res.status(500).json({ error: "Hiba" }); }
});

// Többi útvonal (Odds, Stripe, HTML-ek) marad a régiben...
// ... (beillesztendő az előző kódból)

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Szerver fut a ${PORT} porton`));
