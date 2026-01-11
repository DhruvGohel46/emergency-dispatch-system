  require("dotenv").config();

  module.exports = {
    NODE_ENV: process.env.NODE_ENV || "development",
    PORT: process.env.PORT || 3000,
    
    // MongoDB
    MONGODB_URI: process.env.MONGODB_URI || "mongodb://localhost:27017/SaHaay",
    
    // Redis
    REDIS_HOST: process.env.REDIS_HOST || "localhost",
    REDIS_PORT: process.env.REDIS_PORT || 6379,
    REDIS_PASSWORD: process.env.REDIS_PASSWORD || "varun1823c",
    
    // JWT
    JWT_SECRET: process.env.JWT_SECRET || "yayaya",
    JWT_EXPIRE: process.env.JWT_EXPIRE || "7d",
    
    // SMS Gateway (Twilio)
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || "",
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || "",
    TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER || "",
    
    // Google Maps
    GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY || "AIzaSyCNGhbWRLt3Ya-zse6GBYI2ko_-okEaemc",
    
    // SMS Gateway Alternative
    SMS_API_KEY: process.env.SMS_API_KEY || "",
    SMS_API_URL: process.env.SMS_API_URL || "",
    
    // Email Configuration (for traffic notifications)
    EMAIL_HOST: process.env.EMAIL_HOST || "smtp.gmail.com",
    EMAIL_PORT: process.env.EMAIL_PORT || 587,
    EMAIL_USER: process.env.EMAIL_USER || "kushwahavarun86@gmail.com",
    EMAIL_PASSWORD: process.env.EMAIL_PASSWORD || "zonfznjxynixgtkt",
    EMAIL_FROM: process.env.EMAIL_FROM || "SaHaay Emergency kushwahavarun86@gmail.com"
  };
