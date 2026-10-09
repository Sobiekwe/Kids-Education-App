// Sample without replacement, then in random order (L01 from the earlier
// detailed spec, kept because it's cheap and F02/F11 both need "unique
// words" selection).
export function sampleUnique(list, count) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(count, copy.length));
}

/**
 * Picks `count` words prioritizing coverage over randomness (continuous-
 * learning feature, staging): words never shown to this child come first
 * (in random order among themselves), then words shown longest ago, before
 * anything gets repeated sooner than necessary. `lastShownMap` is
 * word_id -> ISO timestamp string, as returned by db.js's
 * fetchLastShownMap() — a word absent from it has never been shown.
 */
export function pickCoverageSet(words, lastShownMap, count) {
  const unseen = sampleUnique(
    words.filter((w) => !lastShownMap[w.id]),
    words.length
  );
  const seen = words
    .filter((w) => lastShownMap[w.id])
    .sort((a, b) => new Date(lastShownMap[a.id]) - new Date(lastShownMap[b.id]));
  return [...unseen, ...seen].slice(0, Math.min(count, words.length));
}

/**
 * Minimal RFC4180-ish CSV parser: handles quoted fields, commas and
 * newlines inside quotes, and "" as an escaped quote. Good enough for a
 * parent pasting/exporting a small word-list CSV from Excel/Sheets —
 * not a general-purpose CSV library.
 */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      pushField();
    } else if (c === "\n") {
      pushRow();
    } else if (c === "\r") {
      // skip; \r\n handled via the following \n
    } else {
      field += c;
    }
  }
  if (field.length || row.length) pushRow();
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

/**
 * Turns parsed CSV rows into word objects for addWords(). Accepts an
 * optional header row (word, meaning, sentence, part_of_speech,
 * accepted_variants in any order) or falls back to that fixed column order
 * if the first row doesn't look like a header.
 */
export function csvRowsToWords(rows) {
  if (!rows.length) return [];
  const knownCols = ["word", "meaning", "sentence", "part_of_speech", "accepted_variants"];
  const firstRowLooksLikeHeader = knownCols.includes(rows[0][0]?.trim().toLowerCase());

  let colOrder = ["word", "meaning", "sentence", "part_of_speech", "accepted_variants"];
  let dataRows = rows;
  if (firstRowLooksLikeHeader) {
    colOrder = rows[0].map((c) => c.trim().toLowerCase());
    dataRows = rows.slice(1);
  }

  return dataRows
    .map((cells) => {
      const obj = {};
      colOrder.forEach((col, i) => {
        obj[col] = cells[i] !== undefined ? cells[i].trim() : "";
      });
      return {
        word: obj.word,
        meaning: obj.meaning,
        sentence: obj.sentence,
        pos: obj.part_of_speech,
        acceptedVariants: obj.accepted_variants
          ? obj.accepted_variants.split(";").map((s) => s.trim()).filter(Boolean)
          : [],
      };
    })
    .filter((w) => w.word);
}


/** " [ˈri-jəd]" — Merriam-Webster's respelling, shown after the part of speech. */
export function pronHtml(w) {
  if (!w || !w.pronunciation) return "";
  const div = document.createElement("div");
  div.textContent = w.pronunciation;
  return ` <span class="muted">[${div.innerHTML}]</span>`;
}

/** One-line key for the symbols in the respelling above. */
export const PRON_KEY_HTML =
  '<p class="muted pron-key">In [ ]: ˈ marks the loudest beat, and ə is the quiet "uh" sound.</p>';

/**
 * For a Soft c and g word, a precise sentence about the letter that matters:
 * "In rigid, the g comes before i, so it says j." Returns "" if the word has
 * no c or g before e, i, or y (so the caller just shows the general tip).
 */
export function softCgNote(word) {
  const m = /([cg])([eiy])/i.exec(word || "");
  if (!m) return "";
  const letter = m[1].toLowerCase();
  const next = m[2].toLowerCase();
  const sound = letter === "c" ? "s" : "j";
  const esc = (t) => t.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  return `In <strong>${esc(word)}</strong>, the <strong>${letter}</strong> comes before <strong>${next}</strong>, so it says <strong>${sound}</strong>.`;
}
