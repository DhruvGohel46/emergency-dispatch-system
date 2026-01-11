const geo = require("./geo.service");
const Assignment = require("../models/Assignment");
const Emergency = require("../models/Emergency");
const Driver = require("../models/Driver");
const EmergencyMetrics = require("../models/EmergencyMetrics");
const eventLogger = require("../utils/eventLogger");
const messageLogger = require("../utils/messageLogger");
const smsService = require("./sms.service");

// Store active timers for cleanup
const activeTimers = new Map();

// Get io instance from global
const getIO = () => {
  return global.io || null;
};

/**
 * Start dispatch process for an emergency
 * Searches for drivers within 500m, then expands to 1km if none found
 * @param {Object} emergency - Emergency document
 * @returns {Promise<Object>} Dispatch result
 */
exports.start = async (emergency) => {
  try {
    const emergencyId = emergency._id.toString();
    const startTime = Date.now();

    // Log emergency creation event
    await eventLogger.logEvent({
      emergencyId,
      type: "CREATED",
      actor: "system",
      message: "Emergency created and dispatch initiated",
      metadata: { lat: emergency.lat, lng: emergency.lng, phone: emergency.userPhone },
    });

    // Initialize metrics
    await EmergencyMetrics.create({
      emergencyId,
      dispatchTime: 0,
      success: false,
    });

    // Update emergency status to searching
    await Emergency.findByIdAndUpdate(emergencyId, {
      status: "searching",
    });

    // First, search within 500m radius
    let drivers = await geo.findDrivers(emergency.lat, emergency.lng, 500);

    // If no drivers found, expand to 1km
    if (drivers.length === 0) {
      console.log(`⚠️  No drivers found within 500m. Expanding search to 1km...`);
      await eventLogger.logEvent({
        emergencyId,
        type: "REDISPATCHED",
        actor: "system",
        message: "No drivers within 500m, expanding search radius to 1km",
      });
      drivers = await geo.findDrivers(emergency.lat, emergency.lng, 1000);
    }

    if (drivers.length === 0) {
      // No drivers available at all
      await Emergency.findByIdAndUpdate(emergencyId, {
        status: "failed",
      });

      // Log failure event
      await eventLogger.logEvent({
        emergencyId,
        type: "FAILED",
        actor: "system",
        message: "No drivers available in the area",
      });

      // Update metrics
      await EmergencyMetrics.findOneAndUpdate(
        { emergencyId },
        {
          dispatchTime: Math.round((Date.now() - startTime) / 1000),
          success: false,
        }
      );

      // Emit failure event via WebSocket
      const io = getIO();
      if (io) {
        io.to(`emergency:${emergencyId}`).emit(`emergency:${emergencyId}:failed`, {
          message: "No drivers available",
          emergencyId,
        });

        // Log WebSocket message
        await messageLogger.logMessage({
          emergencyId,
          from: "system",
          to: "user",
          channel: "socket",
          message: "No drivers available in the area",
          status: "sent",
        });
      }

      return {
        success: false,
        message: "No drivers available in the area",
        drivers: [],
      };
    }

    // Calculate dispatch time
    const dispatchTime = Math.round((Date.now() - startTime) / 1000);
    await EmergencyMetrics.findOneAndUpdate(
      { emergencyId },
      { dispatchTime },
      { upsert: true }
    );

    // Log dispatch event
    await eventLogger.logEvent({
      emergencyId,
      type: "ASSIGNED",
      actor: "system",
      message: `Dispatched to ${drivers.length} driver(s) within ${drivers[0].distance}m`,
      metadata: { driverCount: drivers.length, distances: drivers.map((d) => d.distance) },
    });

    // Send dispatch requests to all nearby drivers
    const dispatchRequests = drivers.map((driver) => ({
      driverId: driver._id,
      driverName: driver.name,
      vehicleNo: driver.vehicleNo,
      distance: driver.distance,
      emergencyId,
      emergency: {
        lat: emergency.lat,
        lng: emergency.lng,
        userPhone: emergency.userPhone,
      },
    }));

    // Emit dispatch request to drivers via WebSocket (improved room management)
    const io = getIO();
    if (io) {
      drivers.forEach(async (driver) => {
        // Emit to driver-specific room AND emergency room
        io.to(`driver:${driver._id}`).emit(`driver:${driver._id}:request`, {
          emergencyId,
          lat: emergency.lat,
          lng: emergency.lng,
          userPhone: emergency.userPhone,
          distance: driver.distance,
        });

        // Also emit to emergency room for tracking
        io.to(`emergency:${emergencyId}`).emit(`emergency:${emergencyId}:dispatch`, {
          driverId: driver._id,
          driverName: driver.name,
          distance: driver.distance,
        });

        // Log WebSocket messages
        await messageLogger.logMessage({
          emergencyId,
          driverId: driver._id,
          from: "system",
          to: "driver",
          channel: "socket",
          message: `Emergency dispatch request - ${driver.distance}m away`,
          status: "sent",
          metadata: { distance: driver.distance },
        });

        // Send SMS notification if configured
        try {
          const smsResult = await smsService.sendDispatchNotification(driver.phone, emergency);
          if (smsResult.success) {
            await messageLogger.logMessage({
              emergencyId,
              driverId: driver._id,
              from: "system",
              to: "driver",
              channel: "sms",
              message: `Emergency alert at ${emergency.lat}, ${emergency.lng}`,
              status: "sent",
              provider: smsResult.provider || "unknown",
              providerId: smsResult.messageId || null,
            });
          }
        } catch (smsError) {
          console.error(`⚠️  SMS notification failed for driver ${driver._id}:`, smsError.message);
        }
      });
    }

    // Create pending assignments for each driver
    const assignments = await Promise.all(
      drivers.map((driver) =>
        Assignment.create({
          emergencyId,
          driverId: driver._id,
          status: "pending",
        })
      )
    );

    console.log(`✅ Dispatch requests sent to ${drivers.length} driver(s)`);
    drivers.forEach((d) => {
      console.log(`   → Request sent to ${d.name} (${d.vehicleNo}) - ${d.distance}m away`);
    });

    // 🔥 AUTO-REDISPATCH TIMER: If no driver accepts in 2 minutes, auto-redispatch
    // Clear any existing timer for this emergency
    if (activeTimers.has(emergencyId)) {
      clearTimeout(activeTimers.get(emergencyId));
    }

    const autoRedispatchTimer = setTimeout(async () => {
      try {
        // Check if any assignment is still pending
        const stillPending = await Assignment.findOne({
          emergencyId,
          status: "pending",
        });

        if (stillPending) {
          console.log(`⏰ Auto-redispatch triggered for emergency ${emergencyId} (2 min timeout)`);
          await eventLogger.logEvent({
            emergencyId,
            type: "REDISPATCHED",
            actor: "system",
            message: "Auto-redispatch: No driver accepted within 2 minutes",
          });

          // Update metrics
          await EmergencyMetrics.findOneAndUpdate(
            { emergencyId },
            { $inc: { redispatchCount: 1 } }
          );

          // Redispatch with expanded radius
          await exports.redispatch(emergencyId);
        }

        // Clean up timer
        activeTimers.delete(emergencyId);
      } catch (error) {
        console.error("❌ Auto-redispatch error:", error);
        activeTimers.delete(emergencyId);
      }
    }, 120000); // 2 minutes = 120000ms

    activeTimers.set(emergencyId, autoRedispatchTimer);

    return {
      success: true,
      message: `Dispatched to ${drivers.length} driver(s)`,
      drivers: dispatchRequests,
      assignments,
      autoRedispatchIn: 120, // seconds
    };
  } catch (error) {
    console.error("❌ Dispatch error:", error);
    throw error;
  }
};

/**
 * Re-dispatch an emergency (used for transfers)
 * @param {string} emergencyId - Emergency ID
 * @returns {Promise<Object>} Re-dispatch result
 */
exports.redispatch = async (emergencyId) => {
  try {
    const emergency = await Emergency.findById(emergencyId);

    if (!emergency) {
      throw new Error("Emergency not found");
    }

    // Log redispatch event
    await eventLogger.logEvent({
      emergencyId: emergencyId.toString(),
      type: "REDISPATCHED",
      actor: "system",
      message: "Emergency re-dispatched with expanded radius",
    });

    // Clear auto-redispatch timer if exists
    if (activeTimers.has(emergencyId.toString())) {
      clearTimeout(activeTimers.get(emergencyId.toString()));
      activeTimers.delete(emergencyId.toString());
    }

    // Reset emergency status
    emergency.status = "searching";
    emergency.assignedDriverId = null;
    await emergency.save();

    // Cancel existing pending assignments
    await Assignment.updateMany(
      {
        emergencyId,
        status: { $in: ["pending", "accepted"] },
      },
      {
        status: "failed",
        reason: "Re-dispatch initiated",
      }
    );

    // Update metrics
    await EmergencyMetrics.findOneAndUpdate(
      { emergencyId },
      { $inc: { redispatchCount: 1 } },
      { upsert: true }
    );

    // 🚨 ROOT CAUSE #1 FIX: Notify all drivers that emergency is searching again
    const io = getIO();
    if (io) {
      io.to("drivers").emit("emergency:searching", {
        emergencyId: emergencyId.toString(),
        timestamp: new Date().toISOString(),
      });
    }

    // Start new dispatch (will search with expanded radius automatically)
    return await exports.start(emergency);
  } catch (error) {
    console.error("❌ Re-dispatch error:", error);
    throw error;
  }
};

/**
 * Cancel auto-redispatch timer (when driver accepts)
 * @param {string} emergencyId - Emergency ID
 */
exports.cancelAutoRedispatch = (emergencyId) => {
  if (activeTimers.has(emergencyId.toString())) {
    clearTimeout(activeTimers.get(emergencyId.toString()));
    activeTimers.delete(emergencyId.toString());
    console.log(`✅ Auto-redispatch timer cancelled for emergency ${emergencyId}`);
  }
};
