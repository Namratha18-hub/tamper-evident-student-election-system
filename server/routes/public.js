const express = require("express");
const Election = require("../models/Election");
const Archive = require("../models/Archive");
const { getLatest } = require("../utils/integrity");

const router = express.Router();

// No login needed: the landing page shows the election status, the latest chain hash
// and the most recent winner. Publishing the head hash openly is also a defence:
// anyone can note it down and compare later.
router.get("/status", async (req, res) => {
  const e = await Election.get();
  const last = await Archive.findOne().sort({ closedAt: -1 }).select("title winners topVotes closedAt").lean();
  res.json({
    title: e.title,
    status: e.status,
    voteCount: e.voteCount,
    headHash: e.headHash,
    latest: last ? { title: last.title, winners: last.winners, topVotes: last.topVotes, closedAt: last.closedAt } : null,
  });
});

// Result of the server's automatic chain check (runs every minute)
router.get("/integrity", (req, res) => res.json(getLatest()));

module.exports = router;