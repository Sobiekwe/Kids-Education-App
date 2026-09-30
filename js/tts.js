// Browser text-to-speech helper (F09). Uses the standard Web Speech API —
// no server, no API key, works offline once voices have loaded.

import { CONFIG } from "./config.js";

let voice = null;

// Known clear, standard-American-accent voices, roughly in order of quality,
// across the browsers/OSes a family is likely to use. speechSynthesis's
// default pick is sometimes a low-quality or non-US voice, so we search for
// these by name before falling back to "any English voice."
const PREFERRED_NAME_CONTAINS = [
  "google us english",
  "microsoft aria",
  "microsoft jenny",
  "microsoft guy",
  "samantha", // macOS/iOS
  "ava", // macOS/iOS newer
  "alex", // macOS
];

function pickVoice() {
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return;

  if (CONFIG.preferredVoiceName) {
    const forced = voices.find((v) => v.name.toLowerCase().includes(CONFIG.preferredVoiceName.toLowerCase()));
    if (forced) {
      voice = forced;
      return;
    }
  }

  for (const name of PREFERRED_NAME_CONTAINS) {
    const match = voices.find((v) => v.name.toLowerCase().includes(name));
    if (match) {
      voice = match;
      return;
    }
  }

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
      utterance.rate = 0.85;
      utterance.pitch = 1;
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

/** Lists voices available on THIS device/browser, for the voice-check page. */
export function listVoices() {
  if (typeof speechSynthesis === "undefined") return [];
  return speechSynthesis.getVoices();
}

export function speakWithVoice(text, voiceObj) {
  return new Promise((resolve, reject) => {
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = voiceObj;
      utterance.rate = 0.85;
      utterance.onend = () => resolve();
      utterance.onerror = (e) => reject(e.error || new Error("Speech synthesis error"));
      speechSynthesis.cancel();
      speechSynthesis.speak(utterance);
    } catch (err) {
      reject(err);
    }
  });
}
