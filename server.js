const express = require("express");
const cors = require("cors");
const path = require("path");
const fetch = require("node-fetch");

// PONTOSÍTÁS: Megadjuk a szervernek, hogy az api.env fájlt keresse
require('dotenv').config({ path: path.resolve(__dirname, 'api.env') });

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));

// --- KULCSOK BEOLVASÁSA A FÁJLODÓL ---
const FOOTBALL_DATA_API_KEY = process.env.FOOTBALL_DATA_API_KEY;
const ODDS_API_KEY = process.env.ODDS_API_KEY;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

const stripe = require('stripe')(STRIPE_SECRET_KEY);

// --- 1. MECCSEK LEKÉRÉSE (A bevált +/- 4 napos logika) ---
app.get("/live-matches", async (req, res) => {
    try {
        const today = new Date();
        const dFrom = new Date(today); dFrom.setDate(today.getDate() - 4);
        const dTo = new Date(today); dTo.setDate(today.getDate() + 4);

        const url = `https://api.football-data.org/v4/matches?dateFrom=${dFrom.toISOString().split('T')[0]}&dateTo=${dTo.toISOString().split('T')[0]}`;
        const response = await fetch(url, { headers: { "X-Auth-Token": FOOTBALL_DATA_API_KEY } });
        const data = await response.json();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: "Hiba a meccsek lekérésekor" });
    }
});

// --- 2. TABELLA / HELYEZÉSEK ---
// Példa: /api/standings/PL (Premier League) vagy /api/standings/PD (La Liga)
app.get("/api/standings/:leagueCode", async (req, res) => {
    try {
        const league = req.params.leagueCode;
        const url = `https://api.football-data.org/v4/competitions/${league}/standings`;
        const response = await fetch(url, { headers: { "X-Auth-Token": FOOTBALL_DATA_API_KEY } });
        const data = await response.json();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: "Hiba a tabella lekérésekor" });
    }
});

// --- 3. ODDS ADATOK ---
app.get('/api/odds-data', async (req, res) => {
    try {
        const url = `https://api.the-odds-api.com/v4/sports/soccer/odds/?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h`;
        const response = await fetch(url);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Hiba az oddsok lekérésekor" });
    }
});

// --- 4. STRIPE TÁMOGATÁS ---
app.post('/create-checkout-session', async (req, res) => {
    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'huf',
                    product_data: { name: 'LuckyPitch Támogatás' },
                    unit_amount: 100000, // 1000 Ft
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `${req.headers.origin}/Home.html?success=true`,
            cancel_url: `${req.headers.origin}/Home.html?cancel=true`,
        });
        res.json({ id: session.id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// HTML útvonalak
app.get(["/", "/home", "/Home"], (req, res) => res.sendFile(path.join(__dirname, "Home.html")));
app.get("/meccsek", (req, res) => res.sendFile(path.join(__dirname, "meccsek.html")));
app.get("/elemzes", (req, res) => res.sendFile(path.join(__dirname, "elemzes.html")));

// PORT beállítása (api.env-ből vagy alapértelmezett 3000)
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 LuckyPitch Szerver ONLINE a ${PORT} porton`);
    console.log(`📁 Konfigurációs fájl: api.env`);
});
