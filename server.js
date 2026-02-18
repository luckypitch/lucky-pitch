const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();
app.use(cors());
app.use(express.static(__dirname));

const API_KEY = "1f931344560e4ddc9103eff9281d435b";

// --- BIZTONSÁGOS FÁJL KISZOLGÁLÁS ---
const sendFileSafe = (res, fileName) => {
    // Megnézzük kisbetűvel és nagybetűvel is
    const paths = [
        path.join(__dirname, fileName),
        path.join(__dirname, fileName.toLowerCase()),
        path.join(__dirname, fileName.charAt(0).toUpperCase() + fileName.slice(1))
    ];

    for (let p of paths) {
        if (fs.existsSync(p)) {
            return res.sendFile(p);
        }
    }
    res.status(404).send(`Hiba: ${fileName} nem található! Ellenőrizd a fájlnevet a mappádban.`);
};

// --- API ÉS CACHE ---
let cache = { matches: null, lastFetch: 0 };

app.get("/live-matches", async (req, res) => {
    const now = Date.now();
    if (cache.matches && (now - cache.lastFetch < 30000)) return res.json(cache.matches);

    try {
        const response = await fetch("https://api.football-data.org/v4/matches", {
            headers: { "X-Auth-Token": API_KEY }
        });
        cache.matches = await response.json();
        cache.lastFetch = now;
        res.json(cache.matches);
    } catch (err) { res.status(500).json({ error: "API hiba" }); }
});

app.get("/standings/:leagueId", async (req, res) => {
    try {
        const response = await fetch(`https://api.football-data.org/v4/competitions/${req.params.leagueId}/standings`, {
            headers: { "X-Auth-Token": API_KEY }
        });
        res.json(await response.json());
    } catch (err) { res.status(500).json({ error: "Hiba" }); }
});

// --- ÚTVONALAK ---
app.get("/", (req, res) => sendFileSafe(res, "Home.html"));
app.get("/meccsek", (req, res) => sendFileSafe(res, "Meccsek.html"));
app.get("/elemzes", (req, res) => sendFileSafe(res, "Elemzes.html"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => console.log(`Szerver fut a ${PORT} porton`));
