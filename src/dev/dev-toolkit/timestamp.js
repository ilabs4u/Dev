/**
 * Dev Browser - Timestamp / Epoch Converter
 * Converts Unix epoch (milliseconds / seconds), ISO 8601, and human relative times.
 */

function formatRelativeTime(dateOrEpoch, baseTime = Date.now()) {
  const targetMs = typeof dateOrEpoch === "number" ? dateOrEpoch : new Date(dateOrEpoch).getTime();
  const diffMs = targetMs - baseTime;
  const isPast = diffMs <= 0;
  const absDiff = Math.abs(diffMs);

  const seconds = Math.floor(absDiff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  let timeUnit;
  if (seconds < 5) return "just now";
  if (seconds < 60) timeUnit = `${seconds} second${seconds === 1 ? "" : "s"}`;
  else if (minutes < 60) timeUnit = `${minutes} minute${minutes === 1 ? "" : "s"}`;
  else if (hours < 24) timeUnit = `${hours} hour${hours === 1 ? "" : "s"}`;
  else if (days < 30) timeUnit = `${days} day${days === 1 ? "" : "s"}`;
  else if (months < 12) timeUnit = `${months} month${months === 1 ? "" : "s"}`;
  else timeUnit = `${years} year${years === 1 ? "" : "s"}`;

  return isPast ? `${timeUnit} ago` : `in ${timeUnit}`;
}

function parseTimestamp(input) {
  if (input === null || input === undefined || input === "") {
    return convertDate(new Date());
  }

  // If number or numeric string
  if (typeof input === "number" || /^-?\d+(\.\d+)?$/.test(String(input).trim())) {
    let num = Number(input);
    // If < 1e11, assume seconds (up to year ~5138)
    if (Math.abs(num) < 1e11) {
      num = Math.round(num * 1000);
    }
    const d = new Date(num);
    if (isNaN(d.getTime())) {
      throw new Error(`Invalid epoch timestamp: ${input}`);
    }
    return convertDate(d);
  }

  // ISO string or date string
  const d = new Date(input);
  if (isNaN(d.getTime())) {
    throw new Error(`Unable to parse date string: "${input}"`);
  }
  return convertDate(d);
}

function convertDate(date) {
  const ms = date.getTime();
  const sec = Math.floor(ms / 1000);

  return {
    ms,
    seconds: sec,
    iso: date.toISOString(),
    utc: date.toUTCString(),
    local: date.toLocaleString(),
    relative: formatRelativeTime(ms)
  };
}

module.exports = {
  formatRelativeTime,
  parseTimestamp,
  convertDate
};
