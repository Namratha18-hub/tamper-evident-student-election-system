const mongoose = require("mongoose");

// Single document. headHash/voteCount form a checkpoint of the chain's tip,
// which lets verification catch votes deleted from the end.
const electionSchema = new mongoose.Schema({
  title: { type: String, default: "Student Council Election" },
  status: { type: String, enum: ["not_started", "open", "closed"], default: "not_started" },
  headHash: { type: String, default: "" },
  voteCount: { type: Number, default: 0 },
});

electionSchema.statics.get = async function () {
  return (await this.findOne()) || (await this.create({}));
};

module.exports = mongoose.model("Election", electionSchema);
