# 📁 Complete File Structure

## Ambulance-ecosystem/

```
ambulance-ecosystem/
│
├── src/                                    # Main source directory
│   ├── app.js                             # Express app configuration
│   ├── server.js                          # Server entry point
│   │
│   ├── config/                            # Configuration files
│   │   ├── db.js                          # MongoDB connection
│   │   ├── env.js                         # Environment variables
│   │   └── redis.js                       # Redis connection
│   │
│   ├── models/                            # MongoDB models (Schemas)
│   │   ├── Assignment.js                  # Emergency-Driver assignments
│   │   ├── Driver.js                      # Driver/Ambulance model (with trust system)
│   │   ├── Emergency.js                   # Emergency requests
│   │   ├── EmergencyEvent.js              # Event timeline/audit trail
│   │   ├── EmergencyMetrics.js            # Service quality metrics
│   │   ├── GpsLog.js                      # GPS tracking logs (TTL: 30 days)
│   │   ├── MessageLog.js                  # Communication history (TTL: 90 days)
│   │   └── User.js                        # User model
│   │
│   ├── routes/                            # API route definitions
│   │   ├── auth.routes.js                 # Authentication routes
│   │   │   ├── POST   /api/auth/login     # Login (user/driver)
│   │   │   ├── POST   /api/auth/register  # Register user
│   │   │   ├── GET    /api/auth/profile/:phone  # Get profile by phone
│   │   │   └── GET    /api/auth/me        # Get current profile (token required)
│   │   │
│   │   ├── driver.routes.js               # Driver routes
│   │   │   ├── POST   /api/driver/register          # Register driver
│   │   │   ├── POST   /api/driver/location          # Update location (JWT + rate limit)
│   │   │   ├── POST   /api/driver/status            # Update status (JWT)
│   │   │   ├── POST   /api/driver/accept            # Accept assignment (JWT)
│   │   │   ├── POST   /api/driver/reject            # Reject assignment (JWT)
│   │   │   ├── GET    /api/driver/me                # Current driver profile (JWT)
│   │   │   ├── GET    /api/driver/:driverId         # Get driver by ID (public)
│   │   │   └── GET    /api/driver/:driverId/assignments  # Get assignments (JWT)
│   │   │
│   │   ├── emergency.routes.js            # Emergency routes
│   │   │   ├── POST   /api/emergency/create         # Create emergency
│   │   │   ├── GET    /api/emergency/:id            # Get emergency (with timeline/metrics)
│   │   │   ├── GET    /api/emergency/:id/timeline   # Get event timeline
│   │   │   ├── GET    /api/emergency/user/:phone    # Get user emergencies
│   │   │   ├── PATCH  /api/emergency/:id/status     # Update status
│   │   │   └── POST   /api/emergency/transfer       # Transfer/re-dispatch
│   │   │
│   │   └── sms.routes.js                  # SMS routes
│   │       ├── POST   /api/sms/incoming   # Twilio webhook
│   │       └── POST   /api/sms/test       # Test SMS
│   │
│   ├── controllers/                       # Request handlers (Business logic)
│   │   ├── auth.controller.js             # Authentication controller
│   │   │   ├── login()                    # Login user/driver
│   │   │   ├── register()                 # Register user
│   │   │   ├── getProfile()               # Get profile by phone
│   │   │   └── getCurrentProfile()        # Get current profile (from token)
│   │   │
│   │   ├── driver.controller.js           # Driver controller
│   │   │   ├── register()                 # Register driver
│   │   │   ├── updateLocation()           # Update GPS location
│   │   │   ├── updateStatus()             # Update driver status
│   │   │   ├── accept()                   # Accept emergency
│   │   │   ├── reject()                   # Reject emergency
│   │   │   ├── getProfile()               # Get driver profile
│   │   │   ├── getCurrentDriverProfile()  # Get current driver profile
│   │   │   └── getAssignments()           # Get driver assignments
│   │   │
│   │   ├── emergency.controller.js        # Emergency controller
│   │   │   ├── createEmergency()          # Create emergency
│   │   │   ├── getEmergency()             # Get emergency with timeline/metrics
│   │   │   ├── getTimeline()              # Get event timeline
│   │   │   ├── getUserEmergencies()       # Get user emergencies
│   │   │   ├── updateEmergencyStatus()    # Update status
│   │   │   └── transfer()                 # Transfer/re-dispatch
│   │   │
│   │   └── sms.controller.js              # SMS controller
│   │       ├── incoming()                 # Handle incoming SMS (Twilio)
│   │       └── test()                     # Test SMS sending
│   │
│   ├── services/                          # Business logic services
│   │   ├── dispatch.service.js            # Dispatch engine
│   │   │   ├── start()                    # Start dispatch (500m → 1km)
│   │   │   ├── redispatch()               # Re-dispatch emergency
│   │   │   └── cancelAutoRedispatch()     # Cancel auto-redispatch timer
│   │   │
│   │   ├── geo.service.js                 # Geolocation services
│   │   │   ├── findDrivers()              # Find nearby drivers (Haversine)
│   │   │   ├── updateDriverLocation()     # Update driver GPS
│   │   │   └── getDriverLocation()        # Get driver location
│   │   │
│   │   ├── routing.service.js             # Routing services
│   │   │   ├── getRoute()                 # Google Maps routing
│   │   │   ├── getRouteFallback()         # Haversine fallback
│   │   │   └── getETA()                   # Estimated time of arrival
│   │   │
│   │   ├── sms.service.js                 # SMS services
│   │   │   ├── sendSMS()                  # Send SMS (Twilio/fallback)
│   │   │   ├── sendDispatchNotification() # Notify driver
│   │   │   └── sendUserConfirmation()     # Confirm to user
│   │   │
│   │   └── websocket.service.js           # WebSocket service
│   │       ├── initialize()               # Initialize WebSocket
│   │       ├── emitToRoom()               # Emit to room
│   │       ├── emitToSocket()             # Emit to socket
│   │       ├── broadcast()                # Broadcast to all
│   │       ├── joinRoom()                 # Join room
│   │       └── leaveRoom()                # Leave room
│   │
│   ├── sockets/                           # WebSocket handlers
│   │   └── tracking.socket.js             # Real-time tracking
│   │       ├── driver:join                # Driver joins room
│   │       ├── emergency:join             # User joins emergency room
│   │       ├── location                   # GPS location updates
│   │       ├── driver:status              # Driver status updates
│   │       └── emergency:status           # Emergency status updates
│   │
│   ├── middleware/                        # Express middleware
│   │   ├── auth.js                        # JWT authentication
│   │   │   ├── verifyToken()              # Verify JWT token
│   │   │   ├── verifyDriver()             # Verify driver token
│   │   │   ├── verifyUser()               # Verify user token
│   │   │   └── generateToken()            # Generate JWT token
│   │   │
│   │   └── rateLimiter.js                 # Rate limiting
│   │       ├── locationUpdateLimiter()    # Location update limiter (3 sec)
│   │       └── apiRateLimiter()           # General API rate limiter
│   │
│   └── utils/                             # Utility functions
│       ├── eventLogger.js                 # Event logging utility
│       │   ├── logEvent()                 # Log emergency event
│       │   └── getTimeline()              # Get event timeline
│       │
│       ├── messageLogger.js               # Message logging utility
│       │   ├── logMessage()               # Log communication
│       │   └── getHistory()               # Get message history
│       │
│       └── haversine.js                   # Distance calculation
│           ├── haversineDistance()        # Calculate distance (meters)
│           └── isWithinRadius()           # Check if within radius
│
├── config/                                # Legacy config (can be removed)
├── controllers/                           # Legacy controllers (can be removed)
├── middleware/                            # Legacy middleware (can be removed)
├── models/                                # Legacy models (can be removed)
├── services/                              # Legacy services (can be removed)
├── utils/                                 # Legacy utils (can be removed)
│
├── node_modules/                          # Dependencies (auto-generated)
├── .gitignore                             # Git ignore rules
├── env.template                           # Environment variables template
├── package.json                           # Node.js dependencies
├── package-lock.json                      # Dependency lock file
├── README.md                              # Project documentation
├── QUICKSTART.md                          # Quick start guide
├── INDUSTRY_FEATURES.md                   # Industry features documentation
└── FILE_STRUCTURE.md                      # This file

```

---

## 📊 Database Models

### Core Models
1. **User** - User accounts (name, phone, role)
2. **Driver** - Driver/Ambulance (location, status, rating, trust score)
3. **Emergency** - Emergency requests (location, status, assigned driver)
4. **Assignment** - Emergency-Driver assignments (status, timestamps)

### Audit & Compliance
5. **EmergencyEvent** - Complete event timeline (CREATED, ASSIGNED, ACCEPTED, etc.)
6. **MessageLog** - All communication history (SMS, Socket, Push) [TTL: 90 days]
7. **EmergencyMetrics** - Service quality metrics (response time, success rate)

### Tracking
8. **GpsLog** - GPS tracking logs (auto-delete after 30 days)

---

## 🔌 API Endpoints Summary

### Authentication (`/api/auth`)
- `POST /login` - Login (user/driver) → Returns JWT token
- `POST /register` - Register user
- `GET /profile/:phone` - Get profile by phone
- `GET /me` - Get current profile (JWT required)

### Driver (`/api/driver`)
- `POST /register` - Register driver
- `POST /location` - Update location (JWT + rate limit)
- `POST /status` - Update status (JWT)
- `POST /accept` - Accept emergency (JWT)
- `POST /reject` - Reject emergency (JWT)
- `GET /me` - Current driver profile (JWT)
- `GET /:driverId` - Get driver by ID (public)
- `GET /:driverId/assignments` - Get assignments (JWT)

### Emergency (`/api/emergency`)
- `POST /create` - Create emergency
- `GET /:id` - Get emergency (with timeline/metrics)
- `GET /:id/timeline` - Get event timeline
- `GET /user/:phone` - Get user emergencies
- `PATCH /:id/status` - Update status
- `POST /transfer` - Transfer/re-dispatch

### SMS (`/api/sms`)
- `POST /incoming` - Twilio webhook
- `POST /test` - Test SMS

### Health Check
- `GET /health` - Server health check

---

## 🔐 Authentication Flow

1. **Login** → `POST /api/auth/login`
   - Body: `{ phone, role: "user" | "driver" }`
   - Returns: `{ token, user }`

2. **Use Token** → Add header:
   ```
   Authorization: Bearer <token>
   ```

3. **Protected Routes** → Use middleware:
   - `verifyToken` - General auth
   - `verifyDriver` - Driver only
   - `verifyUser` - User only

---

## 🔌 WebSocket Events

### Client → Server
- `driver:join` - Join driver room
- `emergency:join` - Join emergency room
- `location` - Send GPS location
- `driver:status` - Update driver status
- `emergency:status` - Update emergency status

### Server → Client
- `driver:{driverId}:request` - Emergency dispatch request
- `track:{emergencyId}` - Real-time GPS tracking
- `emergency:{emergencyId}:assigned` - Ambulance assigned
- `emergency:{emergencyId}:failed` - No drivers available
- `emergency:{emergencyId}:status` - Status change
- `location:updated` - Location confirmation
- `status:updated` - Status confirmation

---

## 🏭 Industry Features

✅ Auto-redispatch (2 min timeout)  
✅ Complete event timeline (audit trail)  
✅ JWT authentication (driver/user)  
✅ Rate limiting (3 sec per location update)  
✅ Emergency-specific WebSocket rooms  
✅ Communication history logging (90-day retention)  
✅ Service quality metrics  
✅ Driver trust & rating system  

---

## 📦 Dependencies

- **express** - Web framework
- **mongoose** - MongoDB ODM
- **redis** - Caching & rate limiting
- **socket.io** - WebSocket server
- **jsonwebtoken** - JWT authentication
- **twilio** - SMS gateway
- **axios** - HTTP client
- **cors** - CORS middleware
- **dotenv** - Environment variables

---

**Status**: ✅ Production-ready emergency response platform
