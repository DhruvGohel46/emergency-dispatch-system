const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

// Import configs
require("./config/db");
require("./config/redis");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Store io instance globally for services to access
app.locals.io = io;
global.io = io;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Import routes
const authRoutes = require("./routes/auth.routes");
const emergencyRoutes = require("./routes/emergency.routes");
const driverRoutes = require("./routes/driver.routes");
const smsRoutes = require("./routes/sms.routes");
const trafficRoutes = require("./routes/traffic.routes");

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/emergency", emergencyRoutes);
app.use("/api/driver", driverRoutes);
app.use("/api/sms", smsRoutes);
app.use("/api/traffic", trafficRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Initialize WebSocket
const trackingSocket = require("./sockets/tracking.socket");
trackingSocket(io);

module.exports = { app, server, io };
