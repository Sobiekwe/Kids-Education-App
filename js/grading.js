// Binary grading with normalization (F07). No fuzzy matching, no partial credit.

function normalize(str) {
  return str
    .normalize("NFC") // equivalent Unicode forms compare equal
    .replace(/[‘’]/g, "'") // smart single quotes -> straight
    .replace(/[“”]/g, '"') // smart double quotes -> straight
    .trim()
    .toLowerCase();
}

/**
 * Returns true if the submitted answer matches the word or one of its
 * explicitly accepted alternate spellings. Internal spaces, hyphens and
 * accents are preserved (not stripped) since they can be meaningful.
 */
export function isCorrectSpelling(submitted, word, acceptedVariants = []) {
  if (submitted == null || submitted === "") return false;
  const candidates = [word, ...acceptedVariants].map(normalize);
  return candidates.includes(normalize(submitted));
}
