const express = require("express");
const cors = require("cors");
const path = require("path");
const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');
// Stripe inicializálása a megadott Secret Key-vel
const stripe = require('stripe')('sk_test_51T2qaQQkKVs47hkTkMsnipcp3GKHA0MviJdS179eEpwULDffM4BQlS1zNdTgpQG8LrAkADhKP6wURwj3B1Hp2HQV00yaXzJpID');

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
app.use(express.json()); 
app.use(cors());
app.use(express.static(__dirname));

// --- CLERK ÉS API KULCSOK ---
process.env.CLERK_SECRET_KEY = 'sk_test_kjOIJA4piJNFfv5tLLEf7whRac65Nu5XmOTTstnJ7X';
const ODDS_API_KEY = '17b18da5d210a284be65b75933b24f9e'; 
const FOOTBALL_DATA_API_KEY = "1f931344560e4ddc9103eff9281d435b";

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
                        description: 'Köszönjük, hogy segíted a LuckyPitch fejlesztését!' 
                    },
                    unit_amount: 100000, // 1000 Ft
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: req.headers.origin + '/?success=true',
            cancel_url: req.headers.origin + '/?cancel=true',
        });
        res.json({ id: session.id });
    } catch (err) {
        console.error("Stripe hiba a szerveren:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// --- EGYÉB API VÉGPONTOK ---
app.get('/api/odds-data', ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const response = await fetch(`https://api.the-odds-api.com/v4/sports/soccer/odds/?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h&bookmakers=unibet,betfair_ex,williamhill,888sport`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Szerver hiba" });
    }
});

app.get("/live-matches", async (req, res) => {
    try {
        const url = `https://api.football-data.org/v4/matches`;
        const response = await fetch(url, { headers: { "X-Auth-Token": FOOTBALL_DATA_API_KEY } });
        const data = await response.json();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: "Hiba" });
    }
});

// HTML útvonalak
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "Home.html")));
app.get("/meccsek", (req, res) => res.sendFile(path.join(__dirname, "meccsek.html")));
app.get("/elemzes", (req, res) => res.sendFile(path.join(__dirname, "elemzes.html")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 LuckyPitch Szerver fut a ${PORT} porton`));
