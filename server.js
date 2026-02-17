const express = require("express");
const cors = require("cors");
const path = require("path");

// Fetch támogatás (Node 18+ alatt alapból van, de így a legbiztosabb)
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();

// Beállítások
app.use(cors());
app.use(express.static(__dirname));

// --- API KULCSOK ---
const ODDS_API_KEY = '17b18da5d210a284be65b75933b24f9e'; 
const FOOTBALL_DATA_API_KEY = "1f931344560e4ddc9103eff9281d435b";

// --- API VÉGPONTOK ---
app.get('/api/odds-data', async (req, res) => {
    try {
        const response = await fetch(`https://api.the-odds-api.com/v4/sports/soccer/odds/?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h&bookmakers=unibet,betfair_ex,williamhill,888sport`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "API hiba az oddsoknál" });
    }
});

app.get("/live-matches", async (req, res) => {
    try {
        const url = `https://api.football-data.org/v4/matches`;
        const response = await fetch(url, { headers: { "X-Auth-Token": FOOTBALL_DATA_API_KEY } });
        const data = await response.json();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: "API hiba a meccseknél" });
    }
});

// --- HTML ÚTVONALAK (JAVÍTOTT HIBAKEZELÉSSEL) ---

app.get("/", (req, res) => {
    // Próbáld meg a home.html-t (kisbetűvel)
    const filePath = path.join(__dirname, "home.html");
    res.sendFile(filePath, (err) => {
        if (err) {
            console.error("Hiba a fájl küldésekor:", err.path);
            res.status(404).send(`
                <h1>Hiba: Fájl nem található</h1>
                <p>A szerver keresi a fájlt, de nem találja itt: <b>${err.path}</b></p>
                <p>Ellenőrizd, hogy a GitHubon a fájl neve pontosan <b>home.html</b> (kisbetűvel)!</p>
            `);
        }
    });
});

app.get("/meccsek", (req, res) => res.sendFile(path.join(__dirname, "meccsek.html")));
app.get("/elemzes", (req, res) => res.sendFile(path.join(__dirname, "elemzes.html")));

// --- SZERVER INDÍTÁS ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Szerver fut a ${PORT} porton.`);
});
