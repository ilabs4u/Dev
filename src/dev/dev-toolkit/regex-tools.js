/**
 * Dev Browser - Regex Tester & Matcher
 * Tests regular expressions with flags, match indices, capture groups, and replacement preview.
 */

function testRegex(pattern, flags = "g", testString = "") {
  if (pattern === null || pattern === undefined) {
    throw new TypeError("Regex pattern must not be null or undefined");
  }

  // Sanitize flags: ensure 'g' is present if user wants multiple matches, but don't duplicate
  const cleanFlags = Array.from(new Set((flags || "").split(""))).join("");

  let re;
  try {
    re = new RegExp(pattern, cleanFlags);
  } catch (err) {
    return {
      valid: false,
      pattern,
      flags: cleanFlags,
      error: err.message,
      matches: [],
      count: 0
    };
  }

  const str = String(testString);
  const matches = [];

  if (re.global) {
    let match;
    let guard = 0;
    while ((match = re.exec(str)) !== null) {
      matches.push({
        index: match.index,
        endIndex: match.index + match[0].length,
        match: match[0],
        captures: match.slice(1),
        groups: match.groups ? { ...match.groups } : {}
      });

      // Avoid infinite loop on zero-width match
      if (match.index === re.lastIndex) {
        re.lastIndex++;
      }
      guard++;
      if (guard > 10000) break; // safety guard
    }
  } else {
    const match = re.exec(str);
    if (match) {
      matches.push({
        index: match.index,
        endIndex: match.index + match[0].length,
        match: match[0],
        captures: match.slice(1),
        groups: match.groups ? { ...match.groups } : {}
      });
    }
  }

  return {
    valid: true,
    pattern,
    flags: cleanFlags,
    error: null,
    matches,
    count: matches.length
  };
}

function replaceRegex(pattern, flags = "g", testString = "", replacement = "") {
  try {
    const re = new RegExp(pattern, flags);
    const result = String(testString).replace(re, replacement);
    return {
      valid: true,
      result,
      error: null
    };
  } catch (err) {
    return {
      valid: false,
      result: testString,
      error: err.message
    };
  }
}

module.exports = {
  testRegex,
  replaceRegex
};
