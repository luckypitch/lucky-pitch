<!DOCTYPE html>
<html lang="hu">
<head>
    <title>LuckyPitch - Átirányítás...</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #020617;
            --neon-blue: #0ea5e9;
            --neon-green: #00ff88;
        }

        body { 
            background: var(--bg); 
            color: white; 
            font-family: 'Orbitron', sans-serif; 
            text-align: center; 
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            overflow: hidden;
        }

        .container {
            padding: 30px;
            border: 2px solid var(--neon-blue);
            border-radius: 20px;
            box-shadow: 0 0 20px rgba(14, 165, 233, 0.3);
            background: rgba(14, 165, 233, 0.05);
            max-width: 80%;
        }

        h2 { 
            color: var(--neon-green); 
            text-shadow: 0 0 10px var(--neon-green);
            font-size: 20px;
            margin-bottom: 20px;
        }

        p { font-size: 14px; opacity: 0.8; line-height: 1.6; }

        .btn { 
            background: transparent;
            color: var(--neon-blue); 
            padding: 15px 30px; 
            border: 2px solid var(--neon-blue);
            border-radius: 50px; 
            text-decoration: none; 
            font-weight: bold; 
            display: inline-block; 
            margin-top: 30px;
            transition: 0.3s;
            box-shadow: 0 0 15px rgba(14, 165, 233, 0.4);
        }

        .btn:hover {
            background: var(--neon-blue);
            color: white;
            box-shadow: 0 0 30px var(--neon-blue);
        }

        .loader {
            width: 40px;
            height: 40px;
            border: 3px solid transparent;
            border-top-color: var(--neon-green);
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 20px auto;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }
    </style>
</head>
<body>

    <div class="container">
        <div class="loader"></div>
        <h2>LUCKYPITCH INDÍTÁSA</h2>
        <p>A biztonságos belépéshez külső böngésző szükséges.</p>
        
        <a href="Home.html" id="open-link" class="btn">BELÉPÉS MOST</a>
        
        <p style="margin-top: 20px; font-size: 10px;">iOS esetén: Három pont (...) -> Megnyitás böngészőben</p>
    </div>

    <script>
        // Ide írd a te pontos domain nevedet, ha nem csak a fájlnév kell!
        const targetUrl = window.location.origin + "/Home.html"; 
        const ua = navigator.userAgent || navigator.vendor || window.opera;

        function redirect() {
            if (/Android/i.test(ua)) {
                // Kényszerített Chrome indítás Androidon
                const intentUrl = "intent://" + targetUrl.replace(/^https?:\/\//, "") + "#Intent;scheme=https;package=com.android.chrome;end";
                window.location.href = intentUrl;
            } else {
                // iPhone vagy PC esetén sima ugrás
                window.location.href = "Home.html";
            }
        }

        document.getElementById('open-link').addEventListener('click', (e) => {
            // Ha a gombra kattint, megpróbáljuk az átirányítást
            redirect();
        });

        // Automatikus próbálkozás betöltéskor (Androidon)
        window.onload = function() {
            if (/Android/i.test(ua)) {
                setTimeout(redirect, 1500); // 1.5 mp után magától megpróbálja
            }
        }
    </script>
</body>
</html>
