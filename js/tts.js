// Browser text-to-speech helper (F09). Uses the standard Web Speech API —
// no server, no API key, works offline once the page has loaded.

let voice = null;

function pickVoice() {
  const voices = speechSynthesis.getVoices();
  // Prefer a US English voice if one is available.
  voice =
    voices.find((v) => v.lang === "en-US") ||
    voices.find((v) => v.lang && v.lang.startsWith("en")) ||
    voices[0] ||
    null;
}

if (typeof speechSynthesis !== "undefined") {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
}

/**
 * Speaks text aloud. Returns a promise that resolves when speech finishes,
 * or rejects on a genuine audio failure (per F09: an audio failure must
 * stop the question, not be scored as a spelling miss).
 */
export function speak(text) {
  return new Promise((resolve, reject) => {
    if (typeof speechSynthesis === "undefined") {
      reject(new Error("Speech synthesis is not supported on this device/browser."));
      return;
    }
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      if (voice) utterance.voice = voice;
      utterance.rate = 0.9;
      utterance.onend = () => resolve();
      utterance.onerror = (e) => reject(e.error || new Error("Speech synthesis error"));
      speechSynthesis.cancel(); // never overlap audio
      speechSynthesis.speak(utterance);
    } catch (err) {
      reject(err);
    }
  });
}

export function stopSpeaking() {
  if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
}
