const express = require("express");
const cors = require("cors");
const path = require("path");

const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();
app.use(cors());
app.use(express.static(__dirname));

const FOOTBALL_DATA_API_KEY = "1f931344560e4ddc9103eff9281d435b";

let cache = { data: null, time: 0 };
const NORMAL_CACHE = 5 * 60 * 1000; 
const LIVE_CACHE = 20 * 1000;      

function hasLiveMatch(matches) {
  return matches.some(m => m.status === "IN_PLAY" || m.status === "PAUSED");
}

app.get("/live-matches", async (req, res) => {
  const now = Date.now();

  if (cache.data) {
    const live = hasLiveMatch(cache.data.matches || []);
    const duration = live ? LIVE_CACHE : NORMAL_CACHE;
    if (now - cache.time < duration) {
      return res.json(cache.data);
    }
  }

  try {
    const today = new Date();
    const dFrom = new Date(today);
    dFrom.setDate(today.getDate() - 1); // Elég a tegnap-ma-holnap az élőhöz
    const dTo = new Date(today);
    dTo.setDate(today.getDate() + 1);

    const dateFrom = dFrom.toISOString().split("T")[0];
    const dateTo = dTo.toISOString().split("T")[0];

    const url = `https://api.football-data.org/v4/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`;

    const response = await fetch(url, {
      headers: { "X-Auth-Token": FOOTBALL_DATA_API_KEY }
    });

    const data = await response.json();
    cache.data = data;
    cache.time = now;

    console.log("API frissítve:", data.matches?.length, "meccs");
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "API hiba" });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "meccsek.html"));
});

app.listen(3000, "0.0.0.0", () => console.log("Szerver fut a 3000-es porton"));
