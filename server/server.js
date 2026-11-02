require("dotenv").config();
// Some networks cannot resolve MongoDB Atlas "SRV" addresses. If that happens,
// set DNS_SERVERS=8.8.8.8,1.1.1.1 in .env and Node will use those DNS servers.
if (process.env.DNS_SERVERS) require("dns").setServers(process.env.DNS_SERVERS.split(","));

const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const mongoose = require("mongoose");
const integrity = require("./utils/integrity");

// Log unexpected errors instead of letting one bad request kill the whole server.
process.on("unhandledRejection", (err) => console.error("Unhandled error:", err));
process.on("uncaughtException", (err) => console.error("Uncaught error:", err));

const app = express();
const PORT = process.env.PORT || 5000;

async function start() {
  // 1. Connect once. The session store below reuses this same connection.
  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
    console.log("MongoDB connected.");
  } catch (err) {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  }

  // 2. Middleware and routes (1 MB limit so an eligible-voters list can be uploaded)
  app.use(express.json({ limit: "1mb" }));
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "dev-secret",
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({ client: mongoose.connection.getClient() }),
      cookie: { httpOnly: true, sameSite: "lax", maxAge: 1000 * 60 * 60 * 2 }, // 2 hours
    })
  );

  app.use("/api/public", require("./routes/public"));
  app.use("/api/auth", require("./routes/auth"));
  app.use("/api", require("./routes/election"));
  app.use("/api", require("./routes/vote"));
  app.use("/api", require("./routes/archive"));
  app.use("/api/admin", require("./routes/admin"));

  app.get("/api/health", (req, res) => res.json({ ok: true }));
  app.use("/api", (req, res) => res.status(404).json({ error: "Route not found." }));

  // 3. Any error thrown inside a route ends up here and is printed in this terminal.
  app.use((err, req, res, next) => {
    console.error("Request failed:", req.method, req.originalUrl, err);
    res.status(500).json({ error: "Server error. Please try again." });
  });

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    integrity.start(); // automatic chain check, once a minute
  });
}

start();