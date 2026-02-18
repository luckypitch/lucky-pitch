const express = require("express");
const cors = require("cors");
const path = require("path");

// Fetch támogatás (Node.js környezethez)
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();

// Beállítások
app.use(cors());
app.use(express.static(__dirname));

// --- API KULCS ---
const FOOTBALL_DATA_API_KEY = "1f931344560e4ddc9103eff9281d435b";

// --- CACHE RENDSZER ---
let cache = {
  data: null,
  time: 0
};

const NORMAL_CACHE = 5 * 60 * 1000;   // 5 perc (alapértelmezett)
const LIVE_CACHE = 20 * 1000;         // 20 mp (ha van élő meccs)

// Segédfüggvény az élő meccsek detektálásához
function hasLiveMatch(matches) {
  if (!matches) return false;
  return matches.some(m =>
    m.status === "IN_PLAY" || m.status === "PAUSED"
  );
}

// --- 1. VÉGPONT: Meccsek lekérése ---
app.get("/live-matches", async (req, res) => {
  const now = Date.now();

  // Cache ellenőrzés
  if (cache.data) {
    const live = hasLiveMatch(cache.data.matches);
    const duration = live ? LIVE_CACHE : NORMAL_CACHE;

    if (now - cache.time < duration) {
      console.log(`[Cache] Kiszolgálás memóriából (Élő mód: ${live})`);
      return res.json(cache.data);
    }
  }

  try {
    const today = new Date();
    
    // IDŐABLAK BEÁLLÍTÁSA:
    // dateFrom: 2 nappal ezelőtt
    const dFrom = new Date(today);
    dFrom.setDate(today.getDate() - 2);
    
    // dateTo: 4 nappal előre (hogy a szombat/vasárnap is látszódjon)
    const dTo = new Date(today);
    dTo.setDate(today.getDate() + 4); 

    const dateFrom = dFrom.toISOString().split("T")[0];
    const dateTo = dTo.toISOString().split("T")[0];

    console.log(`[API] Lekérés indítása: ${dateFrom} -> ${dateTo}`);

    const url = `https://api.football-data.org/v4/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`;

    const response = await fetch(url, {
      headers: { "X-Auth-Token": FOOTBALL_DATA_API_KEY }
    });

    const data = await response.json();
    
    // Cache frissítése csak sikeres válasz esetén
    if (data && data.matches) {
        cache.data = data;
        cache.time = now;
        console.log(`[API] Frissítve! Talált meccsek száma: ${data.matches.length}`);
    } else {
        console.error("[API] Hiba az adatok szerkezetében:", data);
    }

    res.json(data);

  } catch (err) {
    console.error("[Szerver Hiba]:", err.message);
    res.status(500).json({ error: "Szerver vagy API hiba történt." });
  }
});

// --- 2. ÚTVONALAK (HTML kiszolgálás) ---

// Főoldal (Home)
app.get(["/", "/home", "/Home"], (req, res) => {
    res.sendFile(path.join(__dirname, "Home.html"), (err) => {
        if (err) res.sendFile(path.join(__dirname, "home.html"), (err2) => {
            if (err2) res.status(404).send("Hiba: Home.html nem található!");
        });
    });
});

// Meccsek lista
app.get(["/meccsek", "/Meccsek"], (req, res) => {
    res.sendFile(path.join(__dirname, "Meccsek.html"), (err) => {
        if (err) res.sendFile(path.join(__dirname, "meccsek.html"), (err2) => {
            if (err2) res.status(404).send("Hiba: Meccsek.html nem található!");
        });
    });
});

// Elemzés oldal
app.get(["/elemzes", "/Elemzes"], (req, res) => {
    res.sendFile(path.join(__dirname, "Elemzes.html"), (err) => {
        if (err) res.sendFile(path.join(__dirname, "elemzes.html"), (err2) => {
            if (err2) res.status(404).send("Hiba: Elemzes.html nem található!");
        });
    });
});

// --- SZERVER INDÍTÁS ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log("========================================");
  console.log(`  LuckyPitch szerver elindult!`);
  console.log(`  Port: ${PORT}`);
  console.log(`  Dátum ablak: -2 és +4 nap`);
  console.log(`  Cím: http://localhost:${PORT}`);
  console.log("========================================");
});
