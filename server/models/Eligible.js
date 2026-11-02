const mongoose = require("mongoose");

// A student ID the officer has approved for registration.
// While this list is empty, anyone can register. Once it has entries, only these IDs can.
const eligibleSchema = new mongoose.Schema({
  studentId: { type: String, required: true, unique: true, uppercase: true, trim: true },
});

module.exports = mongoose.model("Eligible", eligibleSchema);