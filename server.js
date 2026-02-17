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

// --- HTML ÚTVONALAK (MINDENRE FELKÉSZÍTVE) ---

// FŐOLDAL
app.get(["/", "/home", "/Home"], (req, res) => {
    // Megpróbálja a nagybetűset, ha nem találja, a kisbetűset
    res.sendFile(path.join(__dirname, "Home.html"), (err) => {
        if (err) res.sendFile(path.join(__dirname, "home.html"));
    });
});

// MECCSEK OLDAL
app.get(["/meccsek", "/Meccsek"], (req, res) => {
    res.sendFile(path.join(__dirname, "Meccsek.html"), (err) => {
        if (err) res.sendFile(path.join(__dirname, "meccsek.html"), (err2) => {
            if (err2) res.status(404).send("Hiba: Sem Meccsek.html, sem meccsek.html nem található a GitHubon!");
        });
    });
});

// ELEMZÉS OLDAL
app.get(["/elemzes", "/Elemzes"], (req, res) => {
    res.sendFile(path.join(__dirname, "Elemzes.html"), (err) => {
        if (err) res.sendFile(path.join(__dirname, "elemzes.html"), (err2) => {
            if (err2) res.status(404).send("Hiba: Sem Elemzes.html, sem elemzes.html nem található!");
        });
    });
});

// --- SZERVER INDÍTÁS ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Szerver fut a ${PORT} porton.`);
});

