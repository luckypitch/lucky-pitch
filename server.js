const express = require("express");
const cors = require("cors");
const path = require("path");
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));

// --- API: MECCSEK LEKÉRÉSE ---
app.get("/live-matches", async (req, res) => {
    const FD_KEY = process.env.FOOTBALL_DATA_API_KEY;
    const date = req.query.date || new Date().toISOString().split('T')[0];
    
    // Ingyenes ligák, amiket a kulcsod biztosan lát
    const leagues = "PL,PD,BL1,SA1,FL1,CL"; 
    const url = `https://api.football-data.org/v4/matches?dateFrom=${date}&dateTo=${date}&competitions=${leagues}`;

    try {
        const response = await fetch(url, { 
            headers: { "X-Auth-Token": FD_KEY } 
        });
        const data = await response.json();

        // --- TESZT FUNKCIÓ (Ha az API üres, küldünk egy kamu meccset, hogy lásd a működést) ---
        if (!data.matches || data.matches.length === 0) {
            return res.json({
                matches: [{
                    id: 1,
                    homeTeam: { name: "API Teszt Csapat A", crest: "https://crests.football-data.org/64.png" },
                    awayTeam: { name: "API Teszt Csapat B", crest: "https://crests.football-data.org/65.png" },
                    score: { fullTime: { home: 1, away: 2 } }
                }],
                note: "Ez egy teszt meccs, mert az API kulcsod épp nem ad adatot."
            });
        }

        res.json(data);
    } catch (err) {
        res.status(500).json({ matches: [], error: "Szerver hiba" });
    }
});

// --- OLDALAK ---
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "Home.html")));
app.get("/meccsek", (req, res) => res.sendFile(path.join(__dirname, "meccsek.html")));
app.get("/elemzes", (req, res) => res.sendFile(path.join(__dirname, "elemzes.html")));

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Szerver fut: ${PORT}`));
