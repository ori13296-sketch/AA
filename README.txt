MT5-AI-Server
=============
This project is a small Relay server for MetaTrader 5: it accepts POST /trade_signal with bars,
forwards a prompt to OpenAI (gpt-4o-mini) and returns ACTION:...;CONF:...

Files:
- index.js       : main server
- package.json   : node project file
- .env.example   : example env vars

Quick start (local):
1. copy .env.example to .env and set OPENAI_API_KEY and SERVER_API_KEY
2. npm install
3. node index.js
4. send POST to http://localhost:9000/trade_signal with X-API-KEY header

Railway deploy:
1. upload this project to Railway (zip or GitHub)
2. set env variables in Railway: OPENAI_API_KEY and SERVER_API_KEY
3. deploy and get public URL, then call <URL>/trade_signal from MT5 EA
