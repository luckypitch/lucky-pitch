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

// --- MECCSEK LEKÉRÉSE ---
app.get("/live-matches", async (req, res) => {
    try {
        // Ingyenesen elérhető ligák kódjai (ezek a legbiztosabbak)
        // PL (Angol), PD (Spanyol), BL1 (Német), SA1 (Olasz), FL1 (Francia), CL (BL), EC (EB/VB)
        const leagueIds = "PL,PD,BL1,SA1,FL1,CL,EL,DED,PPL"; 
        
        const date = req.query.date || new Date().toISOString().split('T')[0];
        
        // Fontos: Ha túl sok ligát kérsz egyszerre, az ingyenes API néha elutasítja.
        // Itt egy stabilabb URL-t használunk:
        const url = `https://api.football-data.org/v4/matches?dateFrom=${date}&dateTo=${date}&competitions=${leagueIds}`;
        
        console.log(`Lekérés indítása: ${url}`); // Látni fogod a Render logban

        const response = await fetch(url, { 
            headers: { "X-Auth-Token": FOOTBALL_DATA_API_KEY } 
        });

        const data = await response.json();

        // Ha az API hibát dob (pl. 403 Forbidden vagy 429 Too Many Requests)
        if (data.errorCode) {
            console.error("API Hibaüzenet:", data.message);
            return res.status(data.errorCode === 403 ? 403 : 500).json(data);
        }

        res.json(data);
    } catch (err) {
        console.error("Szerver hiba:", err);
        res.status(500).json({ error: "Szerver hiba" });
    }
});

// --- ELEMZÉS (ODDS) ---
app.get('/api/odds-data', ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const response = await fetch(`https://api.the-odds-api.com/v4/sports/soccer/odds/?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Odds hiba" });
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
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 LuckyPitch Szerver fut a ${PORT} porton`));
