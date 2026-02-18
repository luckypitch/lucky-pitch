const express = require("express");
const cors = require("cors");
const path = require("path");

// Fetch támogatás
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();

app.use(cors());
app.use(express.static(__dirname));

const ODDS_API_KEY = '17b18da5d210a284be65b75933b24f9e'; 
const FOOTBALL_DATA_API_KEY = "1f931344560e4ddc9103eff9281d435b";

// --- CACHE TÁROLÓK ---
let cache = {
    odds: { data: null, time: 0 },
    matches: { data: null, time: 0 }
};
const CACHE_DURATION = 5 * 60 * 1000; // 5 perc

// --- 1. VÉGPONT: Odds adatok lekérése (Cache-elt) ---
app.get('/api/odds-data', async (req, res) => {
    const now = Date.now();
    if (cache.odds.data && (now - cache.odds.time < CACHE_DURATION)) {
        console.log("Odds kiszolgálása gyorsítótárból...");
        return res.json(cache.odds.data);
    }

    try {
        const response = await fetch(`https://api.the-odds-api.com/v4/sports/soccer/odds/?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h&bookmakers=unibet,betfair_ex,williamhill,888sport`);
        const data = await response.json();
        
        if (Array.isArray(data)) {
            cache.odds.data = data;
            cache.odds.time = now;
            res.json(data);
        } else {
            res.status(400).json({ error: "API hiba" });
        }
    } catch (error) {
        res.status(500).json({ error: "Szerver hiba" });
    }
});

// --- 2. VÉGPONT: Meccslista lekérése (Cache-elt) ---
app.get("/live-matches", async (req, res) => {
    const now = Date.now();
    if (cache.matches.data && (now - cache.matches.time < CACHE_DURATION)) {
        console.log("Meccsek kiszolgálása gyorsítótárból...");
        return res.json(cache.matches.data);
    }

    try {
        const today = new Date();
        const dFrom = new Date(today);
        dFrom.setDate(today.getDate() - 4); 
        const dTo = new Date(today);
        dTo.setDate(today.getDate() + 4); 

        const dateFrom = dFrom.toISOString().split('T')[0];
        const dateTo = dTo.toISOString().split('T')[0];

        const url = `https://api.football-data.org/v4/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`;
        
        const response = await fetch(url, { headers: { "X-Auth-Token": FOOTBALL_DATA_API_KEY } });
        const data = await response.json();

        if (data.matches) {
            cache.matches.data = data;
            cache.matches.time = now;
            console.log(`API frissítve: ${data.matches.length} meccs érkezett.`);
        }
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: "Hiba a meccsek lekérésekor" });
    }
});

// --- HTML ÚTVONALAK ---
app.get(["/", "/home", "/Home"], (req, res) => {
    res.sendFile(path.join(__dirname, "Home.html"), (err) => {
        if (err) res.sendFile(path.join(__dirname, "home.html"));
    });
});

app.get(["/meccsek", "/Meccsek"], (req, res) => {
    res.sendFile(path.join(__dirname, "Meccsek.html"), (err) => {
        if (err) res.sendFile(path.join(__dirname, "meccsek.html"), (err2) => {
            if (err2) res.status(404).send("Hiba: Meccsek.html nem található!");
        });
    });
});

app.get(["/elemzes", "/Elemzes"], (req, res) => {
    res.sendFile(path.join(__dirname, "Elemzes.html"), (err) => {
        if (err) res.sendFile(path.join(__dirname, "elemzes.html"), (err2) => {
            if (err2) res.status(404).send("Hiba: Elemzes.html nem található!");
        });
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Szerver fut a ${PORT} porton.`);
});
