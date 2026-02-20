const express = require("express");
const cors = require("cors");
const path = require("path");
const fetch = require('node-fetch');
const fs = require('fs');

// Render prioritás: Dashboard változók vs api.env
if (process.env.NODE_ENV !== 'production') {
    if (fs.existsSync('./api.env')) {
        require('dotenv').config({ path: './api.env' });
    }
} else {
    require('dotenv').config();
}

const FD_KEY = process.env.FOOTBALL_DATA_API_KEY;
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
const stripe = require('stripe')(STRIPE_KEY || '');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));

// API: Meccsek lekérése - SZŰRÉS NÉLKÜL
app.get("/live-matches", async (req, res) => {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    
    // Kivettem a ligák szűrését, hogy mindent visszaadjon, amit csak tud!
    const url = `https://api.football-data.org/v4/matches?dateFrom=${date}&dateTo=${date}`;

    console.log(`Lekérés dátuma: ${date}`);

    try {
        const response = await fetch(url, { 
            headers: { "X-Auth-Token": FD_KEY } 
        });

        const data = await response.json();

        // Hibakeresés: Ha az API hibát dob, küldjük vissza a pontos hibaüzenetet
        if (data.message && !data.matches) {
            console.error("API hibaüzenet:", data.message);
            return res.json({ matches: [], error: data.message });
        }

        res.json(data);
    } catch (err) {
        console.error("Szerver hiba:", err);
        res.status(500).json({ matches: [], error: "Szerver hiba" });
    }
});

// Stripe Támogatás
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

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "Home.html")));
app.get("/meccsek", (req, res) => res.sendFile(path.join(__dirname, "meccsek.html")));
app.get("/elemzes", (req, res) => res.sendFile(path.join(__dirname, "elemzes.html")));

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Szerver fut a ${PORT} porton`));
