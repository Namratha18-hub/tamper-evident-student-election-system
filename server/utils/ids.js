// Pulls student IDs out of pasted text or a CSV file.
// An ID is 4 to 20 letters, digits, "-" or "_" and must contain at least one digit,
// so column headers ("StudentID") and names ("Namratha") are skipped automatically.
function parseIds(text) {
  const found = new Set();
  for (const raw of String(text || "").split(/[\s,;|]+/)) {
    const id = raw.replace(/^["']+|["']+$/g, "").toUpperCase();
    if (/^(?=.*\d)[A-Z0-9_-]{4,20}$/.test(id)) found.add(id);
  }
  return [...found];
}

module.exports = { parseIds };