const express = require("express");
const cors = require("cors");
const path = require("path");
const fetch = require('node-fetch');
const fs = require('fs');

// --- KÖRNYEZETI VÁLTOZÓK KEZELÉSE ---
// Ha Renderen fut (NODE_ENV=production), nem nézi az api.env fájlt
if (process.env.NODE_ENV !== 'production') {
    if (fs.existsSync('./api.env')) {
        require('dotenv').config({ path: './api.env' });
        console.log("🛠️ Helyi mód: api.env használatban");
    }
} else {
    console.log("🚀 Render mód: Dashboard változók használatban");
}

const FD_KEY = process.env.FOOTBALL_DATA_API_KEY;
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || '');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));

// --- API: MECCSEK LEKÉRÉSE ---
app.get("/live-matches", async (req, res) => {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    // Az ingyenes ligák kódjai (PL, PD, BL1, SA1, FL1, CL, DED, PPL)
    const leagues = "PL,PD,BL1,SA1,FL1,CL,DED,PPL";
    const url = `https://api.football-data.org/v4/matches?dateFrom=${date}&dateTo=${date}&competitions=${leagues}`;

    try {
        const response = await fetch(url, { 
            headers: { "X-Auth-Token": FD_KEY } 
        });
        const data = await response.json();
        
        // Naplózás a Render logba a hibakereséshez
        console.log(`Lekérés: ${date} | Találat: ${data.matches ? data.matches.length : 0}`);
        
        res.json(data);
    } catch (err) {
        console.error("Szerver hiba:", err);
        res.status(500).json({ matches: [], error: "Szerver hiba" });
    }
});

// --- STRIPE TÁMOGATÁS ---
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

// Oldalak
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "Home.html")));
app.get("/meccsek", (req, res) => res.sendFile(path.join(__dirname, "meccsek.html")));
app.get("/elemzes", (req, res) => res.sendFile(path.join(__dirname, "elemzes.html")));

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Szerver fut: ${PORT}`));
