require('dotenv').config({ path: './api.env' });
const express = require("express");
const cors = require("cors");
const path = require("path");
const fetch = require('node-fetch');
const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || '');
const app = express();

app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));

const FOOTBALL_DATA_API_KEY = process.env.FOOTBALL_DATA_API_KEY;
const ODDS_API_KEY = process.env.ODDS_API_KEY;

// --- MECCSEK DÁTUM SZERINT ---
app.get("/live-matches", async (req, res) => {
    try {
        const leagueIds = "PL,PD,BL1,SA1,FL1,CL,EL";
        // A kliens küldi a dátumot, ha nem, akkor a mai nap az alapértelmezett
        const date = req.query.date || new Date().toISOString().split('T')[0];
        
        const url = `https://api.football-data.org/v4/matches?competitions=${leagueIds}&dateFrom=${date}&dateTo=${date}`;
        
        const response = await fetch(url, { 
            headers: { "X-Auth-Token": FOOTBALL_DATA_API_KEY } 
        });
        const data = await response.json();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: "Szerver hiba a meccseknél" });
    }
});

// --- ODDS ADATOK AZ ELEMZÉSHEZ ---
app.get('/api/odds-data', ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const response = await fetch(`https://api.the-odds-api.com/v4/sports/soccer/odds/?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Szerver hiba az oddsoknál" });
    }
});

// --- STRIPE ---
app.post('/create-checkout-session', ClerkExpressRequireAuth(), async (req, res) => {
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
            success_url: req.headers.origin + '/?success=true',
            cancel_url: req.headers.origin + '/?cancel=true',
        });
        res.json({ id: session.id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "Home.html")));
app.get("/meccsek", (req, res) => res.sendFile(path.join(__dirname, "meccsek.html")));
app.get("/elemzes", (req, res) => res.sendFile(path.join(__dirname, "elemzes.html")));

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Szerver fut: ${PORT}`));
