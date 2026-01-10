const redis = require("redis");
const { REDIS_HOST, REDIS_PORT, REDIS_PASSWORD } = require("./env");

// Create Redis client configuration
const redisConfig = {
  socket: {
    host: REDIS_HOST,
    port: REDIS_PORT,
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        console.error("❌ Redis: Max retry attempts reached");
        return new Error("Redis connection failed: Max retries exceeded");
      }
      return Math.min(retries * 100, 3000);
    },
  },
};

// Add password if provided
if (REDIS_PASSWORD) {
  redisConfig.password = REDIS_PASSWORD;
}

// Create Redis client
const redisClient = redis.createClient(redisConfig);

// Event handlers
redisClient.on("connect", () => {
  console.log("🔄 Redis: Connecting...");
});

redisClient.on("ready", () => {
  console.log("✅ Redis connected and ready");
});

redisClient.on("error", (err) => {
  console.error("❌ Redis connection error:", err.message);
  // Don't exit process - Redis is optional for this system
  // Application can run without Redis (fallback to MongoDB for geo queries)
});

redisClient.on("reconnecting", () => {
  console.log("🔄 Redis: Reconnecting...");
});

redisClient.on("end", () => {
  console.log("⚠️  Redis: Connection closed");
});

// Connect to Redis (non-blocking - errors handled by event listeners)
(async () => {
  try {
    await redisClient.connect();
  } catch (error) {
    // Connection will be retried automatically via reconnectStrategy
    console.warn("⚠️  Redis: Initial connection failed, will retry:", error.message);
  }
})();

module.exports = redisClient;
