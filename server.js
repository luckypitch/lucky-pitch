const express = require("express");
const cors = require("cors");
const path = require("path");
const fetch = require("node-fetch");

// Itt mondjuk meg neki, hogy az api.env fájlt használja!
require('dotenv').config({ path: path.resolve(__dirname, 'api.env') });

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));

// --- API KULCSOK ---
const FOOTBALL_DATA_API_KEY = process.env.FOOTBALL_DATA_API_KEY;
const ODDS_API_KEY = process.env.ODDS_API_KEY;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

const stripe = require('stripe')(STRIPE_SECRET_KEY);

// --- FUNKCIÓK ---

// 1. Meccsek +/- 4 nap (Ami már működik)
app.get("/live-matches", async (req, res) => {
    try {
        const today = new Date();
        const dFrom = new Date(today); dFrom.setDate(today.getDate() - 4);
        const dTo = new Date(today); dTo.setDate(today.getDate() + 4);
        const url = `https://api.football-data.org/v4/matches?dateFrom=${dFrom.toISOString().split('T')[0]}&dateTo=${dTo.toISOString().split('T')[0]}`;
        const response = await fetch(url, { headers: { "X-Auth-Token": FOOTBALL_DATA_API_KEY } });
        const data = await response.json();
        res.json(data);
    } catch (err) { res.status(500).json({ error: "Meccs hiba" }); }
});

// 2. Tabella (Standings) funkció
// Példa hívás: /api/standings/PL (Premier League)
app.get("/api/standings/:leagueCode", async (req, res) => {
    try {
        const league = req.params.leagueCode;
        const url = `https://api.football-data.org/v4/competitions/${league}/standings`;
        const response = await fetch(url, { headers: { "X-Auth-Token": FOOTBALL_DATA_API_KEY } });
        const data = await response.json();
        res.json(data);
    } catch (err) { res.status(500).json({ error: "Tabella hiba" }); }
});

// 3. Oddsok funkció
app.get('/api/odds-data', async (req, res) => {
    try {
        const url = `https://api.the-odds-api.com/v4/sports/soccer/odds/?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h`;
        const response = await fetch(url);
        const data = await response.json();
        res.json(data);
    } catch (error) { res.status(500).json({ error: "Odds hiba" }); }
});

// 4. Stripe Támogatás
app.post('/create-checkout-session', async (req, res) => {
    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'huf',
                    product_data: { name: 'LuckyPitch Támogatás' },
                    unit_amount: 100000,
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `${req.headers.origin}/Home.html?success=true`,
            cancel_url: `${req.headers.origin}/Home.html?cancel=true`,
        });
        res.json({ id: session.id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get(["/", "/home"], (req, res) => res.sendFile(path.join(__dirname, "Home.html")));
app.get("/meccsek", (req, res) => res.sendFile(path.join(__dirname, "meccsek.html")));
app.get("/elemzes", (req, res) => res.sendFile(path.join(__dirname, "elemzes.html")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Szerver ONLINE (api.env használatával) a ${PORT} porton`);
});
