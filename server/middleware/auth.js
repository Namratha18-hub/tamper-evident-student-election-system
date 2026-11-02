const User = require("../models/User");

// Looks up the logged-in user from the session cookie.
async function loadUser(req, res) {
  if (!req.session.userId) {
    res.status(401).json({ error: "Please log in first." });
    return null;
  }
  const user = await User.findById(req.session.userId);
  if (!user) {
    res.status(401).json({ error: "Session expired. Please log in again." });
    return null;
  }
  return user;
}

// Guard for the few routes a person may use even while they still have to change a temporary password
async function requireLoginAny(req, res, next) {
  try {
    const user = await loadUser(req, res);
    if (!user) return;
    req.user = user;
    next();
  } catch (err) { next(err); }
}

// Guard 1: must be logged in, and must not be stuck on a temporary password
async function requireLogin(req, res, next) {
  try {
    const user = await loadUser(req, res);
    if (!user) return;
    if (user.mustChangePassword) {
      return res.status(403).json({ error: "Please set a new password first.", code: "MUST_CHANGE_PASSWORD" });
    }
    req.user = user;
    next();
  } catch (err) { next(err); }
}

// Guard 2: must be admin (runs after requireLogin)
function requireAdmin(req, res, next) {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Admin access only." });
  next();
}

module.exports = { requireLogin, requireLoginAny, requireAdmin };