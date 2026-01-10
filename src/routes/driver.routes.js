const express = require("express");
const router = express.Router();
const driverController = require("../controllers/driver.controller");

// Register driver
router.post("/register", driverController.register);

// Update driver location
router.post("/location", driverController.updateLocation);

// Update driver status
router.post("/status", driverController.updateStatus);

// Accept emergency assignment
router.post("/accept", driverController.accept);

// Reject emergency assignment
router.post("/reject", driverController.reject);

// Get driver assignments
router.get("/:driverId/assignments", driverController.getAssignments);

// Get driver profile
router.get("/:driverId", driverController.getProfile);

module.exports = router;
