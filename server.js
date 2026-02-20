require('dotenv').config({ path: './api.env' }); // api.env betöltése
const express = require("express");
const cors = require("cors");
const path = require("path");
const fetch = require('node-fetch'); // Fontos: v2.6.7-nél így kell!
const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');

// Stripe inicializálása - ha nincs kulcs, a szerver ne omoljon össze, csak írja ki
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || '');

const app = express();
app.use(express.json()); 
app.use(cors());
app.use(express.static(__dirname));

// API kulcsok ellenőrzése a logban (Renderen látni fogod a Dashboardon)
console.log("Szerver indulás...");
console.log("Stripe Key megléte:", !!process.env.STRIPE_SECRET_KEY);

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
        console.error("Stripe hiba:", err.message);
        res.status(500).json({ error: err.message });
    }
});

app.get("/live-matches", async (req, res) => {
    try {
        const url = `https://api.football-data.org/v4/matches?competitions=PL,PD,BL1,SA1,FL1,CL,EL`;
        const response = await fetch(url, { 
            headers: { "X-Auth-Token": process.env.FOOTBALL_DATA_API_KEY } 
        });
        const data = await response.json();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: "API hiba" });
    }
});

app.get("/api/odds-data", ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const response = await fetch(`https://api.the-odds-api.com/v4/sports/soccer/odds/?apiKey=${process.env.ODDS_API_KEY}&regions=eu&markets=h2h`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Odds hiba" });
    }
});

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "Home.html")));
app.get("/meccsek", (req, res) => res.sendFile(path.join(__dirname, "meccsek.html")));
app.get("/elemzes", (req, res) => res.sendFile(path.join(__dirname, "elemzes.html")));

// Fontos: Rendernek 0.0.0.0-án kell figyelnie!
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 LuckyPitch Szerver aktív a ${PORT} porton`);
});
