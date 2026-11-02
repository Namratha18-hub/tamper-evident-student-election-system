// Creates the admin account and sample candidates.   Run once:  npm run seed
require("dotenv").config();
if (process.env.DNS_SERVERS) require("dns").setServers(process.env.DNS_SERVERS.split(","));

const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User = require("./models/User");
const Candidate = require("./models/Candidate");
const Election = require("./models/Election");

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  if (!(await User.findOne({ studentId: "ADMIN" }))) {
    await User.create({ studentId: "ADMIN", name: "Election Officer", passwordHash: await bcrypt.hash("admin123", 10), role: "admin" });
    console.log("Admin created ->  ID: ADMIN   Password: admin123  (change it!)");
  }
  if ((await Candidate.countDocuments()) === 0) {
    await Candidate.insertMany([
      { name: "Ananya Reddy", manifesto: "Better lab access and a 24x7 library during exams." },
      { name: "Rohit Varma", manifesto: "More industry talks and a transparent club budget." },
      { name: "Sneha Iyer", manifesto: "Campus Wi-Fi upgrade and a student grievance portal." },
    ]);
    console.log("Sample candidates added.");
  }
  await Election.get();
  await mongoose.disconnect();
})();