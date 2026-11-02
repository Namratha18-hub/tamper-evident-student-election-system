const mongoose = require("mongoose");

// "Who has voted" lives here. It is NEVER linked to which candidate was chosen.
const userSchema = new mongoose.Schema({
  studentId: { type: String, required: true, unique: true, uppercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ["voter", "admin"], default: "voter" },
  hasVoted: { type: Boolean, default: false },
  mustChangePassword: { type: Boolean, default: false }, // true after the officer issues a temporary password
  tempExpiresAt: { type: Date, default: null },          // the temporary password stops working after this
});

module.exports = mongoose.model("User", userSchema);