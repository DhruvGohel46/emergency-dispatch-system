const Assignment = require("../models/Assignment");
const Driver = require("../models/Driver");
const Emergency = require("../models/Emergency");
const EmergencyMetrics = require("../models/EmergencyMetrics");
const geo = require("../services/geo.service");
const sms = require("../services/sms.service");
const routing = require("../services/routing.service");
const dispatch = require("../services/dispatch.service");
const eventLogger = require("../utils/eventLogger");
const messageLogger = require("../utils/messageLogger");

// Get io instance from global or app locals
const getIO = () => {
  return global.io || null;
};

/**
 * Register a new driver
 */
exports.register = async (req, res) => {
  try {
    const { name, phone, vehicleNo } = req.body;

    if (!name || !phone || !vehicleNo) {
      return res.status(400).json({
        success: false,
        message: "Name, phone, and vehicle number are required",
      });
    }

    // Check if driver already exists
    const existingDriver = await Driver.findOne({
      $or: [{ phone }, { vehicleNo: vehicleNo.toUpperCase() }],
    });

    if (existingDriver) {
      return res.status(400).json({
        success: false,
        message: "Driver with this phone or vehicle number already exists",
      });
    }

    const driver = await Driver.create({
      name,
      phone,
      vehicleNo: vehicleNo.toUpperCase(),
      status: "offline",
    });

    res.status(201).json({
      success: true,
      message: "Driver registered successfully",
      driver: {
        id: driver._id,
        name: driver.name,
        phone: driver.phone,
        vehicleNo: driver.vehicleNo,
        status: driver.status,
      },
    });
  } catch (error) {
    console.error("❌ Driver registration error:", error);
    res.status(500).json({
      success: false,
      message: "Driver registration failed",
      error: error.message,
    });
  }
};

/**
 * Update driver location (with rate limiting)
 */
exports.updateLocation = async (req, res) => {
  try {
    const { driverId, lat, lng, emergencyId } = req.body;

    // Use driverId from auth middleware if available
    const actualDriverId = req.driverId || driverId;

    if (!actualDriverId || lat === undefined || lng === undefined) {
      return res.status(400).json({
        success: false,
        message: "Driver ID, latitude, and longitude are required",
      });
    }

    const driver = await geo.updateDriverLocation(actualDriverId, lat, lng);

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found",
      });
    }

    // Emit location update via WebSocket (improved room management)
    const io = getIO();
    if (io) {
      // Emit to driver's own room
      io.to(`driver:${actualDriverId}`).emit(`driver:${actualDriverId}:location`, {
        driverId: actualDriverId,
        lat,
        lng,
        timestamp: new Date().toISOString(),
      });

      // If tracking an emergency, emit to emergency room
      if (emergencyId) {
        io.to(`emergency:${emergencyId}`).emit(`track:${emergencyId}`, {
          driverId: actualDriverId,
          lat,
          lng,
          timestamp: new Date().toISOString(),
        });

        // Log WebSocket message
        await messageLogger.logMessage({
          emergencyId,
          driverId: actualDriverId,
          from: "driver",
          to: "user",
          channel: "socket",
          message: `Driver location updated: ${lat}, ${lng}`,
          status: "sent",
        });
      }
    }

    res.json({
      success: true,
      message: "Location updated",
      driver: {
        id: driver._id,
        lat: driver.lat,
        lng: driver.lng,
        lastSeen: driver.lastSeen,
      },
    });
  } catch (error) {
    console.error("❌ Update location error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update location",
      error: error.message,
    });
  }
};

/**
 * Update driver status
 */
exports.updateStatus = async (req, res) => {
  try {
    const { driverId, status } = req.body;

    if (!driverId || !status) {
      return res.status(400).json({
        success: false,
        message: "Driver ID and status are required",
      });
    }

    const validStatuses = ["available", "busy", "offline"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    const driver = await Driver.findByIdAndUpdate(
      driverId,
      { status },
      { new: true }
    );

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found",
      });
    }

    // Emit status update via WebSocket
    const io = getIO();
    if (io) {
      io.emit(`driver:${driverId}:status`, {
        status,
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      success: true,
      message: "Status updated",
      driver: {
        id: driver._id,
        status: driver.status,
      },
    });
  } catch (error) {
    console.error("❌ Update status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update status",
      error: error.message,
    });
  }
};

/**
 * Accept emergency assignment
 */
exports.accept = async (req, res) => {
  try {
    const { driverId, emergencyId } = req.body;

    if (!driverId || !emergencyId) {
      return res.status(400).json({
        success: false,
        message: "Driver ID and Emergency ID are required",
      });
    }

    // Check if assignment exists
    const assignment = await Assignment.findOne({
      driverId,
      emergencyId,
      status: "pending",
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "No pending assignment found",
      });
    }

    // Cancel auto-redispatch timer
    dispatch.cancelAutoRedispatch(emergencyId);

    // Update assignment status
    assignment.status = "accepted";
    assignment.acceptedAt = new Date();
    await assignment.save();

    // Log acceptance event
    await eventLogger.logEvent({
      emergencyId,
      type: "ACCEPTED",
      actor: "driver",
      actorId: driverId,
      actorModel: "Driver",
      message: "Driver accepted emergency assignment",
    });

    // Update emergency status and assign driver
    const emergency = await Emergency.findByIdAndUpdate(
      emergencyId,
      {
        status: "assigned",
        assignedDriverId: driverId,
      },
      { new: true }
    );

    // Update driver status to busy
    await Driver.findByIdAndUpdate(driverId, { status: "busy" });

    // Calculate response time (time from dispatch to acceptance)
    const assignmentCreatedAt = new Date(assignment.createdAt);
    const responseTime = Math.round((Date.now() - assignmentCreatedAt.getTime()) / 1000);
    await EmergencyMetrics.findOneAndUpdate(
      { emergencyId },
      { responseTime },
      { upsert: true }
    );

    // Reject all other pending assignments for this emergency
    const rejectedAssignments = await Assignment.updateMany(
      {
        emergencyId,
        driverId: { $ne: driverId },
        status: "pending",
      },
      {
        status: "rejected",
        rejectedAt: new Date(),
        reason: "Another driver accepted",
      }
    );

    // Log rejection events for other drivers
    if (rejectedAssignments.modifiedCount > 0) {
      const rejectedDrivers = await Assignment.find({
        emergencyId,
        status: "rejected",
        rejectedAt: { $gte: new Date(Date.now() - 5000) }, // Last 5 seconds
      }).select("driverId");

      for (const rejectedAssignment of rejectedDrivers) {
        await eventLogger.logEvent({
          emergencyId,
          type: "REJECTED",
          actor: "system",
          actorId: rejectedAssignment.driverId,
          actorModel: "Driver",
          message: "Assignment rejected - another driver accepted",
        });
      }
    }

    // Get ETA for user notification
    const driver = await Driver.findById(driverId);
    let eta = null;
    if (driver && emergency) {
      try {
        eta = await routing.getETA(
          driver.lat,
          driver.lng,
          emergency.lat,
          emergency.lng
        );

        // Send SMS confirmation to user
        const smsResult = await sms.sendUserConfirmation(emergency.userPhone, driver, eta);
        
        // Log SMS message
        if (smsResult.success) {
          await messageLogger.logMessage({
            emergencyId,
            from: "system",
            to: "user",
            channel: "sms",
            message: `Ambulance dispatched! Driver: ${driver.name}, ETA: ${eta.estimatedMinutes} minutes`,
            status: "sent",
            provider: smsResult.provider || "unknown",
            providerId: smsResult.messageId || null,
          });
        }
      } catch (error) {
        console.error("⚠️  ETA calculation or SMS failed:", error.message);
      }
    }

    // Emit acceptance via WebSocket (improved room management)
    const io = getIO();
    if (io) {
      // Emit to emergency-specific room
      io.to(`emergency:${emergencyId}`).emit(`emergency:${emergencyId}:assigned`, {
        driverId,
        driver: {
          name: driver.name,
          vehicleNo: driver.vehicleNo,
          phone: driver.phone,
        },
        eta,
        timestamp: new Date().toISOString(),
      });

      // Log WebSocket message
      await messageLogger.logMessage({
        emergencyId,
        driverId,
        from: "system",
        to: "user",
        channel: "socket",
        message: `Ambulance assigned: ${driver.name} (${driver.vehicleNo})`,
        status: "sent",
      });
    }

    res.json({
      success: true,
      message: "Ambulance assigned successfully",
      assignment: {
        id: assignment._id,
        status: assignment.status,
        acceptedAt: assignment.acceptedAt,
      },
      emergency: {
        id: emergency._id,
        status: emergency.status,
        assignedDriverId: emergency.assignedDriverId,
      },
      eta,
    });
  } catch (error) {
    console.error("❌ Accept assignment error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to accept assignment",
      error: error.message,
    });
  }
};

/**
 * Reject emergency assignment
 */
exports.reject = async (req, res) => {
  try {
    const { driverId, emergencyId, reason } = req.body;

    // Use driverId from auth middleware if available
    const actualDriverId = req.driverId || driverId;

    if (!actualDriverId || !emergencyId) {
      return res.status(400).json({
        success: false,
        message: "Driver ID and Emergency ID are required",
      });
    }

    const assignment = await Assignment.findOneAndUpdate(
      {
        driverId: actualDriverId,
        emergencyId,
        status: "pending",
      },
      {
        status: "rejected",
        rejectedAt: new Date(),
        reason: reason || "Driver rejected",
      },
      { new: true }
    );

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "No pending assignment found",
      });
    }

    // Log rejection event
    await eventLogger.logEvent({
      emergencyId,
      type: "REJECTED",
      actor: "driver",
      actorId: actualDriverId,
      actorModel: "Driver",
      message: reason || "Driver rejected assignment",
    });

    // Update driver cancellation count
    await Driver.findByIdAndUpdate(
      actualDriverId,
      { $inc: { totalCancellations: 1 } }
    );

    res.json({
      success: true,
      message: "Assignment rejected",
      assignment,
    });
  } catch (error) {
    console.error("❌ Reject assignment error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reject assignment",
      error: error.message,
    });
  }
};

/**
 * Get driver assignments
 */
exports.getAssignments = async (req, res) => {
  try {
    const { driverId } = req.params;

    const assignments = await Assignment.find({ driverId })
      .populate("emergencyId", "lat lng userPhone status address createdAt")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({
      success: true,
      count: assignments.length,
      assignments,
    });
  } catch (error) {
    console.error("❌ Get assignments error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get assignments",
      error: error.message,
    });
  }
};

/**
 * Get driver profile (with all details)
 */
exports.getProfile = async (req, res) => {
  try {
    const { driverId } = req.params;

    const driver = await Driver.findById(driverId).select("-__v");

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found",
      });
    }

    // Get driver statistics
    const Assignment = require("../models/Assignment");
    const stats = await Assignment.aggregate([
      { $match: { driverId: driver._id } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const assignmentStats = stats.reduce((acc, stat) => {
      acc[stat._id] = stat.count;
      return acc;
    }, {});

    res.json({
      success: true,
      driver: {
        id: driver._id,
        name: driver.name,
        phone: driver.phone,
        vehicleNo: driver.vehicleNo,
        lat: driver.lat,
        lng: driver.lng,
        status: driver.status,
        rating: driver.rating,
        totalTrips: driver.totalTrips,
        totalCancellations: driver.totalCancellations,
        totalBreakdowns: driver.totalBreakdowns,
        kycVerified: driver.kycVerified,
        hospitalAffiliation: driver.hospitalAffiliation,
        trustScore: driver.trustScore,
        lastSeen: driver.lastSeen,
        createdAt: driver.createdAt,
        updatedAt: driver.updatedAt,
      },
      statistics: {
        assignments: assignmentStats,
        totalTrips: driver.totalTrips,
        cancellationRate: driver.totalTrips > 0 
          ? ((driver.totalCancellations / driver.totalTrips) * 100).toFixed(2) + "%"
          : "0%",
      },
    });
  } catch (error) {
    console.error("❌ Get driver profile error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get driver profile",
      error: error.message,
    });
  }
};

/**
 * Get current driver profile (from token)
 */
exports.getCurrentDriverProfile = async (req, res) => {
  try {
    const driverId = req.driverId || req.user.id;

    const driver = await Driver.findById(driverId).select("-__v");

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found",
      });
    }

    // Get driver statistics
    const Assignment = require("../models/Assignment");
    const totalAssignments = await Assignment.countDocuments({ driverId: driver._id });
    const pendingAssignments = await Assignment.countDocuments({ 
      driverId: driver._id, 
      status: "pending" 
    });
    const completedAssignments = await Assignment.countDocuments({ 
      driverId: driver._id, 
      status: "completed" 
    });

    res.json({
      success: true,
      driver: {
        id: driver._id,
        name: driver.name,
        phone: driver.phone,
        vehicleNo: driver.vehicleNo,
        lat: driver.lat,
        lng: driver.lng,
        status: driver.status,
        rating: driver.rating,
        totalTrips: driver.totalTrips,
        totalCancellations: driver.totalCancellations,
        totalBreakdowns: driver.totalBreakdowns,
        kycVerified: driver.kycVerified,
        hospitalAffiliation: driver.hospitalAffiliation,
        trustScore: driver.trustScore,
        lastSeen: driver.lastSeen,
        createdAt: driver.createdAt,
        updatedAt: driver.updatedAt,
      },
      statistics: {
        totalAssignments,
        pendingAssignments,
        completedAssignments,
        cancellationRate: driver.totalTrips > 0 
          ? ((driver.totalCancellations / driver.totalTrips) * 100).toFixed(2) + "%"
          : "0%",
      },
    });
  } catch (error) {
    console.error("❌ Get current driver profile error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get driver profile",
      error: error.message,
    });
  }
};
