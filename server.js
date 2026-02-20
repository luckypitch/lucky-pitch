const express = require("express");
const cors = require("cors");
const path = require("path");
const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');

// Fetch támogatás (Node 18+ esetén beépített, de a kompatibilitás miatt importáljuk)
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();

// --- CLERK KONFIGURÁCIÓ ---
// Fontos: A Secret Key-t a process.env-be kényszerítjük, hogy az SDK lássa
process.env.CLERK_SECRET_KEY = 'sk_test_kjOIJA4piJNFfv5tLLEf7whRac65Nu5XmOTTstnJ7X';
const CLERK_PUBLISHABLE_KEY = 'pk_test_YWxsb3dlZC1pbnNlY3QtOTguY2xlcmsuYWNjb3VudHMuZGV2JA';

app.use(cors());
app.use(express.static(__dirname));

// --- API KULCSOK ---
const ODDS_API_KEY = '17b18da5d210a284be65b75933b24f9e'; 
const FOOTBALL_DATA_API_KEY = "1f931344560e4ddc9103eff9281d435b";

// --- 1. VÉGPONT: Odds adatok lekérése (VÉDETT) ---
// Csak bejelentkezett felhasználók kapják meg az elemzési adatokat
app.get('/api/odds-data', ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const response = await fetch(`https://api.the-odds-api.com/v4/sports/soccer/odds/?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h&bookmakers=unibet,betfair_ex,williamhill,888sport`);
        const data = await response.json();
        
        if (!Array.isArray(data)) {
            return res.status(400).json({ error: "API hiba az Odds-nál" });
        }
        res.json(data);
    } catch (error) {
        console.error("Odds hiba:", error);
        res.status(500).json({ error: "Szerver hiba az oddsok lekérésekor" });
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
        res.status(500).json({ error: "Hiba a meccsek lekérésekor" });
    }
});

// --- 3. VÉGPONT: Tabella lekérése ---
app.get("/standings/:leagueId", async (req, res) => {
    try {
        const leagueId = req.params.leagueId;
        const response = await fetch(`https://api.football-data.org/v4/competitions/${leagueId}/standings`, {
            headers: { "X-Auth-Token": FOOTBALL_DATA_API_KEY }
        });
        const data = await response.json();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: "Hiba a tabella lekérésekor" });
    }
});

// --- HTML Útvonalak ---
app.get(["/", "/home", "/Home"], (req, res) => res.sendFile(path.join(__dirname, "Home.html")));
app.get("/meccsek", (req, res) => res.sendFile(path.join(__dirname, "meccsek.html")));
app.get("/elemzes", (req, res) => res.sendFile(path.join(__dirname, "elemzes.html")));

// --- Clerk hiba kezelése ---
// Ha valaki nincs belépve, de védett végpontot hív meg
app.use((err, req, res, next) => {
  if (err.message === 'Unauthenticated') {
    res.status(401).json({ error: "Kérlek, jelentkezz be a tartalom megtekintéséhez!" });
  } else {
    console.error("Váratlan hiba:", err);
    next(err);
  }
});

// --- Indítás ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 LuckyPitch Szerver sikeresen elindult a ${PORT}-as porton`);
});
