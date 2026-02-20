const fs = require('fs');
const path = require('path');
const express = require("express");
const cors = require("cors");
const fetch = require('node-fetch');
const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');

// --- KÖRNYEZETI VÁLTOZÓK KEZELÉSE ---
if (fs.existsSync('./api.env')) {
    require('dotenv').config({ path: './api.env' });
    console.log("✅ api.env fájl detektálva és betöltve.");
} else {
    require('dotenv').config(); 
    console.log("ℹ️ api.env nem található, Render környezeti változók használata.");
}

const FD_KEY = process.env.FOOTBALL_DATA_API_KEY;
const ODDS_KEY = process.env.ODDS_API_KEY;
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;

// Stripe inicializálása
const stripe = require('stripe')(STRIPE_KEY || '');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));

console.log("--- LuckyPitch Indítási Ellenőrzés ---");
console.log("Football-Data Key:", FD_KEY ? "OK (hossz: " + FD_KEY.length + ")" : "HIÁNYZIK");
console.log("Odds-API Key:", ODDS_KEY ? "OK" : "HIÁNYZIK");
console.log("--------------------------------------");

// --- API: MECCSEK LEKÉRÉSE ---
app.get("/live-matches", async (req, res) => {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    // Az ingyenes tervben elérhető legstabilabb ligák
    const leagues = "PL,PD,BL1,SA1,FL1,CL";
    const url = `https://api.football-data.org/v4/matches?dateFrom=${date}&dateTo=${date}&competitions=${leagues}`;

    try {
        console.log(`Lekérés dátumra: ${date}`);
        const response = await fetch(url, { 
            headers: { "X-Auth-Token": FD_KEY } 
        });

        const data = await response.json();

        if (data.errorCode || data.message && !data.matches) {
            console.error("API hiba:", data.message);
            return res.status(400).json({ matches: [], error: data.message });
        }

        console.log(`Siker! Talált meccsek száma: ${data.matches ? data.matches.length : 0}`);
        res.json(data);
    } catch (err) {
        console.error("Szerver hiba:", err.message);
        res.status(500).json({ matches: [], error: "Szerver hiba történt." });
    }
});

// --- API: ODDS ADATOK (Elemzéshez) ---
app.get('/api/odds-data', ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const url = `https://api.the-odds-api.com/v4/sports/soccer/odds/?apiKey=${ODDS_KEY}&regions=eu&markets=h2h`;
        const response = await fetch(url);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Odds lekérési hiba" });
    }
});

// --- STRIPE FIZETÉS ---
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

// Útvonalak
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "Home.html")));
app.get("/meccsek", (req, res) => res.sendFile(path.join(__dirname, "meccsek.html")));
app.get("/elemzes", (req, res) => res.sendFile(path.join(__dirname, "elemzes.html")));

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 LuckyPitch online: Port ${PORT}`);
});
