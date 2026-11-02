const mongoose = require("mongoose");

// A student asked the officer for help with a forgotten password.
// One request per student; it is deleted once the officer issues a password or dismisses it.
const resetSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  studentId: String,
  name: String,
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("ResetRequest", resetSchema);