/**
 * Dev Browser - Fuzzy Match Engine
 * Fast subsequence and word-boundary matching with highlighting indices.
 */

function fuzzyMatch(pattern, text) {
  if (!pattern) {
    return { matches: true, score: 0, indices: [] };
  }

  const pLower = pattern.toLowerCase();
  const tLower = text.toLowerCase();

  // Quick check
  if (tLower.includes(pLower)) {
    const start = tLower.indexOf(pLower);
    const indices = [];
    for (let i = 0; i < pLower.length; i++) {
      indices.push(start + i);
    }
    // High score for exact contiguous substring
    const score = 1000 - start * 10 + (start === 0 ? 500 : 0);
    return { matches: true, score, indices };
  }

  let pIdx = 0;
  let tIdx = 0;
  let score = 0;
  let consecutive = 0;
  const indices = [];

  while (pIdx < pLower.length && tIdx < tLower.length) {
    const pChar = pLower[pIdx];
    const tChar = tLower[tIdx];

    if (pChar === tChar) {
      indices.push(tIdx);

      // Score bonuses
      score += 10;

      // Consecutive match bonus
      if (consecutive > 0) {
        score += consecutive * 15;
      }
      consecutive++;

      // Word boundary bonus (start of word or after space/dash/slash/underscore)
      if (tIdx === 0 || /[\s\-_/]/.test(text[tIdx - 1])) {
        score += 30;
      }

      // CamelCase bonus
      if (tIdx > 0 && text[tIdx] === text[tIdx].toUpperCase() && text[tIdx - 1] === text[tIdx - 1].toLowerCase()) {
        score += 25;
      }

      pIdx++;
    } else {
      consecutive = 0;
    }
    tIdx++;
  }

  if (pIdx === pLower.length) {
    // Penalty for long strings
    score -= (text.length - pattern.length);
    return { matches: true, score, indices };
  }

  return { matches: false, score: 0, indices: [] };
}

function fuzzyFilter(query, items, keyFn = (item) => (typeof item === "string" ? item : item.title)) {
  if (!query || !query.trim()) {
    return items.map((item, idx) => ({ item, score: 0, indices: [], index: idx }));
  }

  const results = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const text = keyFn(item);
    const match = fuzzyMatch(query.trim(), text);
    if (match.matches) {
      results.push({
        item,
        score: match.score,
        indices: match.indices,
        index: i
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

module.exports = {
  fuzzyMatch,
  fuzzyFilter
};
