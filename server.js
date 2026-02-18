// --- 2. VÉGPONT: SMART LIVE MATCH CACHE ---
app.get("/live-matches", async (req, res) => {

    const now = Date.now();

    // ha van cache
    if (cache.matches.data) {

        const matches = cache.matches.data.matches || [];

        const hasLiveMatch = matches.some(m =>
            ["IN_PLAY", "PAUSED", "LIVE"].includes(m.status)
        );

        // ha live meccs van → 15 mp cache
        const liveCacheTime = 15000;

        // ha nincs live → 5 perc cache
        const normalCacheTime = CACHE_DURATION;

        const maxAge = hasLiveMatch ? liveCacheTime : normalCacheTime;

        if (now - cache.matches.time < maxAge) {
            console.log("Meccsek cache-ből (smart)...");
            return res.json(cache.matches.data);
        }
    }

    // ========================
    // API FRISSÍTÉS
    // ========================

    try {

        const today = new Date();

        const dFrom = new Date(today);
        dFrom.setDate(today.getDate() - 4);

        const dTo = new Date(today);
        dTo.setDate(today.getDate() + 4);

        const dateFrom = dFrom.toISOString().split('T')[0];
        const dateTo = dTo.toISOString().split('T')[0];

        const url = `https://api.football-data.org/v4/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`;

        const response = await fetch(url, {
            headers: { "X-Auth-Token": FOOTBALL_DATA_API_KEY }
        });

        const data = await response.json();

        if (data.matches) {

            // ===== SCORE VÁLTOZÁS DETEKT =====

            let changed = false;

            if (cache.matches.data) {

                const oldMatches = cache.matches.data.matches || [];

                for (const newMatch of data.matches) {

                    const old = oldMatches.find(m => m.id === newMatch.id);
                    if (!old) continue;

                    const oldScore =
                        (old.score.fullTime.home || 0) +
                        (old.score.fullTime.away || 0);

                    const newScore =
                        (newMatch.score.fullTime.home || 0) +
                        (newMatch.score.fullTime.away || 0);

                    if (oldScore !== newScore) {
                        changed = true;
                        console.log("⚽ GÓL VÁLTOZÁS DETEKTÁLVA!");
                        break;
                    }
                }
            }

            cache.matches.data = data;
            cache.matches.time = now;

            console.log(
                changed
                    ? "CACHE FRISSÍTVE (score változás)"
                    : "CACHE FRISSÍTVE (idő lejárt)"
            );
        }

        res.json(data);

    } catch (err) {
        res.status(500).json({ error: "Hiba a meccsek lekérésekor" });
    }
});
