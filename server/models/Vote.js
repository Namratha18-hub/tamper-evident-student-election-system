const mongoose = require("mongoose");

// One link in the chain. Note: there is no userId here, so a ballot stays secret.
const voteSchema = new mongoose.Schema({
  index: { type: Number, required: true, unique: true }, // unique index = no two votes can take the same slot
  voterToken: { type: String, required: true },          // random value, not linked to any user
  candidateId: { type: mongoose.Schema.Types.ObjectId, ref: "Candidate", required: true },
  timestamp: { type: String, required: true },           // ISO string, kept as text so hashing is exact
  prevHash: { type: String, required: true },
  hash: { type: String, required: true },
});

module.exports = mongoose.model("Vote", voteSchema);
