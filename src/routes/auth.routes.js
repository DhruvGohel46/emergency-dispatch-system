const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");

// Register user
router.post("/register", authController.register);

// Get user profile
router.get("/profile/:phone", authController.getProfile);

module.exports = router;
