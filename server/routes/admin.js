const express = require("express");
const mongoose = require("mongoose");
const ResetTicket = require("../models/ResetTicket");
const Eligible = require("../models/Eligible");
const { requireLogin, requireAdmin } = require("../middleware/auth");
const { parseIds } = require("../utils/ids");

const router = express.Router();
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

const APPROVAL_WINDOW_MS = 10 * 60 * 1000; // after approval the student has 10 minutes to set a new password

// ---------- Password reset requests ----------

// Pending requests (with the 4-digit code to compare) and the latest decisions
router.get("/resets", requireLogin, requireAdmin, wrap(async (req, res) => {
  const now = new Date();
  const [pending, recent] = await Promise.all([
    ResetTicket.find({ status: "pending", decoy: false, expiresAt: { $gt: now } })
      .sort({ createdAt: 1 })
      .select("studentId name code createdAt expiresAt")
      .lean(),
    ResetTicket.find({ decoy: false, status: { $in: ["approved", "denied", "completed"] } })
      .sort({ decidedAt: -1 })
      .limit(10)
      .select("studentId name status decidedBy decidedAt")
      .lean(),
  ]);
  res.json({ pending, recent });
}));

// Approve or deny a pending request. Neither action creates or shows any password.
function decide(status) {
  return wrap(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "Request not found." });
    const now = new Date();
    const update = { status, decidedBy: req.user.studentId, decidedAt: now };
    if (status === "approved") update.approvedUntil = new Date(now.getTime() + APPROVAL_WINDOW_MS);

    const ticket = await ResetTicket.findOneAndUpdate(
      { _id: req.params.id, status: "pending", decoy: false, expiresAt: { $gt: now } },
      update,
      { new: true }
    );
    if (!ticket) return res.status(404).json({ error: "That request is no longer pending." });
    res.json({ ok: true, status: ticket.status });
  });
}

router.post("/resets/:id/approve", requireLogin, requireAdmin, decide("approved"));
router.post("/resets/:id/deny", requireLogin, requireAdmin, decide("denied"));

// ---------- Eligible voters list ----------

router.get("/eligible", requireLogin, requireAdmin, wrap(async (req, res) => {
  res.json({ total: await Eligible.countDocuments() });
}));

// Add IDs from pasted text or a CSV file. Existing IDs are kept, duplicates are ignored.
router.post("/eligible", requireLogin, requireAdmin, wrap(async (req, res) => {
  const ids = parseIds(req.body.text);
  if (ids.length === 0) return res.status(400).json({ error: "No valid student IDs were found in that text." });

  const result = await Eligible.bulkWrite(
    ids.map((studentId) => ({ updateOne: { filter: { studentId }, update: { $setOnInsert: { studentId } }, upsert: true } }))
  );
  res.json({ found: ids.length, added: result.upsertedCount, total: await Eligible.countDocuments() });
}));

// Remove the whole list (registration becomes open to anyone again)
router.delete("/eligible", requireLogin, requireAdmin, wrap(async (req, res) => {
  await Eligible.deleteMany({});
  res.json({ ok: true });
}));

module.exports = router;