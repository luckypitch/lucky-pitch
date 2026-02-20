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

app.get("/live-matches", async (req, res) => {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    
    // FONTOS: Csak ezeket a ligákat látja az ingyenes kulcs!
    // PL: Angol, PD: Spanyol, BL1: Német, SA1: Olasz, FL1: Francia, CL: BL, DED: Holland, PPL: Portugál
    const freeLeagues = "PL,PD,BL1,SA1,FL1,CL,DED,PPL,EL"; 

    // A szűrést a competitions paraméterrel kell megadni az ingyenes kulcshoz!
    const url = `https://api.football-data.org/v4/matches?dateFrom=${date}&dateTo=${date}&competitions=${freeLeagues}`;

    try {
        console.log(`Lekérés indítása: ${date}`);
        const response = await fetch(url, { 
            headers: { "X-Auth-Token": FD_KEY } 
        });

        const data = await response.json();

        // Ha hibát dob az API (pl. 429 - túl sok kérés)
        if (data.errorCode) {
            console.error("API hiba:", data.message);
            return res.status(400).json({ matches: [], error: data.message });
        }

        res.json(data);
    } catch (err) {
        res.status(500).json({ matches: [] });
    }
});

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "Home.html")));
app.get("/meccsek", (req, res) => res.sendFile(path.join(__dirname, "meccsek.html")));
app.get("/elemzes", (req, res) => res.sendFile(path.join(__dirname, "elemzes.html")));

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Szerver fut: ${PORT}`));
