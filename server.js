// 1. Biztonságos dotenv betöltés
const fs = require('fs');
const path = require('path');

if (fs.existsSync('./api.env')) {
    require('dotenv').config({ path: './api.env' });
    console.log("✅ api.env fájl betöltve.");
} else {
    require('dotenv').config(); // Alapértelmezett .env vagy környezeti változók
    console.log("ℹ️ api.env nem található, környezeti változók használata.");
}

const express = require("express");
const cors = require("cors");
const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');

// 2. Stripe ellenőrzése
if (!process.env.STRIPE_SECRET_KEY) {
    console.error("❌ HIBA: STRIPE_SECRET_KEY hiányzik!");
}
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// 3. Fetch támogatás
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
app.use(express.json()); 
app.use(cors());
app.use(express.static(__dirname));

// --- API KULCSOK ---
const ODDS_API_KEY = process.env.ODDS_API_KEY; 
const FOOTBALL_DATA_API_KEY = process.env.FOOTBALL_DATA_API_KEY;

// --- ÚTVONALAK ---
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

app.get("/live-matches", async (req, res) => {
    try {
        const url = `https://api.football-data.org/v4/matches?competitions=PL,PD,BL1,SA1,FL1,CL,EL`;
        const response = await fetch(url, { headers: { "X-Auth-Token": FOOTBALL_DATA_API_KEY } });
        const data = await response.json();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: "API hiba" });
    }
});

app.get("/api/odds-data", ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const response = await fetch(`https://api.the-odds-api.com/v4/sports/soccer/odds/?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Odds hiba" });
    }
});

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "Home.html")));
app.get("/meccsek", (req, res) => res.sendFile(path.join(__dirname, "meccsek.html")));
app.get("/elemzes", (req, res) => res.sendFile(path.join(__dirname, "elemzes.html")));

// Alapértelmezett port kezelés Renderhez
const PORT = process.env.PORT || 10000; 
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Szerver fut a ${PORT} porton`);
});
