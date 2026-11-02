const express = require("express");
const Candidate = require("../models/Candidate");
const Election = require("../models/Election");
const Vote = require("../models/Vote");
const User = require("../models/User");
const { requireLogin, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// ---- Election status ----
router.get("/election", requireLogin, async (req, res) => {
  const e = await Election.get();
  const totalVoters = await User.countDocuments({ role: "voter" });
  res.json({ title: e.title, status: e.status, voteCount: e.voteCount, totalVoters });
});

// An election only moves forward: not_started -> open -> closed.
// A closed election can only be archived (see routes/archive.js), never reopened.
const NEXT = { not_started: ["open"], open: ["closed"], closed: [] };

router.post("/election/status", requireLogin, requireAdmin, async (req, res) => {
  const { status } = req.body;
  const e = await Election.get();
  if (!NEXT[e.status].includes(status)) {
    return res.status(400).json({ error: `Cannot change the election from "${e.status}" to "${status}".` });
  }
  if (status === "open" && (await Candidate.countDocuments()) < 2) {
    return res.status(400).json({ error: "Add at least 2 candidates before opening the election." });
  }
  e.status = status;
  await e.save();
  res.json({ status: e.status });
});

// ---- Candidates ----
router.get("/candidates", requireLogin, async (req, res) => {
  res.json(await Candidate.find().sort({ name: 1 }));
});

router.post("/candidates", requireLogin, requireAdmin, async (req, res) => {
  const { name, position, manifesto } = req.body;
  if (!name) return res.status(400).json({ error: "Candidate name is required." });
  const e = await Election.get();
  if (e.status !== "not_started") return res.status(400).json({ error: "Candidates can only be changed before the election starts." });
  res.status(201).json(await Candidate.create({ name, position, manifesto }));
});

router.delete("/candidates/:id", requireLogin, requireAdmin, async (req, res) => {
  const e = await Election.get();
  if (e.status !== "not_started") return res.status(400).json({ error: "Candidates can only be changed before the election starts." });
  await Candidate.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

// ---- Results (aggregation) ----
router.get("/results", requireLogin, async (req, res) => {
  const e = await Election.get();
  if (e.status !== "closed" && req.user.role !== "admin") {
    return res.status(403).json({ error: "Results are shown after the election closes." });
  }
  const tally = await Vote.aggregate([
    { $group: { _id: "$candidateId", votes: { $sum: 1 } } },
  ]);
  const counts = Object.fromEntries(tally.map((t) => [String(t._id), t.votes]));
  const candidates = await Candidate.find();
  const rows = candidates
    .map((c) => ({ id: c._id, name: c.name, position: c.position, votes: counts[String(c._id)] || 0 }))
    .sort((a, b) => b.votes - a.votes);
  res.json({ status: e.status, title: e.title, total: e.voteCount, results: rows });
});

module.exports = router;