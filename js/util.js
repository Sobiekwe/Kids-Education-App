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
