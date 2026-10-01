// Vercel serverless function: the ONLY place the Google Cloud credentials are
// used. The service account key lives in a Vercel environment variable
// (GOOGLE_SERVICE_ACCOUNT_JSON — the full downloaded JSON, as a string),
// never in client code or the git repo, so it's never exposed to a browser.
//
// The app does not call this on every word play — words are pre-generated
// once (see js/db.js generateAndStoreWordAudio and the Parent "add word"
// flow) and played back as plain static MP3s from Supabase Storage. This
// endpoint only runs when audio for a word doesn't exist yet.

const crypto = require("crypto");

const VOICE_NAME = "en-US-Neural2-F"; // warm, clear US-English neural voice
const SPEAKING_RATE = 0.92; // slightly slower, easier for kids to follow

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Exchanges the service account's private key for a short-lived OAuth2
 * access token (Google's standard JWT-bearer server-to-server flow — no
 * user sign-in involved, just this one key proving the server's identity).
 */
async function getAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`;
  const signature = crypto
    .sign("RSA-SHA256", Buffer.from(signingInput), serviceAccount.private_key)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const jwt = `${signingInput}.${signature}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!tokenRes.ok) {
    const detail = await tokenRes.text();
    throw new Error(`Couldn't authenticate with Google (${tokenRes.status}): ${detail}`);
  }
  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  let body = req.body;
  if (!body || typeof body === "string") {
    try {
      body = JSON.parse(body || "{}");
    } catch {
      body = {};
    }
  }

  const text = body && body.text;
  if (!text || typeof text !== "string" || !text.trim()) {
    res.status(400).json({ error: 'Missing "text" in request body.' });
    return;
  }

  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    res.status(500).json({ error: "Text-to-speech is not configured on the server yet (missing GOOGLE_SERVICE_ACCOUNT_JSON)." });
    return;
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(raw);
  } catch {
    res.status(500).json({ error: "GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON." });
    return;
  }

  try {
    const accessToken = await getAccessToken(serviceAccount);

    const googleRes = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: "en-US", name: VOICE_NAME },
        audioConfig: { audioEncoding: "MP3", speakingRate: SPEAKING_RATE },
      }),
    });

    if (!googleRes.ok) {
      const detail = await googleRes.text();
      res.status(502).json({ error: "Text-to-speech provider error", detail });
      return;
    }

    const data = await googleRes.json();
    // data.audioContent is base64-encoded MP3 audio.
    res.status(200).json({ audioContent: data.audioContent });
  } catch (err) {
    res.status(500).json({ error: err.message || "Unknown text-to-speech error" });
  }
};
