<!DOCTYPE html>
<html>
<head>
    <title>Ugrás a LuckyPitch-re...</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { background: #020617; color: white; font-family: sans-serif; text-align: center; padding: 50px 20px; }
        .btn { background: #0ea5e9; color: white; padding: 15px 30px; border-radius: 10px; text-decoration: none; font-weight: bold; display: inline-block; margin-top: 20px; }
    </style>
</head>
<body>
    <h2>🚀 Irány a LuckyPitch!</h2>
    <p>A Messenger/Instagram korlátozza a Google belépést.</p>
    
    <a href="#" id="open-link" class="btn">MEGNYITÁS BÖNGÉSZŐBEN</a>

    <script>
        const targetUrl = "https://luckypitch.render.com/meccsek.html";
        const ua = navigator.userAgent || navigator.vendor || window.opera;

        function redirect() {
            if (/Android/i.test(ua)) {
                // Android kényszerített Chrome megnyitás
                window.location.href = "intent://" + targetUrl.replace(/^https?:\/\//, "") + "#Intent;scheme=https;package=com.android.chrome;end";
            } else if (/iPhone|iPad|iPod/i.test(ua)) {
                // iOS esetén sajnos nincs automatikus "intent", 
                // de ha a gombra kattint, a Messenger gyakran felajánlja a Safarit
                window.location.href = targetUrl;
                alert("Kattints a jobb felső sarokban a '...' ikonra, majd a 'Megnyitás böngészőben' opcióra!");
            } else {
                window.location.href = targetUrl;
            }
        }

        document.getElementById('open-link').addEventListener('click', (e) => {
            e.preventDefault();
            redirect();
        });

        // Automatikus indítás Androidon
        if (/Android/i.test(ua)) { redirect(); }
    </script>
</body>
</html>
