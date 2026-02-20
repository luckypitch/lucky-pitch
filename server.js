const express = require("express");
const cors = require("cors");
const path = require("path");
const fetch = require('node-fetch');
require('dotenv').config(); 

const app = express();
app.use(express.json());
app.use(cors());

// Ez a sor gondoskodik róla, hogy a képek, CSS és JS fájlok bárhonnan elérhetőek legyenek
app.use(express.static(path.join(__dirname)));

// --- API VÉGPONTOK ---

app.get("/api/debug", (req, res) => {
    res.json({
        status: "Szerver fut",
        football_key: !!process.env.FOOTBALL_DATA_API_KEY,
        stripe_key: !!process.env.STRIPE_SECRET_KEY,
        current_dir: __dirname
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
        res.status(500).json({ error: "API hiba" });
    }
});

// --- OLDALAK KISZOLGÁLÁSA (Fix útvonalakkal) ---

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "Home.html"));
});

app.get("/meccsek", (req, res) => {
    res.sendFile(path.join(__dirname, "meccsek.html"));
});

app.get("/elemzes", (req, res) => {
    res.sendFile(path.join(__dirname, "elemzes.html"));
});

// Ha bármi mást írnak be, dobja vissza a főoldalra, ne legyen 404
app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "Home.html"));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 LuckyPitch Szerver Elindult! Port: ${PORT}`);
});
