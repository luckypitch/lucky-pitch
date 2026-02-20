const express = require("express");
const cors = require("cors");
const path = require("path");
const fetch = require('node-fetch');
const fs = require('fs');

if (fs.existsSync('./api.env')) {
    require('dotenv').config({ path: './api.env' });
} else {
    require('dotenv').config();
}

const FD_KEY = process.env.FOOTBALL_DATA_API_KEY;
const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));

// TESZT VÉGPONT - Ha ezt megnyitod a böngészőben: luckypitch.onrender.com/test
app.get("/test", (req, res) => {
    res.json({ message: "Szerver él!", key_hossz: FD_KEY ? FD_KEY.length : 0 });
});

app.get("/live-matches", async (req, res) => {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    // Ezek az ingyenesen elérhető ligák kódjai
    const freeLeagues = "PL,PD,BL1,SA1,FL1,CL,DED,PPL,EL"; 
    const url = `https://api.football-data.org/v4/matches?dateFrom=${date}&dateTo=${date}&competitions=${freeLeagues}`;

    console.log(`>>> LOG: Lekérés érkezett! Dátum: ${date}`);

    try {
        const response = await fetch(url, { 
            headers: { "X-Auth-Token": FD_KEY } 
        });

        const data = await response.json();
        console.log(`>>> LOG: API válasz érkezett, meccsek száma: ${data.matches ? data.matches.length : 0}`);

        if (data.errorCode) {
            console.error(">>> LOG: API HIBA:", data.message);
            return res.status(400).json(data);
        }

        res.json(data);
    } catch (err) {
        console.error(">>> LOG: SZERVER HIBA:", err.message);
        res.status(500).json({ error: "Szerver hiba" });
    }
});

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "Home.html")));
app.get("/meccsek", (req, res) => res.sendFile(path.join(__dirname, "meccsek.html")));
app.get("/elemzes", (req, res) => res.sendFile(path.join(__dirname, "elemzes.html")));

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Szerver fut a ${PORT} porton`));
