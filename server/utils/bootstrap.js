const bcrypt = require("bcryptjs");
const User = require("../models/User");

// On a fresh database (for example the first time the site is deployed) there is no officer yet.
// If ADMIN_INITIAL_PASSWORD is set, create the officer account "ADMIN" with it.
async function ensureAdmin() {
  if (await User.exists({ role: "admin" })) return;
  const password = process.env.ADMIN_INITIAL_PASSWORD;
  if (!password) {
    console.warn("No officer account exists. Set ADMIN_INITIAL_PASSWORD in the environment, or run: npm run seed");
    return;
  }
  await User.create({
    studentId: "ADMIN",
    name: "Election Officer",
    passwordHash: await bcrypt.hash(String(password), 10),
    role: "admin",
  });
  console.log("Officer account ADMIN created from ADMIN_INITIAL_PASSWORD. Log in and change the password.");
}

module.exports = { ensureAdmin };
