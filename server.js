const express = require("express");
const cors = require("cors");
const path = require("path");
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// Kiszolgáljuk a statikus fájlokat
app.use(express.static(__dirname));

// --- EZ A RÉSZ KELL AZ /api/status-hoz ---
app.get("/api/status", (req, res) => {
    res.status(200).json({
        status: "Szerver él!",
        football_key: !!process.env.FOOTBALL_DATA_API_KEY,
        stripe_key: !!process.env.STRIPE_SECRET_KEY
    });
});

app.get("/live-matches", async (req, res) => {
    const FD_KEY = process.env.FOOTBALL_DATA_API_KEY;
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const url = `https://api.football-data.org/v4/matches?dateFrom=${date}&dateTo=${date}`;
    try {
        const response = await fetch(url, { headers: { "X-Auth-Token": FD_KEY } });
        const data = await response.json();
        res.json(data);
    } catch (err) {
        res.status(500).json({ matches: [] });
    }
});

// Útvonalak a HTML fájlokhoz
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "Home.html")));
app.get("/meccsek", (req, res) => res.sendFile(path.join(__dirname, "meccsek.html")));
app.get("/elemzes", (req, res) => res.sendFile(path.join(__dirname, "elemzes.html")));

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Szerver elindult a ${PORT} porton`);
});
