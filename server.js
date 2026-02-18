const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();
app.use(cors());
app.use(express.static(__dirname));

const FOOTBALL_DATA_API_KEY = "1f931344560e4ddc9103eff9281d435b";

// --- SEGÉDFÜGGVÉNY: Megkeresi a fájlt akkor is, ha kis/nagybetű eltérés van ---
const serveFile = (res, fileName) => {
    const possibleNames = [
        fileName,
        fileName.toLowerCase(),
        fileName.charAt(0).toUpperCase() + fileName.slice(1).toLowerCase()
    ];

    for (const name of possibleNames) {
        const filePath = path.join(__dirname, name);
        if (fs.existsSync(filePath)) {
            return res.sendFile(filePath);
        }
    }
    res.status(404).send(`Hiba: A ${fileName} fájl nem található a szerveren! Ellenőrizd a fájlnevet a mappádban.`);
};

// --- API VÉGPONTOK ---
app.get("/live-matches", async (req, res) => {
    try {
        const today = new Date();
        const dFrom = new Date(today); dFrom.setDate(today.getDate() - 2);
        const dTo = new Date(today); dTo.setDate(today.getDate() + 4); 
        const url = `https://api.football-data.org/v4/matches?dateFrom=${dFrom.toISOString().split("T")[0]}&dateTo=${dTo.toISOString().split("T")[0]}`;
        const response = await fetch(url, { headers: { "X-Auth-Token": FOOTBALL_DATA_API_KEY } });
        const data = await response.json();
        res.json(data);
    } catch (err) { res.status(500).json({ error: "API hiba" }); }
});

app.get("/match-details/:id", async (req, res) => {
    try {
        const response = await fetch(`https://api.football-data.org/v4/matches/${req.params.id}`, {
            headers: { "X-Auth-Token": FOOTBALL_DATA_API_KEY }
        });
        const data = await response.json();
        res.json(data);
    } catch (err) { res.status(500).json({ error: "Hiba" }); }
});

// --- JAVÍTOTT ÚTVONALAK ---

app.get("/", (req, res) => serveFile(res, "Home.html"));

app.get("/meccsek", (req, res) => serveFile(res, "Meccsek.html"));

app.get("/elemzes", (req, res) => serveFile(res, "Elemzes.html"));

// Ez kezeli, ha valaki véletlenül .html-lel a végén írja be az URL-be
app.get("/:page.html", (req, res) => {
    serveFile(res, req.params.page + ".html");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`LuckyPitch fut a ${PORT} porton.`);
});
