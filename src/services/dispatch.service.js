const geo = require("./geo.service");
const Assignment = require("../models/Assignment");
const Emergency = require("../models/Emergency");
const Driver = require("../models/Driver");
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
    // Update emergency status to searching
    await Emergency.findByIdAndUpdate(emergency._id, {
      status: "searching",
    });

    // First, search within 500m radius
    let drivers = await geo.findDrivers(emergency.lat, emergency.lng, 500);

    // If no drivers found, expand to 1km
    if (drivers.length === 0) {
      console.log(`⚠️  No drivers found within 500m. Expanding search to 1km...`);
      drivers = await geo.findDrivers(emergency.lat, emergency.lng, 1000);
    }

    if (drivers.length === 0) {
      // No drivers available at all
      await Emergency.findByIdAndUpdate(emergency._id, {
        status: "failed",
      });

      // Emit failure event via WebSocket
      const io = getIO();
      if (io) {
        io.emit(`emergency:${emergency._id}:failed`, {
          message: "No drivers available",
          emergencyId: emergency._id,
        });
      }

      return {
        success: false,
        message: "No drivers available in the area",
        drivers: [],
      };
    }

    // Send dispatch requests to all nearby drivers
    const dispatchRequests = drivers.map((driver) => ({
      driverId: driver._id,
      driverName: driver.name,
      vehicleNo: driver.vehicleNo,
      distance: driver.distance,
      emergencyId: emergency._id,
      emergency: {
        lat: emergency.lat,
        lng: emergency.lng,
        userPhone: emergency.userPhone,
      },
    }));

    // Emit dispatch request to drivers via WebSocket
    const io = getIO();
    if (io) {
      drivers.forEach((driver) => {
        io.emit(`driver:${driver._id}:request`, {
          emergencyId: emergency._id,
          lat: emergency.lat,
          lng: emergency.lng,
          userPhone: emergency.userPhone,
          distance: driver.distance,
        });
      });
    }

    // Create pending assignments for each driver
    const assignments = await Promise.all(
      drivers.map((driver) =>
        Assignment.create({
          emergencyId: emergency._id,
          driverId: driver._id,
          status: "pending",
        })
      )
    );

    console.log(`✅ Dispatch requests sent to ${drivers.length} driver(s)`);
    drivers.forEach((d) => {
      console.log(`   → Request sent to ${d.name} (${d.vehicleNo}) - ${d.distance}m away`);
    });

    return {
      success: true,
      message: `Dispatched to ${drivers.length} driver(s)`,
      drivers: dispatchRequests,
      assignments,
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

    // Start new dispatch
    return await exports.start(emergency);
  } catch (error) {
    console.error("❌ Re-dispatch error:", error);
    throw error;
  }
};
