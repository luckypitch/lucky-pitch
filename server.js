// Megadjuk a dotenv-nek a pontos fájlnevet
require('dotenv').config({ path: './api.env' }); 

const express = require("express");
const cors = require("cors");
const path = require("path");
const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');

// Stripe inicializálása a környezeti változóból
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
app.use(express.json()); 
app.use(cors());
app.use(express.static(__dirname));

// --- API KULCSOK ---
const ODDS_API_KEY = process.env.ODDS_API_KEY; 
const FOOTBALL_DATA_API_KEY = process.env.FOOTBALL_DATA_API_KEY;

// Ellenőrzés a konzolon (Indításkor látni fogod, ha valami hiányzik)
if (!process.env.STRIPE_SECRET_KEY || !process.env.CLERK_SECRET_KEY) {
    console.error("❌ HIBA: Hiányzó kulcsok az api.env fájlban!");
}

// --- STRIPE TÁMOGATÁS VÉGPONT ---
app.post('/create-checkout-session', ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'huf',
                    product_data: { 
                        name: 'LuckyPitch Támogatás',
                        description: 'Köszönjük a támogatást!' 
                    },
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

// --- MECCSLISTA VÉGPONT ---
app.get("/live-matches", async (req, res) => {
    try {
        const leagueIds = "PL,PD,BL1,SA1,FL1,CL,EL"; 
        const url = `https://api.football-data.org/v4/matches?competitions=${leagueIds}`;
        
        const response = await fetch(url, { 
            headers: { "X-Auth-Token": FOOTBALL_DATA_API_KEY } 
        });
        const data = await response.json();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: "API hiba" });
    }
});

// HTML útvonalak
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "Home.html")));
app.get("/meccsek", (req, res) => res.sendFile(path.join(__dirname, "meccsek.html")));
app.get("/elemzes", (req, res) => res.sendFile(path.join(__dirname, "elemzes.html")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 LuckyPitch Szerver fut: http://localhost:${PORT}`));
