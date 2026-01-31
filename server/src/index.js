const path = require("path");
const fs = require("fs");

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const mongoose = require("mongoose");
require("dotenv").config();

const jobsRoutes = require("./routes/jobs");
const { initJobStore } = require("./utils/jobStore");
const { checkServiceHealth } = require("./utils/transcriptionServiceClient");

const app = express();

app.use(cors());
app.use(morgan("dev"));

// Note: multipart/form-data is handled by multer on the route.
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", async (_req, res) => {
  const transcriptionOk = await checkServiceHealth();
  res.json({
    ok: true,
    transcriptionService: transcriptionOk ? "connected" : "disconnected",
  });
});

app.use("/api", jobsRoutes);

// Serve built React app if it exists (production-friendly).
const clientDist = path.join(__dirname, "..", "..", "client", "dist");
const clientIndex = path.join(clientDist, "index.html");
if (fs.existsSync(clientDist) && fs.existsSync(clientIndex)) {
  app.use(express.static(clientDist));
  app.get("*", (req, res) => res.sendFile(clientIndex));
}

// Basic error handler
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Server error" });
});

async function start() {
  const port = Number(process.env.PORT || 5000);

  let dbReady = false;
  const mongoUri = process.env.MONGO_URI;
  if (mongoUri) {
    try {
      await mongoose.connect(mongoUri);
      dbReady = true;
      console.log("MongoDB connected");
    } catch (e) {
      console.warn("MongoDB connection failed; falling back to in-memory job store.");
    }
  }

  initJobStore({ dbReady });

  app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
  });
}

start();

