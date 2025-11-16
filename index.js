require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(express.json({limit: '1mb'}));
app.use(cors());

// Expected environment variables:
// - GROQ_API_KEY : your Groq API key (gsk_...)
// - GROQ_API_URL : the inference URL from Groq console (example: https://api.groq.ai/v1/models/{model}/outputs)
// - SERVER_API_KEY : a local secret for EA -> server authentication
// - MODEL_NAME   : recommended default 'llama3-70b-8192' (optional)
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const GROQ_API_URL = process.env.GROQ_API_URL || "";
const SERVER_API_KEY = process.env.SERVER_API_KEY || "";
const MODEL_NAME = process.env.MODEL_NAME || "llama3-70b-8192";

if(!GROQ_API_KEY) console.warn("WARNING: GROQ_API_KEY not set in env!");
if(!GROQ_API_URL) console.warn("WARNING: GROQ_API_URL not set in env!");

app.post('/trade_signal', async (req, res) => {
  try {
    // simple auth: X-API-KEY header must match SERVER_API_KEY if one is set
    const clientKey = req.header('X-API-KEY') || "";
    if(SERVER_API_KEY && clientKey !== SERVER_API_KEY) {
      return res.status(401).json({ error: "Invalid API key" });
    }

    const payload = req.body || {};
    const symbol = payload.symbol || "UNKNOWN";
    const timeframe = payload.timeframe || "UNKNOWN";
    const bars = payload.bars || [];

    // Build a short prompt for the model
    const prompt = `You are a market analyst. Based on the recent bars (most recent first) return EXACTLY:
ACTION:BUY/SELL/HOLD;CONF:<number between 0 and 1>
No extra text.\nSymbol: ${symbol}\nTimeframe: ${timeframe}\nBars: ${JSON.stringify(bars).slice(0,12000)}`;

    // Construct the request to GROQ. The exact GROQ API shape may vary by account.
    // This server expects GROQ_API_URL to be the full inference URL for the chosen model.
    // Example: https://api.groq.ai/v1/models/llama3-70b-8192/outputs
    const reqBody = {
      // Many Groq APIs accept { input: "<prompt>" } or { prompt: "<prompt>" }.
      // We'll send both fields to maximize compatibility.
      input: prompt,
      prompt: prompt,
      model: MODEL_NAME,
      max_output_tokens: 200
    };

    const groqResp = await axios.post(
      GROQ_API_URL,
      reqBody,
      {
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 20000
      }
    );

    // Attempt to extract text from common response shapes
    let content = "";
    if(groqResp.data) {
      // Try a few common places:
      if(typeof groqResp.data.output === 'string') content = groqResp.data.output;
      else if(Array.isArray(groqResp.data.outputs) && groqResp.data.outputs.length>0 && typeof groqResp.data.outputs[0].text === 'string') content = groqResp.data.outputs[0].text;
      else if(typeof groqResp.data.choices === 'object') {
        // openai-like
        try {
          content = groqResp.data.choices[0].message.content;
        } catch(e){}
      } else {
        // fallback: stringify whole payload
        content = JSON.stringify(groqResp.data);
      }
    } else {
      content = "";
    }

    const clean = (""+content).replace(/\r?\n/g, " ").trim();
    return res.json({ response_raw: clean, parsed: parseResponse(clean) });

  } catch (err) {
    console.error("Error /trade_signal:", (err && err.message) ? err.message : err);
    return res.status(500).json({ error: err.message || "server error" });
  }
});

function parseResponse(s) {
  try {
    const up = (s || "").toUpperCase();
    let act="HOLD", conf=0.0;
    const mAct = up.match(/ACTION\s*:\s*(BUY|SELL|HOLD)/);
    if(mAct) act = mAct[1];
    const mConf = up.match(/CONF\s*:\s*([0-9]*\.?[0-9]+)/);
    if(mConf) conf = parseFloat(mConf[1]);
    else {
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
  console.log(`MT5-Groq Relay running on port ${port}`);
});
