// Vercel serverless function: the ONLY place the Google Cloud TTS API key is
// used. The key lives in a Vercel environment variable (GOOGLE_TTS_API_KEY),
// never in client code or the git repo, so it's never exposed to a browser.
//
// The app does not call this on every word play — words are pre-generated
// once (see scripts/backfill-audio and the Parent "add word" flow) and
// played back as plain static MP3s from Supabase Storage. This endpoint only
// runs when audio for a word doesn't exist yet.

const VOICE_NAME = "en-US-Neural2-F"; // warm, clear US-English neural voice
const SPEAKING_RATE = 0.92; // slightly slower, easier for kids to follow

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

  const apiKey = process.env.GOOGLE_TTS_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Text-to-speech is not configured on the server yet (missing GOOGLE_TTS_API_KEY)." });
    return;
  }

  try {
    const googleRes = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
