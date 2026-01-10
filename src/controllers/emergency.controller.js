const Emergency = require("../models/Emergency");
const dispatch = require("../services/dispatch.service");

/**
 * Create a new emergency
 */
exports.createEmergency = async (req, res) => {
  try {
    const { lat, lng, phone, address, notes } = req.body;

    if (!lat || !lng || !phone) {
      return res.status(400).json({
        success: false,
        message: "Latitude, longitude, and phone are required",
      });
    }

    // Validate coordinates
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({
        success: false,
        message: "Invalid coordinates",
      });
    }

    // Create emergency
    const emergency = await Emergency.create({
      userPhone: phone,
      lat,
      lng,
      address,
      notes,
      status: "searching",
    });

    // Start dispatch process
    const dispatchResult = await dispatch.start(emergency);

    res.status(201).json({
      success: true,
      message: "Emergency created and dispatch initiated",
      emergency: {
        id: emergency._id,
        userPhone: emergency.userPhone,
        lat: emergency.lat,
        lng: emergency.lng,
        status: emergency.status,
        createdAt: emergency.createdAt,
      },
      dispatch: dispatchResult,
    });
  } catch (error) {
    console.error("❌ Create emergency error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create emergency",
      error: error.message,
    });
  }
};

/**
 * Get emergency by ID
 */
exports.getEmergency = async (req, res) => {
  try {
    const { id } = req.params;

    const emergency = await Emergency.findById(id)
      .populate("assignedDriverId", "name phone vehicleNo")
      .lean();

    if (!emergency) {
      return res.status(404).json({
        success: false,
        message: "Emergency not found",
      });
    }

    res.json({
      success: true,
      emergency,
    });
  } catch (error) {
    console.error("❌ Get emergency error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get emergency",
      error: error.message,
    });
  }
};

/**
 * Get emergencies by user phone
 */
exports.getUserEmergencies = async (req, res) => {
  try {
    const { phone } = req.params;

    const emergencies = await Emergency.find({ userPhone: phone })
      .populate("assignedDriverId", "name phone vehicleNo")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({
      success: true,
      count: emergencies.length,
      emergencies,
    });
  } catch (error) {
    console.error("❌ Get user emergencies error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get emergencies",
      error: error.message,
    });
  }
};

/**
 * Update emergency status
 */
exports.updateEmergencyStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ["searching", "assigned", "enroute", "hospital", "failed", "completed"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    const emergency = await Emergency.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!emergency) {
      return res.status(404).json({
        success: false,
        message: "Emergency not found",
      });
    }

    // Emit status update via WebSocket
    const io = global.io || null;
    if (io) {
      io.emit(`emergency:${id}:status`, {
        status,
        emergencyId: id,
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      success: true,
      message: "Emergency status updated",
      emergency,
    });
  } catch (error) {
    console.error("❌ Update emergency status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update emergency status",
      error: error.message,
    });
  }
};

/**
 * Transfer emergency (re-dispatch)
 */
exports.transfer = async (req, res) => {
  try {
    const { emergencyId, reason } = req.body;

    if (!emergencyId) {
      return res.status(400).json({
        success: false,
        message: "Emergency ID is required",
      });
    }

    const emergency = await Emergency.findById(emergencyId);
    if (!emergency) {
      return res.status(404).json({
        success: false,
        message: "Emergency not found",
      });
    }

    // Update current assignment to failed
    const Assignment = require("../models/Assignment");
    await Assignment.updateMany(
      { emergencyId, status: { $in: ["pending", "accepted"] } },
      {
        status: "failed",
        reason: reason || "Emergency transfer requested",
      }
    );

    // Reset emergency status
    emergency.status = "searching";
    emergency.assignedDriverId = null;
    await emergency.save();

    // Re-dispatch
    const dispatchResult = await dispatch.start(emergency);

    res.json({
      success: true,
      message: "Emergency re-dispatched",
      dispatch: dispatchResult,
    });
  } catch (error) {
    console.error("❌ Transfer emergency error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to transfer emergency",
      error: error.message,
    });
  }
};
