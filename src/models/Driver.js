const mongoose = require("mongoose");

const driverSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  vehicleNo: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true,
  },
  lat: {
    type: Number,
    default: 0,
  },
  lng: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ["available", "busy", "offline"],
    default: "available",
  },
  lastSeen: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Geospatial index for location queries
driverSchema.index({ lat: 1, lng: 1 });
driverSchema.index({ status: 1 });
driverSchema.index({ vehicleNo: 1 });

module.exports = mongoose.model("Driver", driverSchema);
