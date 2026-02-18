const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

// Fontos: a fetch kezelése, hogy ne legyen hiba a környezetben
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();
app.use(cors());
app.use(express.static(__dirname));

const FOOTBALL_DATA_API_KEY = "1f931344560e4ddc9103eff9281d435b";

// --- API VÉGPONTOK ---
app.get("/live-matches", async (req, res) => {
    try {
        const today = new Date();
        const dFrom = new Date(today); dFrom.setDate(today.getDate() - 2);
        const dTo = new Date(today); dTo.setDate(today.getDate() + 4); 

        const url = `https://api.football-data.org/v4/matches?dateFrom=${dFrom.toISOString().split("T")[0]}&dateTo=${dTo.toISOString().split("T")[0]}`;
        const response = await fetch(url, { headers: { "X-Auth-Token": FOOTBALL_DATA_API_KEY } });
        const data = await response.json();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: "API hiba" });
    }
});

app.get("/match-details/:id", async (req, res) => {
    try {
        const response = await fetch(`https://api.football-data.org/v4/matches/${req.params.id}`, {
            headers: { "X-Auth-Token": FOOTBALL_DATA_API_KEY }
        });
        const data = await response.json();
        res.json(data);
    } catch (err) { res.status(500).json({ error: "Hiba" }); }
});

// --- EGYSZERŰSÍTETT ÚTVONALAK A DEPLOYHOZ ---
// Ha a fenti sendFileSafe bonyolult volt, használjuk ezt a direkt módszert:

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "Home.html"));
});

app.get("/meccsek", (req, res) => {
    res.sendFile(path.join(__dirname, "Meccsek.html"));
});

app.get("/elemzes", (req, res) => {
    res.sendFile(path.join(__dirname, "Elemzes.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`LuckyPitch fut a ${PORT} porton.`);
});
