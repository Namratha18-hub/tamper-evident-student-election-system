const mongoose = require("mongoose");

// One "forgot password" request. The student keeps a secret ticket in their browser;
// only its SHA-256 hash is stored here. A request whose ID and name did not match gets a
// "decoy" ticket, so the answer looks identical and nobody can discover which IDs exist.
const ticketSchema = new mongoose.Schema({
  ticketHash: { type: String, required: true, unique: true },
  code: { type: String, required: true },                 // 4-digit code the student and the officer compare
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true }, // missing for decoys
  studentId: String,
  name: String,
  decoy: { type: Boolean, default: false },
  status: { type: String, enum: ["pending", "approved", "denied", "completed", "replaced"], default: "pending" },
  expiresAt: { type: Date, required: true },              // the officer must decide before this
  approvedUntil: Date,                                    // the student must set the new password before this
  decidedBy: String,
  decidedAt: Date,
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 7 }, // auto-delete after 7 days
});

module.exports = mongoose.model("ResetTicket", ticketSchema);