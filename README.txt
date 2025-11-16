MT5-AI-Groq-Server
==================

This project is a Relay server that accepts POST /trade_signal from MetaTrader EA,
forwards a concise prompt to a Groq inference endpoint (llama3-70b-8192 recommended),
and returns a compact response like: ACTION:BUY;CONF:0.82

1) How to get a free Groq key:
   - Visit https://console.groq.com/keys and create an API key (gsk_...)
   - Copy the inference URL (Groq console shows model endpoint URL)

2) Deploy to Railway:
   - Create new project -> Deploy from ZIP or GitHub
   - Add environment variables:
       GROQ_API_KEY  = (your Groq key)
       GROQ_API_URL  = (the model inference URL from Groq console)
       SERVER_API_KEY = (a secret for EA, e.g. mt5-secret-1234)
       MODEL_NAME = llama3-70b-8192
   - Deploy. Railway will provide a public URL.

3) MT5 setup:
   - Tools -> Options -> Expert Advisors -> Allow WebRequest for listed URL
     add your Railway base URL (e.g. https://myapp.up.railway.app)
   - In your EA, set:
       AI_Endpoint_URL = "https://<your-railway-url>/trade_signal";
       API_KEY = "<SERVER_API_KEY>";
   - The EA must send JSON payload with bars (as in previous instructions)

4) Notes:
   - Groq API shapes might differ; set GROQ_API_URL to the exact URL shown in your Groq console.
   - This server tries several common response shapes (outputs, output, choices).
   - Test on demo accounts first.

If you want, I can now:
 - build the EA MQL5 code that sends bars to this endpoint (ready-to-paste),
 - or give a one-click Railway deployment link.
