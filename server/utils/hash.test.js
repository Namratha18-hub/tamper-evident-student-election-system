// Run:  npm run test:hash   (no database needed)
const assert = require("assert");
const { GENESIS_HASH, computeHash, verifyChain } = require("./hash");

function build(n) {
  const votes = [];
  let prevHash = GENESIS_HASH;
  for (let i = 1; i <= n; i++) {
    const v = { index: i, voterToken: "tok" + i, candidateId: "c" + (i % 2), timestamp: new Date().toISOString(), prevHash };
    v.hash = computeHash(v);
    votes.push(v);
    prevHash = v.hash;
  }
  return votes;
}

assert.ok(verifyChain(build(5)).valid, "clean chain should be valid");

let t = build(5); t[2].candidateId = "c9";
let r = verifyChain(t);
assert.deepStrictEqual([r.valid, r.brokenAt], [false, 3], "edit detected at #3");

t = build(5); t.splice(1, 1);
assert.strictEqual(verifyChain(t).valid, false, "deletion detected");

t = build(5);
const anchor = { voteCount: 5, headHash: t[4].hash };
assert.strictEqual(verifyChain(t.slice(0, 4), anchor).valid, false, "tail deletion detected via anchor");
console.log("All hash-chain tests passed.");
