const express = require("express");
const cors = require("cors");
const path = require("path");

// Node-fetch importálása, hogy régebbi Node verziókon is menjen a fetch
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();

// Middleware-ek
app.use(cors());
// Kiszolgálja a statikus fájlokat (képek, CSS, JS) a gyökérmappából
app.use(express.static(__dirname));

// --- API KULCSOK ---
const ODDS_API_KEY = '17b18da5d210a284be65b75933b24f9e'; 
const FOOTBALL_DATA_API_KEY = "1f931344560e4ddc9103eff9281d435b";

// --- 1. VÉGPONT: Odds adatok lekérése ---
app.get('/api/odds-data', async (req, res) => {
    try {
        const response = await fetch(`https://api.the-odds-api.com/v4/sports/soccer/odds/?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h&bookmakers=unibet,betfair_ex,williamhill,888sport`);
        const data = await response.json();
        
        if (!Array.isArray(data)) {
            return res.status(400).json({ error: "API hiba az Odds letöltésekor" });
        }
        res.json(data);
    } catch (error) {
        console.error("Odds hiba:", error);
        res.status(500).json({ error: "Szerver hiba az odds lekérésekor" });
    }
});

// --- 2. VÉGPONT: Meccslista lekérése ---
app.get("/live-matches", async (req, res) => {
    try {
        const today = new Date();
        const dFrom = new Date(today);
        dFrom.setDate(today.getDate() - 4); 
        const dTo = new Date(today);
        dTo.setDate(today.getDate() + 4); 

        const dateFrom = dFrom.toISOString().split('T')[0];
        const dateTo = dTo.toISOString().split('T')[0];

        const url = `https://api.football-data.org/v4/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`;
        
        const response = await fetch(url, { 
            headers: { "X-Auth-Token": FOOTBALL_DATA_API_KEY } 
        });
        const data = await response.json();
        res.json(data);
    } catch (err) {
        console.error("Meccs hiba:", err);
        res.status(500).json({ error: "Hiba a meccsek lekérésekor" });
    }
});

// --- HTML Útvonalak (Kisbetűs fájlnevekhez igazítva) ---
app.get(["/", "/home", "/Home"], (req, res) => {
    res.sendFile(path.join(__dirname, "home.html"));
});

app.get("/meccsek", (req, res) => {
    res.sendFile(path.join(__dirname, "meccsek.html"));
});

app.get("/elemzes", (req, res) => {
    res.sendFile(path.join(__dirname, "elemzes.html"));
});

// --- Indítás (Render specifikus beállítás) ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Szerver sikeresen elindult a ${PORT} porton.`);
});
