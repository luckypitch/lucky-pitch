require('dotenv').config({ path: './api.env' });
const express = require("express");
const cors = require("cors");
const path = require("path");
const fetch = require('node-fetch');
const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));

// --- API KULCSOK ELLENŐRZÉSE ---
const FD_KEY = process.env.FOOTBALL_DATA_API_KEY;
console.log("Szerver indul: FD_KEY hossza:", FD_KEY ? FD_KEY.length : "HIÁNYZIK!");

app.get("/live-matches", async (req, res) => {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const url = `https://api.football-data.org/v4/matches?dateFrom=${date}&dateTo=${date}`;

    try {
        console.log(`Lekérés: ${url}`);
        const response = await fetch(url, { 
            headers: { "X-Auth-Token": FD_KEY } 
        });

        if (response.status === 403) {
            console.error("403 Hiba: Az API kulcsod érvénytelen vagy nincs előfizetésed.");
            return res.status(403).json({ matches: [], error: "Érvénytelen API kulcs" });
        }

        const data = await response.json();
        
        // Ha az API nem küld 'matches' tömböt, küldünk egy üreset mi
        if (!data.matches) {
            console.log("API válasz matches nélkül:", data);
            return res.json({ matches: [] });
        }

        console.log(`Sikeres lekérés: ${data.matches.length} meccs találva.`);
        res.json(data);

    } catch (err) {
        console.error("Szerver hiba a lekéréskor:", err.message);
        res.status(500).json({ matches: [], error: err.message });
    }
});

// A többi útvonal változatlan...
app.get("/api/odds-data", ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const response = await fetch(`https://api.the-odds-api.com/v4/sports/soccer/odds/?apiKey=${process.env.ODDS_API_KEY}&regions=eu&markets=h2h`);
        const data = await response.json();
        res.json(data || []);
    } catch (e) { res.json([]); }
});

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "Home.html")));
app.get("/meccsek", (req, res) => res.sendFile(path.join(__dirname, "meccsek.html")));
app.get("/elemzes", (req, res) => res.sendFile(path.join(__dirname, "elemzes.html")));

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Szerver fut: ${PORT}`));
