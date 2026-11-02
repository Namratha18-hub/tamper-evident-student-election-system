// Tiny in-memory rate limiter (no extra package). Counts requests per IP address.
function rateLimit({ windowMs, max, message }) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const recent = (hits.get(req.ip) || []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      return res.status(429).json({ error: message || "Too many attempts. Please wait a few minutes and try again." });
    }
    recent.push(now);
    hits.set(req.ip, recent);
    if (hits.size > 5000) {
      for (const [ip, list] of hits) if (!list.some((t) => now - t < windowMs)) hits.delete(ip);
    }
    next();
  };
}

module.exports = rateLimit;