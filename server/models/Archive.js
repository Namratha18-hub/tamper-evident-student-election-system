const mongoose = require("mongoose");

// A finished election, saved with everything needed to show the winner and re-verify its chain.
const resultRow = new mongoose.Schema(
  { candidateId: mongoose.Schema.Types.ObjectId, name: String, position: String, votes: Number },
  { _id: false }
);

const archivedVote = new mongoose.Schema(
  {
    index: Number,
    voterToken: String,
    candidateId: mongoose.Schema.Types.ObjectId,
    timestamp: String,
    prevHash: String,
    hash: String,
  },
  { _id: false }
);

const archiveSchema = new mongoose.Schema({
  title: { type: String, required: true },
  closedAt: { type: Date, default: Date.now },
  totalVotes: { type: Number, default: 0 },
  headHash: { type: String, default: "" }, // checkpoint of the chain's last hash at closing time
  topVotes: { type: Number, default: 0 },  // votes the winner(s) received
  winners: [String],                        // more than one name means a tie
  candidates: [resultRow],                  // final tally, highest first
  votes: [archivedVote],                    // the full chain, so it can be verified later
});

module.exports = mongoose.model("Archive", archiveSchema);