require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(express.json({limit: '1mb'}));
app.use(cors());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const SERVER_API_KEY = process.env.SERVER_API_KEY || ""; // השרת ידרוש כותרת X-API-KEY

if(!OPENAI_API_KEY) {
  console.warn("WARNING: OPENAI_API_KEY not set in env!");
}

app.post('/trade_signal', async (req, res) => {
  try {
    // אימות api-key מצד caller (EA)
    const clientKey = req.header('X-API-KEY') || "";
    if(SERVER_API_KEY && clientKey !== SERVER_API_KEY) {
      return res.status(401).json({ error: "Invalid API key" });
    }

    const payload = req.body || {};
    const symbol = payload.symbol || "UNKNOWN";
    const timeframe = payload.timeframe || "UNKNOWN";
    const bars = payload.bars || [];

    // בונה prompt לתשובת ChatGPT
    const prompt = `You are a market analyst. Based on the bars below, return EXACT response in this format only:
ACTION:BUY/SELL/HOLD;CONF:<number 0..1>
Do not add any extra text.

Symbol: ${symbol}
Timeframe: ${timeframe}
Bars (most recent first): ${JSON.stringify(bars).slice(0,12000)}`;

    // בקשה ל-OpenAI Chat Completions (HTTP)
    const openaiResp = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 80,
        temperature: 0.0
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    const content = openaiResp.data?.choices?.[0]?.message?.content || "";
    const clean = (""+content).replace(/\r?\n/g, " ").trim();

    // החזר את התגובה כפי שהיא
    return res.json({ response_raw: clean, parsed: parseResponse(clean) });

  } catch (err) {
    console.error("Error /trade_signal:", err.message || err);
    return res.status(500).json({ error: err.message || "server error" });
  }
});

function parseResponse(s) {
  // ננסה לפענח "ACTION:BUY;CONF:0.82"
  try {
    const up = s.toUpperCase();
    let act="HOLD", conf=0.0;
    const mAct = up.match(/ACTION\s*:\s*(BUY|SELL|HOLD)/);
    if(mAct) act = mAct[1];
    const mConf = up.match(/CONF\s*:\s*([0-9]*\.?[0-9]+)/);
    if(mConf) conf = parseFloat(mConf[1]);
    else {
      // אם אין CONF נסו לחפש מספר
      const mNum = up.match(/([0-9]*\.[0-9]+)/);
      if(mNum) conf = parseFloat(mNum[1]);
    }
    return { action: act, confidence: conf };
  } catch(e) {
    return { action: "HOLD", confidence: 0.0 };
  }
}

const port = process.env.PORT || 9000;
app.listen(port, () => {
  console.log(`MT5-AI Relay running on port ${port}`);
});
