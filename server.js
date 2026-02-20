const fs = require('fs');
const path = require('path');
const express = require("express");
const cors = require("cors");
const fetch = require('node-fetch');
const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');

// --- KÖRNYEZETI VÁLTOZÓK ---
// Megnézzük a GitHub-on lévő api.env fájlt
if (fs.existsSync('./api.env')) {
    require('dotenv').config({ path: './api.env' });
} else {
    require('dotenv').config();
}

const FD_KEY = process.env.FOOTBALL_DATA_API_KEY;
const ODDS_KEY = process.env.ODDS_API_KEY;
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || '');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));

// --- API: MECCSEK (Dátum szűréssel) ---
app.get("/live-matches", async (req, res) => {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    // Az összes ingyenes liga: PL, PD (La Liga), BL1 (Bundesliga), SA1 (Serie A), FL1 (Ligue 1), CL (BL)
    const url = `https://api.football-data.org/v4/matches?dateFrom=${date}&dateTo=${date}`;

    try {
        const response = await fetch(url, { 
            headers: { "X-Auth-Token": FD_KEY } 
        });
        const data = await response.json();
        
        if (!data.matches) {
            console.log("Nincs matches mező az API válaszban");
            return res.json({ matches: [] });
        }
        res.json(data);
    } catch (err) {
        res.status(500).json({ matches: [], error: "API hiba" });
    }
});

// --- API: ODDS ---
app.get('/api/odds-data', ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const url = `https://api.the-odds-api.com/v4/sports/soccer/odds/?apiKey=${ODDS_KEY}&regions=eu&markets=h2h`;
        const response = await fetch(url);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Odds hiba" });
    }
});

// Útvonalak
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "Home.html")));
app.get("/meccsek", (req, res) => res.sendFile(path.join(__dirname, "meccsek.html")));
app.get("/elemzes", (req, res) => res.sendFile(path.join(__dirname, "elemzes.html")));

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Szerver fut a ${PORT} porton`));
