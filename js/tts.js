// Audio playback (F09). Prefers pre-generated Google Cloud TTS audio files
// (same voice on every browser/device — see js/db.js generateAndStoreWordAudio
// and api/tts.js) and falls back to the browser's built-in Web Speech API
// for any word that doesn't have pre-generated audio yet (e.g. it was just
// added and audio generation is still catching up, or failed).

import { CONFIG } from "./config.js";

let voice = null;
let currentAudioEl = null;

// ---- Fallback: browser speech synthesis ----------------------------------

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

  const enVoices = voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith("en"));
  const neural = enVoices.find((v) => /natural|enhanced|premium/i.test(v.name));
  if (neural) {
    voice = neural;
    return;
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

function speakViaBrowser(text) {
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

// ---- Preferred: pre-generated audio file ----------------------------------

function playAudioUrl(url) {
  return new Promise((resolve, reject) => {
    stopSpeaking();
    const audioEl = new Audio(url);
    currentAudioEl = audioEl;
    audioEl.onended = () => resolve();
    audioEl.onerror = () => reject(new Error("Couldn't play the audio file."));
    audioEl.play().catch(reject);
  });
}

/**
 * Speaks a word's spelling aloud: plays the pre-generated audio file if this
 * word has one, otherwise falls back to the browser's built-in voice.
 */
export function playWord(word) {
  if (word.audio_word_url) return playAudioUrl(word.audio_word_url);
  return speakViaBrowser(word.word);
}

/** Speaks a word's example sentence aloud, same preference order as playWord. */
export function playSentence(word) {
  if (!word.sentence) return Promise.resolve();
  if (word.audio_sentence_url) return playAudioUrl(word.audio_sentence_url);
  return speakViaBrowser(word.sentence);
}

/** Back-compat: speak arbitrary text with the browser fallback voice (used nowhere with pre-generated audio, since that's always tied to a specific word). */
export function speak(text) {
  return speakViaBrowser(text);
}

export function stopSpeaking() {
  if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
  if (currentAudioEl) {
    currentAudioEl.pause();
    currentAudioEl = null;
  }
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
