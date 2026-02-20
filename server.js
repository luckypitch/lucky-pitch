const express = require("express");
const cors = require("cors");
const path = require("path");
const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');
const stripe = require('stripe')('sk_test_51...ITT_A_TE_STRIPE_SECRET_KULCSOD'); // Stripe Secret Key

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
app.use(express.json()); // Kell a Stripe-hoz
app.use(cors());
app.use(express.static(__dirname));

// --- CLERK KONFIGURÁCIÓ ---
process.env.CLERK_SECRET_KEY = 'sk_test_kjOIJA4piJNFfv5tLLEf7whRac65Nu5XmOTTstnJ7X';

const ODDS_API_KEY = '17b18da5d210a284be65b75933b24f9e'; 
const FOOTBALL_DATA_API_KEY = "1f931344560e4ddc9103eff9281d435b";

// --- 1. VÉGPONT: STRIPE TÁMOGATÁS (VÉDETT) ---
app.post('/create-checkout-session', ClerkExpressRequireAuth(), async (req, res) => {
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
            // Itt a saját Render-es címedet add meg!
            success_url: req.headers.origin + '/?success=true',
            cancel_url: req.headers.origin + '/?cancel=true',
        });
        res.json({ id: session.id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 2. VÉGPONT: Odds adatok lekérése (VÉDETT) ---
app.get('/api/odds-data', ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const response = await fetch(`https://api.the-odds-api.com/v4/sports/soccer/odds/?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h&bookmakers=unibet,betfair_ex,williamhill,888sport`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Szerver hiba" });
    }
});

// --- 3. VÉGPONT: Meccslista lekérése ---
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

// --- 4. VÉGPONT: Tabella lekérése ---
app.get("/standings/:leagueId", async (req, res) => {
    try {
        const response = await fetch(`https://api.football-data.org/v4/competitions/${req.params.leagueId}/standings`, {
            headers: { "X-Auth-Token": FOOTBALL_DATA_API_KEY }
        });
        const data = await response.json();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: "Hiba" });
    }
});

// HTML Útvonalak
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "Home.html")));
app.get("/meccsek", (req, res) => res.sendFile(path.join(__dirname, "meccsek.html")));
app.get("/elemzes", (req, res) => res.sendFile(path.join(__dirname, "elemzes.html")));

// Clerk hiba kezelése
app.use((err, req, res, next) => {
    if (err.message === 'Unauthenticated') {
        res.status(401).json({ error: "Bejelentkezés szükséges!" });
    } else {
        next(err);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 LuckyPitch Szerver fut a ${PORT} porton`));
