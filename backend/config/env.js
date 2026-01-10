  require("dotenv").config();

  module.exports = {
    NODE_ENV: process.env.NODE_ENV || "development",
    PORT: process.env.PORT || 3000,
    
    // MongoDB
    MONGODB_URI: process.env.MONGODB_URI || "mongodb://localhost:27017/ambulance-dispatch",
    
    // Redis
    REDIS_HOST: process.env.REDIS_HOST || "localhost",
    REDIS_PORT: process.env.REDIS_PORT || 6379,
    REDIS_PASSWORD: process.env.REDIS_PASSWORD || "",
    
    // JWT
    JWT_SECRET: process.env.JWT_SECRET || "yayaya",
    JWT_EXPIRE: process.env.JWT_EXPIRE || "7d",
    
    // SMS Gateway (Twilio)
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || "",
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || "",
    TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER || "",
    
    // Google Maps
    GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY || "AIzaSyAypq0tADpFCn-mpSGoydv0CKYqvk9mUeI",
    
    // SMS Gateway Alternative
    SMS_API_KEY: process.env.SMS_API_KEY || "",
    SMS_API_URL: process.env.SMS_API_URL || ""
  };
