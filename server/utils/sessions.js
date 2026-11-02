const mongoose = require("mongoose");

// After a password reset, log the person out everywhere by deleting their saved sessions.
async function killSessions(userId) {
  try {
    await mongoose.connection.db.collection("sessions").deleteMany({ session: { $regex: String(userId) } });
  } catch (err) {
    console.error("Could not clear old sessions:", err.message);
  }
}

module.exports = { killSessions };