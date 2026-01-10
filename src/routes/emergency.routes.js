const express = require("express");
const router = express.Router();
const emergencyController = require("../controllers/emergency.controller");

// Create emergency
router.post("/create", emergencyController.createEmergency);

// Get emergency by ID (includes timeline, metrics, messages)
router.get("/:id", emergencyController.getEmergency);

// Get emergency timeline/events
router.get("/:id/timeline", emergencyController.getTimeline);

// Get emergencies by user phone
router.get("/user/:phone", emergencyController.getUserEmergencies);

// Update emergency status
router.patch("/:id/status", emergencyController.updateEmergencyStatus);

// Transfer emergency (re-dispatch)
router.post("/transfer", emergencyController.transfer);

module.exports = router;
