const express = require("express");
const cors = require("cors");
const path = require("path");
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// Minden fájlt (képek, html) kiszolgálunk a főkönyvtárból
app.use(express.static(__dirname));

// --- API: DEBUG (Hogy lásd, él-e a szerver) ---
app.get("/api/test", (req, res) => {
    res.json({ 
        üzenet: "A szerver él és mozog!",
        football_kulcs: !!process.env.FOOTBALL_DATA_API_KEY,
        stripe_kulcs: !!process.env.STRIPE_SECRET_KEY
    });
});

// --- API: MECCSEK ---
app.get("/live-matches", async (req, res) => {
    const FD_KEY = process.env.FOOTBALL_DATA_API_KEY;
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const url = `https://api.football-data.org/v4/matches?dateFrom=${date}&dateTo=${date}`;

    try {
        const response = await fetch(url, { headers: { "X-Auth-Token": FD_KEY } });
        const data = await response.json();
        res.json(data);
    } catch (err) {
        res.status(500).json({ matches: [], hiba: "API hiba történt" });
    }
});

// --- OLDALAK ÚTVONALAI ---
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "Home.html")));
app.get("/meccsek", (req, res) => res.sendFile(path.join(__dirname, "meccsek.html")));
app.get("/elemzes", (req, res) => res.sendFile(path.join(__dirname, "elemzes.html")));

// --- PORT BEÁLLÍTÁS ---
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 LuckyPitch elindult a ${PORT} porton!`);
});
