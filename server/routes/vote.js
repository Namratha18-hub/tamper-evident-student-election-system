const express = require("express");
const crypto = require("crypto");
const Vote = require("../models/Vote");
const User = require("../models/User");
const Candidate = require("../models/Candidate");
const Election = require("../models/Election");
const Archive = require("../models/Archive");
const { requireLogin } = require("../middleware/auth");
const { GENESIS_HASH, computeHash, verifyChain } = require("../utils/hash");

const router = express.Router();
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next); // async errors go to the error handler

// Cast a vote
router.post("/vote", requireLogin, wrap(async (req, res) => {
  const { candidateId } = req.body;
  const election = await Election.get();
  if (election.status !== "open") return res.status(400).json({ error: "Voting is not open right now." });
  if (req.user.role === "admin") return res.status(403).json({ error: "Admins cannot vote." });
  if (!(await Candidate.exists({ _id: candidateId }))) return res.status(400).json({ error: "Unknown candidate." });

  // Step 1: atomically mark the user as voted. If hasVoted was already true, nothing matches -> rejected.
  const claimed = await User.findOneAndUpdate({ _id: req.user._id, hasVoted: false }, { hasVoted: true });
  if (!claimed) return res.status(409).json({ error: "You have already voted." });

  // Step 2: append to the chain. Retry if two votes race for the same index (unique index protects us).
  const voterToken = crypto.randomBytes(16).toString("hex");
  for (let attempt = 0; attempt < 8; attempt++) {
    const last = await Vote.findOne().sort({ index: -1 });
    const vote = {
      index: last ? last.index + 1 : 1,
      voterToken,
      candidateId,
      timestamp: new Date().toISOString(),
      prevHash: last ? last.hash : GENESIS_HASH,
    };
    vote.hash = computeHash(vote);
    try {
      await Vote.create(vote);
      await Election.updateOne({}, { headHash: vote.hash, voteCount: vote.index });
      return res.status(201).json({ message: "Vote recorded.", receipt: voterToken, hash: vote.hash, index: vote.index });
    } catch (err) {
      if (err.code !== 11000) break; // only retry on duplicate index
    }
  }
  await User.updateOne({ _id: req.user._id }, { hasVoted: false }); // roll back so the student can try again
  res.status(500).json({ error: "Could not record your vote. Please try again." });
}));

// Public ledger: anonymous list of the chain (token, candidate, hashes). Sorted by index.
router.get("/ledger", requireLogin, wrap(async (req, res) => {
  const votes = await Vote.find().sort({ index: 1 }).populate("candidateId", "name");
  res.json(votes.map((v) => ({
    index: v.index,
    voterToken: v.voterToken,
    candidate: v.candidateId ? v.candidateId.name : "(unknown)",
    timestamp: v.timestamp,
    prevHash: v.prevHash,
    hash: v.hash,
  })));
}));

// Verify the whole chain by recomputing every hash
router.get("/verify", requireLogin, wrap(async (req, res) => {
  const votes = await Vote.find().sort({ index: 1 }).lean();
  const e = await Election.get();
  const result = verifyChain(votes, { voteCount: e.voteCount, headHash: e.headHash });
  res.json({ ...result, checked: votes.length, checkedAt: new Date().toISOString() });
}));

// Explains one vote: where it sits in the chain and whether its links hold.
function describeVote({ vote, prev, next, candidate, election, total, archived }) {
  const hashMatches = computeHash(vote) === vote.hash;
  const linksToPrevious = vote.prevHash === (prev ? prev.hash : GENESIS_HASH);
  const nextLinksToThis = next ? next.prevHash === vote.hash : null; // null = this is the latest vote
  return {
    election,
    archived,
    index: vote.index,
    total,
    candidate: candidate || "(unknown)",
    timestamp: vote.timestamp,
    prevHash: vote.prevHash,
    hash: vote.hash,
    checks: { hashMatches, linksToPrevious, nextLinksToThis },
    ok: hashMatches && linksToPrevious && nextLinksToThis !== false,
  };
}

// Find my vote: look a receipt up in the current election first, then in archived ones.
router.get("/receipt/:token", requireLogin, wrap(async (req, res) => {
  const token = String(req.params.token || "").trim().toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(token)) return res.status(400).json({ error: "That does not look like a receipt. It is 32 letters and digits." });

  const vote = await Vote.findOne({ voterToken: token }).lean();
  if (vote) {
    const [prev, next, candidate, election] = await Promise.all([
      vote.index > 1 ? Vote.findOne({ index: vote.index - 1 }).lean() : null,
      Vote.findOne({ index: vote.index + 1 }).lean(),
      Candidate.findById(vote.candidateId).lean(),
      Election.get(),
    ]);
    return res.json(describeVote({ vote, prev, next, candidate: candidate && candidate.name, election: election.title, total: election.voteCount, archived: false }));
  }

  const archive = await Archive.findOne({ "votes.voterToken": token }).lean();
  if (archive) {
    const votes = [...archive.votes].sort((a, b) => a.index - b.index);
    const pos = votes.findIndex((v) => v.voterToken === token);
    const row = archive.candidates.find((c) => String(c.candidateId) === String(votes[pos].candidateId));
    return res.json(describeVote({
      vote: votes[pos],
      prev: votes[pos - 1] || null,
      next: votes[pos + 1] || null,
      candidate: row && row.name,
      election: archive.title,
      total: archive.totalVotes,
      archived: true,
    }));
  }

  res.status(404).json({ error: "No vote with this receipt was found, in the current election or in past ones." });
}));

module.exports = router;