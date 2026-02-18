const express = require("express");
const cors = require("cors");
const path = require("path");

// Fetch támogatás (node-fetch v3 esetén így kell)
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();

app.use(cors());
app.use(express.static(__dirname));

// --- API KULCS ---
const FOOTBALL_DATA_API_KEY = "1f931344560e4ddc9103eff9281d435b";

// --- CACHE RENDSZER ---
let cache = {
  data: null,
  time: 0
};

const NORMAL_CACHE = 5 * 60 * 1000;   // 5 perc (ha nincs élő meccs)
const LIVE_CACHE = 20 * 1000;         // 20 mp (ha van élő meccs)

function hasLiveMatch(matches) {
  return matches.some(m =>
    m.status === "IN_PLAY" || m.status === "PAUSED"
  );
}

// --- API VÉGPONT ---
app.get("/live-matches", async (req, res) => {
  const now = Date.now();

  if (cache.data) {
    const live = hasLiveMatch(cache.data.matches || []);
    const duration = live ? LIVE_CACHE : NORMAL_CACHE;

    if (now - cache.time < duration) {
      console.log("Kiszolgálás cache-ből (Élő mód: " + live + ")");
      return res.json(cache.data);
    }
  }

  try {
    const today = new Date();
    // 2 nap visszamenőleg, 2 nap előre a biztonság kedvéért
    const dFrom = new Date(today);
    dFrom.setDate(today.getDate() - 2);
    const dTo = new Date(today);
    dTo.setDate(today.getDate() + 2);

    const dateFrom = dFrom.toISOString().split("T")[0];
    const dateTo = dTo.toISOString().split("T")[0];

    const url = `https://api.football-data.org/v4/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`;

    const response = await fetch(url, {
      headers: { "X-Auth-Token": FOOTBALL_DATA_API_KEY }
    });

    const data = await response.json();
    
    // Csak akkor mentsük a cache-be, ha nem hibaüzenet jött
    if (data.matches) {
        cache.data = data;
        cache.time = now;
        console.log("API frissítve. Talált meccsek:", data.matches.length);
    }

    res.json(data);

  } catch (err) {
    console.error("API hiba:", err.message);
    res.status(500).json({ error: "API error" });
  }
});

// --- ÚTVONALAK (NAVIGÁCIÓ JAVÍTÁSA) ---

// Főoldal
app.get(["/", "/home", "/Home"], (req, res) => {
    res.sendFile(path.join(__dirname, "Home.html"), (err) => {
        if (err) res.sendFile(path.join(__dirname, "home.html"));
    });
});

// Meccsek oldal
app.get(["/meccsek", "/Meccsek"], (req, res) => {
    res.sendFile(path.join(__dirname, "Meccsek.html"), (err) => {
        if (err) res.sendFile(path.join(__dirname, "meccsek.html"));
    });
});

// Elemzés oldal
app.get(["/elemzes", "/Elemzes"], (req, res) => {
    res.sendFile(path.join(__dirname, "Elemzes.html"), (err) => {
        if (err) res.sendFile(path.join(__dirname, "elemzes.html"));
    });
});

// --- SZERVER INDÍTÁS ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`
  -----------------------------------------
  Szerver fut a ${PORT} porton.
  Helyi cím: http://localhost:${PORT}
  -----------------------------------------
  `);
});
