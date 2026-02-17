const express = require("express");
const cors = require("cors");
const path = require("path");

// Fetch támogatás
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

// --- HTML ÚTVONALAK (NAGYBETŰS FÁJLOKHOZ IGAZÍTVA) ---

app.get("/", (req, res) => {
    // Itt most már nagy H-val keressük a Home.html-t
    const filePath = path.join(__dirname, "Home.html");
    res.sendFile(filePath, (err) => {
        if (err) {
            console.error("Hiba a fájl küldésekor:", err.path);
            res.status(404).send(`
                <h1>Hiba: Fájl nem található</h1>
                <p>A szerver nagybetűs <b>Home.html</b> fájlt keresett itt: <b>${err.path}</b></p>
                <p>Ellenőrizd a GitHubon, hogy tényleg nagy <b>H</b>-val van-e!</p>
            `);
        }
    });
});

// Itt is átírtam nagybetűsre a fájlneveket
app.get("/meccsek", (req, res) => res.sendFile(path.join(__dirname, "Meccsek.html")));
app.get("/elemzes", (req, res) => res.sendFile(path.join(__dirname, "Elemzes.html")));

// --- SZERVER INDÍTÁS ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Szerver fut a ${PORT} porton.`);
});
