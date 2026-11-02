const Vote = require("../models/Vote");
const Election = require("../models/Election");
const { verifyChain } = require("./hash");

// Result of the latest automatic check, kept in memory and shown to everyone.
let latest = { ok: true, checkedAt: null, reason: "Waiting for the first check.", brokenAt: null };

async function runOnce() {
  const votes = await Vote.find().sort({ index: 1 }).lean();
  const election = await Election.get();
  return verifyChain(votes, { voteCount: election.voteCount, headHash: election.headHash });
}

async function check() {
  try {
    let result = await runOnce();
    if (!result.valid) {
      // A vote or an archive step may have been half-written a moment ago. Look again before raising an alarm.
      await new Promise((resolve) => setTimeout(resolve, 1500));
      result = await runOnce();
    }
    if (!result.valid && latest.ok) console.error("INTEGRITY ALERT:", result.reason);
    latest = { ok: result.valid, checkedAt: new Date().toISOString(), reason: result.reason, brokenAt: result.brokenAt };
  } catch (err) {
    console.error("Integrity check could not run:", err.message);
  }
}

// Check right away, then once a minute.
function start(intervalMs = 60 * 1000) {
  check();
  return setInterval(check, intervalMs);
}

const getLatest = () => latest;

module.exports = { start, check, getLatest };