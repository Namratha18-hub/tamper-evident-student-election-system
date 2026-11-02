const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("../models/User");
const ResetTicket = require("../models/ResetTicket");
const Eligible = require("../models/Eligible");
const { requireLoginAny } = require("../middleware/auth");
const rateLimit = require("../utils/rateLimit");
const { killSessions } = require("../utils/sessions");

const router = express.Router();
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next); // async errors go to the error handler

const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });
const forgotLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 6 });
const adminForgotLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 5 });
const completeLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
const changeLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });

const publicUser = (u) => ({
  id: u._id,
  studentId: u.studentId,
  name: u.name,
  role: u.role,
  hasVoted: u.hasVoted,
  mustChangePassword: !!u.mustChangePassword,
});

const norm = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

const REQUEST_WINDOW_MS = 30 * 60 * 1000; // the officer has 30 minutes to answer

async function findTicket(ticket) {
  if (typeof ticket !== "string" || ticket.length !== 64) return null;
  return ResetTicket.findOne({ ticketHash: sha256(ticket) });
}

// Registration is for students only. Admin accounts are created by the seed script.
router.post("/register", wrap(async (req, res) => {
  const { studentId, name, password } = req.body;
  if (!studentId || !name || !password) return res.status(400).json({ error: "Student ID, name and password are required." });
  if (String(password).length < 6) return res.status(400).json({ error: "Password must be at least 6 characters." });

  // Once the officer has uploaded a list of eligible IDs, only those IDs may register.
  const id = String(studentId).toUpperCase().trim();
  if ((await Eligible.exists({})) && !(await Eligible.exists({ studentId: id }))) {
    return res.status(403).json({ error: "This student ID is not on the eligible voters list. Please contact the election officer." });
  }

  try {
    const passwordHash = await bcrypt.hash(String(password), 10);
    const user = await User.create({ studentId, name, passwordHash, role: "voter" });
    req.session.userId = user._id;
    res.status(201).json(publicUser(user));
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: "This student ID is already registered." });
    throw err;
  }
}));

// The login page tells the server which door it is (role = "voter" or "admin").
// The server checks the account's real role, so a student cannot enter through the admin page.
router.post("/login", loginLimit, wrap(async (req, res) => {
  const { studentId, password, role } = req.body;
  const wanted = role === "admin" ? "admin" : "voter";
  const user = await User.findOne({ studentId: String(studentId || "").toUpperCase().trim() });
  if (!user || !(await bcrypt.compare(String(password || ""), user.passwordHash))) {
    return res.status(401).json({ error: "Wrong ID or password." });
  }
  if (user.role !== wanted) {
    return res.status(403).json({
      error: wanted === "admin"
        ? "This is not an election officer account. Use the student login."
        : "Election officer accounts must log in from the officer login page.",
    });
  }
  if (user.mustChangePassword && user.tempExpiresAt && user.tempExpiresAt < new Date()) {
    return res.status(401).json({ error: "This temporary password has expired. Ask the election officer for a new one." });
  }
  req.session.userId = user._id;
  res.json(publicUser(user));
}));

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

router.get("/me", requireLoginAny, (req, res) => res.json(publicUser(req.user)));

// Change your own password. Also used to replace a temporary password on first login.
router.post("/change-password", changeLimit, requireLoginAny, wrap(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!(await bcrypt.compare(String(currentPassword || ""), req.user.passwordHash))) {
    return res.status(400).json({ error: "The current password is incorrect." });
  }
  if (String(newPassword || "").length < 6) return res.status(400).json({ error: "New password must be at least 6 characters." });
  if (newPassword === currentPassword) return res.status(400).json({ error: "Choose a password different from the current one." });
  req.user.passwordHash = await bcrypt.hash(String(newPassword), 10);
  req.user.mustChangePassword = false;
  req.user.tempExpiresAt = null;
  await req.user.save();
  res.json(publicUser(req.user));
}));

// Student forgot their password: open a request and get a secret ticket plus a 4-digit code.
// The answer looks the same whether or not the details matched, so outsiders cannot find out which IDs exist.
router.post("/forgot", forgotLimit, wrap(async (req, res) => {
  const { studentId, name } = req.body;
  const user = await User.findOne({ studentId: String(studentId || "").toUpperCase().trim(), role: "voter" });
  const matched = !!user && norm(user.name) === norm(name);

  const ticket = crypto.randomBytes(32).toString("hex");
  const code = String(crypto.randomInt(1000, 10000));
  const expiresAt = new Date(Date.now() + REQUEST_WINDOW_MS);

  if (matched) await ResetTicket.updateMany({ user: user._id, status: "pending" }, { status: "replaced" }); // only the newest request counts
  await ResetTicket.create({
    ticketHash: sha256(ticket),
    code,
    expiresAt,
    decoy: !matched,
    ...(matched ? { user: user._id, studentId: user.studentId, name: user.name } : {}),
  });
  res.json({ ticket, code, expiresAt });
}));

// The student's waiting page asks: has the officer answered yet?
router.post("/forgot/status", wrap(async (req, res) => {
  const t = await findTicket(req.body.ticket);
  const now = new Date();
  if (!t) return res.json({ state: "expired" });
  if (t.status === "pending") return res.json({ state: t.expiresAt > now ? "pending" : "expired" });
  if (t.status === "approved") return res.json({ state: t.approvedUntil > now ? "approved" : "expired" });
  if (t.status === "denied") return res.json({ state: "denied" });
  if (t.status === "completed") return res.json({ state: "completed" });
  res.json({ state: "expired" }); // replaced by a newer request
}));

// After approval, the student sets a new password with the same secret ticket.
router.post("/forgot/complete", completeLimit, wrap(async (req, res) => {
  const { ticket, newPassword } = req.body;
  if (String(newPassword || "").length < 6) return res.status(400).json({ error: "New password must be at least 6 characters." });

  const notApproved = { error: "This request is not approved or has expired. Please start again." };
  const t = await findTicket(ticket);
  if (!t || t.decoy || t.status !== "approved" || !(t.approvedUntil > new Date())) return res.status(400).json(notApproved);
  const user = await User.findById(t.user);
  if (!user) return res.status(400).json(notApproved);

  // Use the ticket exactly once, even if two requests arrive together.
  const claimed = await ResetTicket.findOneAndUpdate({ _id: t._id, status: "approved" }, { status: "completed" });
  if (!claimed) return res.status(400).json(notApproved);

  user.passwordHash = await bcrypt.hash(String(newPassword), 10);
  user.mustChangePassword = false;
  user.tempExpiresAt = null;
  await user.save();
  await killSessions(user._id);
  res.json({ ok: true });
}));

// Officer forgot their password: reset it with the recovery key kept in the server's .env file.
router.post("/forgot-admin", adminForgotLimit, wrap(async (req, res) => {
  const { officerId, recoveryKey, newPassword } = req.body;
  const fail = () => res.status(400).json({ error: "The details did not match." });

  const expected = process.env.ADMIN_RECOVERY_KEY || "";
  if (!expected || !officerId || !recoveryKey) return fail();

  const given = Buffer.from(String(recoveryKey));
  const wanted = Buffer.from(expected);
  const keyOk = given.length === wanted.length && crypto.timingSafeEqual(given, wanted);
  const user = await User.findOne({ studentId: String(officerId).toUpperCase().trim(), role: "admin" });
  if (!keyOk || !user) return fail();

  if (String(newPassword || "").length < 6) return res.status(400).json({ error: "New password must be at least 6 characters." });

  user.passwordHash = await bcrypt.hash(String(newPassword), 10);
  user.mustChangePassword = false;
  user.tempExpiresAt = null;
  await user.save();
  await killSessions(user._id);
  res.json({ ok: true });
}));

module.exports = router;