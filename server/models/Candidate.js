const mongoose = require("mongoose");

const candidateSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  position: { type: String, default: "Student Council President", trim: true },
  manifesto: { type: String, default: "", trim: true },
});

module.exports = mongoose.model("Candidate", candidateSchema);
