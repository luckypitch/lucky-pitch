const express = require("express");
const cors = require("cors");
const path = require("path");
const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');

const app = express();
app.use(cors());
app.use(express.static(__dirname));

// API Kulcsok
const ODDS_API_KEY = '17b18da5d210a284be65b75933b24f9e'; 
const FOOTBALL_DATA_API_KEY = "1f931344560e4ddc9103eff9281d435b";

// Odds végpont - VÉDETT
app.get('/api/odds-data', ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const fetch = (await import('node-fetch')).default; // Dinamikus import a hiba elkerülésére
        const response = await fetch(`https://api.the-odds-api.com/v4/sports/soccer/odds/?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h&bookmakers=unibet,betfair_ex,williamhill,888sport`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Hiba az oddsok lekérésekor" });
    }
});

// Meccslista végpont
app.get("/live-matches", async (req, res) => {
    try {
        const fetch = (await import('node-fetch')).default;
        const today = new Date();
        const dateFrom = new Date(today.setDate(today.getDate() - 4)).toISOString().split('T')[0];
        const dateTo = new Date(new Date().setDate(new Date().getDate() + 4)).toISOString().split('T')[0];

        const url = `https://api.football-data.org/v4/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`;
        const response = await fetch(url, { headers: { "X-Auth-Token": FOOTBALL_DATA_API_KEY } });
        const data = await response.json();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: "Hiba a meccseknél" });
    }
});

// Tabella végpont
app.get("/standings/:leagueId", async (req, res) => {
    try {
        const fetch = (await import('node-fetch')).default;
        const response = await fetch(`https://api.football-data.org/v4/competitions/${req.params.leagueId}/standings`, {
            headers: { "X-Auth-Token": FOOTBALL_DATA_API_KEY }
        });
        const data = await response.json();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: "Hiba a tabellánál" });
    }
});

// HTML útvonalak
app.get(["/", "/home", "/Home"], (req, res) => res.sendFile(path.join(__dirname, "Home.html")));
app.get("/meccsek", (req, res) => res.sendFile(path.join(__dirname, "meccsek.html")));
app.get("/elemzes", (req, res) => res.sendFile(path.join(__dirname, "elemzes.html")));

// Clerk hiba kezelés
app.use((err, req, res, next) => {
    if (err.message === 'Unauthenticated') {
        res.status(401).json({ error: 'Bejelentkezés szükséges!' });
    } else {
        next(err);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 LuckyPitch Szerver fut: ${PORT}`));
