const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();
app.use(cors());
app.use(express.static(__dirname));

const FOOTBALL_DATA_API_KEY = "1f931344560e4ddc9103eff9281d435b";

// --- SEGÉDFÜGGVÉNY: Intelligens fájlkiszolgálás ---
const serveFile = (res, fileName) => {
    const possibleNames = [
        fileName,
        fileName.toLowerCase(),
        fileName.charAt(0).toUpperCase() + fileName.slice(1).toLowerCase()
    ];
    for (const name of possibleNames) {
        const filePath = path.join(__dirname, name);
        if (fs.existsSync(filePath)) return res.sendFile(filePath);
    }
    res.status(404).send(`Hiba: A ${fileName} nem található.`);
};

// --- API VÉGPONTOK ---
app.get("/live-matches", async (req, res) => {
    // Letiltjuk a gyorsítótárazást, hogy real-time adatokat kapjunk
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    try {
        const today = new Date();
        const dFrom = new Date(today); dFrom.setDate(today.getDate() - 2);
        const dTo = new Date(today); dTo.setDate(today.getDate() + 4); 
        
        const url = `https://api.football-data.org/v4/matches?dateFrom=${dFrom.toISOString().split("T")[0]}&dateTo=${dTo.toISOString().split("T")[0]}`;
        const response = await fetch(url, { 
            headers: { "X-Auth-Token": FOOTBALL_DATA_API_KEY },
            cache: "no-store" 
        });
        const data = await response.json();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: "Szerver hiba az API hívásnál" });
    }
});

app.get("/match-details/:id", async (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    try {
        const response = await fetch(`https://api.football-data.org/v4/matches/${req.params.id}`, {
            headers: { "X-Auth-Token": FOOTBALL_DATA_API_KEY }
        });
        const data = await response.json();
        res.json(data);
    } catch (err) { res.status(500).json({ error: "Hiba" }); }
});

// --- ÚTVONALAK ---
app.get("/", (req, res) => serveFile(res, "Home.html"));
app.get("/meccsek", (req, res) => serveFile(res, "Meccsek.html"));
app.get("/elemzes", (req, res) => serveFile(res, "Elemzes.html"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`LuckyPitch fut a ${PORT} porton.`);
});
