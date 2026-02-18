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

// --- EGYSZERŰ GYORSÍTÓTÁR (CACHE) ---
let cache = { matches: null, standings: {}, lastFetch: 0 };

// --- API HÍVÁSOK ---
app.get("/live-matches", async (req, res) => {
    const now = Date.now();
    // Ha van friss adat (30 mp-en belüli), azt adjuk vissza
    if (cache.matches && (now - cache.lastFetch < 30000)) {
        return res.json(cache.matches);
    }

    try {
        const response = await fetch("https://api.football-data.org/v4/matches", {
            headers: { "X-Auth-Token": API_KEY }
        });
        const data = await response.json();
        cache.matches = data;
        cache.lastFetch = now;
        res.json(data);
    } catch (err) { res.status(500).json({ error: "API hiba" }); }
});

// ÚJ: Tabella végpont (Liga ID alapján, pl. PL = 2021)
app.get("/standings/:leagueId", async (req, res) => {
    const id = req.params.leagueId;
    try {
        const response = await fetch(`https://api.football-data.org/v4/competitions/${id}/standings`, {
            headers: { "X-Auth-Token": API_KEY }
        });
        const data = await response.json();
        res.json(data);
    } catch (err) { res.status(500).json({ error: "Hiba a tabella lekérésekor" }); }
});

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "Home.html")));
app.get("/meccsek", (req, res) => res.sendFile(path.join(__dirname, "Meccsek.html")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => console.log(`Fut: ${PORT}`));
