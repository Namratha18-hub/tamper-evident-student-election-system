const express = require("express");
const mongoose = require("mongoose");
const Archive = require("../models/Archive");
const Election = require("../models/Election");
const Vote = require("../models/Vote");
const Candidate = require("../models/Candidate");
const User = require("../models/User");
const { requireLogin, requireAdmin } = require("../middleware/auth");
const { verifyChain } = require("../utils/hash");

const router = express.Router();
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next); // send async errors to the error handler

// List finished elections (summary only, newest first)
router.get("/archives", requireLogin, wrap(async (req, res) => {
  res.json(await Archive.find().select("-votes").sort({ closedAt: -1 }).lean());
}));

// Re-verify the chain of one finished election
router.get("/archives/:id/verify", requireLogin, wrap(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "Election not found." });
  const a = await Archive.findById(req.params.id).lean();
  if (!a) return res.status(404).json({ error: "Election not found." });
  const votes = [...a.votes].sort((x, y) => x.index - y.index);
  const result = verifyChain(votes, { voteCount: a.totalVotes, headHash: a.headHash });
  res.json({ ...result, checked: votes.length, checkedAt: new Date().toISOString() });
}));

// Admin: save the closed election, then clear everything for a new one
router.post("/archives", requireLogin, requireAdmin, wrap(async (req, res) => {
  const nextTitle = String(req.body.nextTitle || "").trim() || "Student Council Election";

  // Atomically claim the election: only a CLOSED one can be archived, and only once.
  const before = await Election.findOneAndUpdate({ status: "closed" }, { status: "not_started" }, { new: false });
  if (!before) return res.status(400).json({ error: "Close the election before archiving it." });

  try {
    const [votes, candidates] = await Promise.all([Vote.find().sort({ index: 1 }).lean(), Candidate.find().lean()]);

    const counts = {};
    votes.forEach((v) => { counts[String(v.candidateId)] = (counts[String(v.candidateId)] || 0) + 1; });
    const rows = candidates
      .map((c) => ({ candidateId: c._id, name: c.name, position: c.position, votes: counts[String(c._id)] || 0 }))
      .sort((a, b) => b.votes - a.votes);
    const topVotes = rows.length ? rows[0].votes : 0;
    const winners = topVotes > 0 ? rows.filter((r) => r.votes === topVotes).map((r) => r.name) : [];

    const archive = await Archive.create({
      title: before.title,
      totalVotes: before.voteCount,
      headHash: before.headHash,
      topVotes,
      winners,
      candidates: rows,
      votes: votes.map(({ index, voterToken, candidateId, timestamp, prevHash, hash }) => ({ index, voterToken, candidateId, timestamp, prevHash, hash })),
    });

    // Only after the copy is safely stored do we clear the live election.
    await Vote.deleteMany({});
    await Candidate.deleteMany({});
    await User.updateMany({ role: "voter" }, { hasVoted: false });
    await Election.updateOne({}, { title: nextTitle, headHash: "", voteCount: 0 });

    res.status(201).json({ ok: true, archiveId: archive._id });
  } catch (err) {
    console.error("Archive failed:", err);
    await Election.updateOne({}, { status: "closed" }); // put it back so nothing is lost
    res.status(500).json({ error: "Could not archive the election. Please try again." });
  }
}));

module.exports = router;