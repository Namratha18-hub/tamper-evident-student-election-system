// Core of the project: the hash chain.
// Each vote's hash covers its own data AND the previous vote's hash.
const crypto = require("crypto");

const GENESIS_HASH = "0".repeat(64);

function computeHash({ index, voterToken, candidateId, timestamp, prevHash }) {
  const data = [index, voterToken, String(candidateId), timestamp, prevHash].join("|");
  return crypto.createHash("sha256").update(data).digest("hex");
}

// Walks the chain from vote #1 and reports the first problem it finds.
function verifyChain(votes, anchor) {
  let prevHash = GENESIS_HASH;
  for (let i = 0; i < votes.length; i++) {
    const v = votes[i];
    if (v.index !== i + 1) {
      return { valid: false, brokenAt: i + 1, reason: `Vote #${i + 1} is missing (a vote was deleted or inserted).` };
    }
    if (v.prevHash !== prevHash) {
      return { valid: false, brokenAt: v.index, reason: `Vote #${v.index} does not link to the vote before it.` };
    }
    if (computeHash(v) !== v.hash) {
      return { valid: false, brokenAt: v.index, reason: `Vote #${v.index} was modified: its stored hash does not match its contents.` };
    }
    prevHash = v.hash;
  }
  // Anchor = the latest hash and count saved separately at the time of each vote.
  if (anchor) {
    if (anchor.voteCount !== votes.length) {
      return { valid: false, brokenAt: votes.length + 1, reason: `Expected ${anchor.voteCount} votes but found ${votes.length}. Votes were removed from the end.` };
    }
    if (votes.length && anchor.headHash !== prevHash) {
      return { valid: false, brokenAt: votes.length, reason: "The last vote does not match the saved checkpoint." };
    }
  }
  return { valid: true, brokenAt: null, reason: `All ${votes.length} votes are linked and unmodified.` };
}

module.exports = { GENESIS_HASH, computeHash, verifyChain };
