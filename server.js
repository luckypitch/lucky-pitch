const express = require("express");
const cors = require("cors");
const path = require("path");
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));

// --- API STÁTUSZ ---
app.get("/api/status", (req, res) => {
    res.json({
        status: "ONLINE",
        football_key: !!process.env.FOOTBALL_DATA_API_KEY,
        stripe_key: !!process.env.STRIPE_SECRET_KEY
    });
});

// --- MECCSEK LEKÉRÉSE ---
app.get("/live-matches", async (req, res) => {
    const FD_KEY = process.env.FOOTBALL_DATA_API_KEY;
    const date = req.query.date || new Date().toISOString().split('T')[0];
    
    // Nincs ligaszűrés, hogy minden elérhető adatot megkapjunk
    const url = `https://api.football-data.org/v4/matches?dateFrom=${date}&dateTo=${date}`;

    try {
        const response = await fetch(url, { 
            headers: { "X-Auth-Token": FD_KEY } 
        });
        
        const data = await response.json();
        
        // Hibakezelés az API válaszhoz
        if (data.errorCode) {
            console.error("API Hiba:", data.message);
            return res.status(data.errorCode === 429 ? 429 : 500).json(data);
        }

        res.json(data);
    } catch (err) {
        console.error("Szerver hiba:", err);
        res.status(500).json({ matches: [], error: "Szerver hiba történt." });
    }
});

// --- STRIPE TÁMOGATÁS ---
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
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
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Útvonalak
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "Home.html")));
app.get("/meccsek", (req, res) => res.sendFile(path.join(__dirname, "meccsek.html")));
app.get("/elemzes", (req, res) => res.sendFile(path.join(__dirname, "elemzes.html")));

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 LuckyPitch Server fut a ${PORT} porton`);
});
