# 🚑 Ambulance Dispatch Backend

**Production-ready distributed ambulance dispatch platform backend**

A real-time emergency response system with geolocation-based driver matching, WebSocket tracking, SMS fallback, and Google Maps integration.

---

## 🏗 Architecture

```
ambulance-backend/
│
├── src/
│   ├── app.js              # Express app setup
│   ├── server.js           # Server entry point
│   ├── config/             # Configuration files
│   ├── models/             # MongoDB models
│   ├── routes/             # API routes
│   ├── controllers/        # Request handlers
│   ├── services/           # Business logic
│   ├── sockets/            # WebSocket handlers
│   └── utils/              # Utility functions
│
├── .env                    # Environment variables
└── package.json
```

---

## 🚀 Features

### ✅ Implemented (Phase 0-8)

- **Geo-based Dispatch**: Finds nearest drivers within 500m, expands to 1km if needed
- **Driver Matching**: Haversine distance calculation with MongoDB queries
- **Real-time Tracking**: WebSocket-based GPS streaming
- **Driver Acceptance**: Accept/reject emergency assignments
- **Emergency Transfer**: Re-dispatch logic for failed assignments
- **SMS Fallback**: Twilio integration for SMS-based emergency creation
- **Audit Logs**: Complete assignment and GPS logging
- **Status Management**: Real-time status updates for emergencies and drivers

### 🔜 Coming Next (Phase 9+)

- Google Maps routing with traffic data
- Traffic signal email notifications
- Advanced SMS gateway integration
- Driver authentication & JWT
- Rate limiting & security middleware
- Analytics dashboard

---

## 📋 Prerequisites

- **Node.js** >= 16.0.0
- **MongoDB** >= 4.4
- **Redis** >= 6.0 (optional but recommended)
- **npm** >= 8.0.0

---

## 🛠 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Ambulance-ecosystem
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your configuration:
   - MongoDB connection string
   - Redis connection details
   - Twilio credentials (optional)
   - Google Maps API key (optional)

4. **Start MongoDB and Redis**
   ```bash
   # MongoDB (if running locally)
   mongod

   # Redis (if running locally)
   redis-server
   ```

5. **Run the server**
   ```bash
   # Development mode with auto-reload
   npm run dev

   # Production mode
   npm start
   ```

The server will start on `http://localhost:3000` (or PORT from .env)

---

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `GET /api/auth/profile/:phone` - Get user profile

### Emergency
- `POST /api/emergency/create` - Create new emergency
- `GET /api/emergency/:id` - Get emergency by ID
- `GET /api/emergency/user/:phone` - Get user's emergencies
- `PATCH /api/emergency/:id/status` - Update emergency status
- `POST /api/emergency/transfer` - Transfer/re-dispatch emergency

### Driver
- `POST /api/driver/register` - Register a new driver
- `POST /api/driver/location` - Update driver location
- `POST /api/driver/status` - Update driver status
- `POST /api/driver/accept` - Accept emergency assignment
- `POST /api/driver/reject` - Reject emergency assignment
- `GET /api/driver/:driverId` - Get driver profile
- `GET /api/driver/:driverId/assignments` - Get driver assignments

### SMS
- `POST /api/sms/incoming` - Twilio webhook for incoming SMS
- `POST /api/sms/test` - Test SMS sending

### Health Check
- `GET /health` - Server health check

---

## 🔌 WebSocket Events

### Client → Server

- `driver:join` - Driver joins their tracking room
- `emergency:join` - User joins emergency tracking room
- `location` - Driver sends GPS location update
- `driver:status` - Driver updates their status
- `emergency:status` - Emergency status update

### Server → Client

- `driver:{driverId}:request` - Emergency dispatch request to driver
- `track:{emergencyId}` - Real-time GPS tracking data
- `emergency:{emergencyId}:assigned` - Ambulance assigned notification
- `emergency:{emergencyId}:failed` - No drivers available
- `emergency:{emergencyId}:status` - Emergency status change
- `location:updated` - Driver location confirmation
- `status:updated` - Driver status confirmation

---

## 📝 Usage Examples

### Create Emergency
```bash
curl -X POST http://localhost:3000/api/emergency/create \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+1234567890",
    "lat": 28.6139,
    "lng": 77.2090,
    "address": "Delhi, India"
  }'
```

### Register Driver
```bash
curl -X POST http://localhost:3000/api/driver/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "phone": "+1234567891",
    "vehicleNo": "DL-01-AB-1234"
  }'
```

### Update Driver Location
```bash
curl -X POST http://localhost:3000/api/driver/location \
  -H "Content-Type: application/json" \
  -d '{
    "driverId": "driver_id_here",
    "lat": 28.6140,
    "lng": 77.2091
  }'
```

### Accept Assignment
```bash
curl -X POST http://localhost:3000/api/driver/accept \
  -H "Content-Type: application/json" \
  -d '{
    "driverId": "driver_id_here",
    "emergencyId": "emergency_id_here"
  }'
```

### SMS Emergency (Twilio Webhook)
Send SMS to your Twilio number:
```
EMERGENCY#28.6139,77.2090#Delhi, India
```

---

## 🗄 Database Models

### User
- `name`, `phone`, `role` (user/driver/admin)

### Driver
- `name`, `phone`, `vehicleNo`, `lat`, `lng`, `status` (available/busy/offline)

### Emergency
- `userPhone`, `lat`, `lng`, `status` (searching/assigned/enroute/hospital/failed/completed)
- `assignedDriverId`, `address`, `notes`

### Assignment
- `emergencyId`, `driverId`, `status` (pending/accepted/rejected/failed/completed)
- `reason`, `acceptedAt`, `rejectedAt`

### GpsLog
- `driverId`, `emergencyId`, `lat`, `lng`, `speed`, `heading`, `accuracy`
- Auto-deletes after 30 days (TTL index)

---

## 🔧 Configuration

### MongoDB
Set `MONGODB_URI` in `.env`:
```
MONGODB_URI=mongodb://localhost:27017/ambulance-dispatch
```

### Redis (Optional)
Set Redis connection details in `.env`:
```
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

### Twilio SMS (Optional)
```
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```

### Google Maps (Optional)
```
GOOGLE_MAPS_API_KEY=your_api_key
```

---

## 🧪 Testing

### Manual Testing Flow

1. **Register a driver**
   ```bash
   POST /api/driver/register
   ```

2. **Update driver location** (make them available)
   ```bash
   POST /api/driver/location
   POST /api/driver/status (status: "available")
   ```

3. **Create emergency**
   ```bash
   POST /api/emergency/create
   ```

4. **Driver accepts** (check WebSocket or use API)
   ```bash
   POST /api/driver/accept
   ```

5. **Track location** (via WebSocket `location` event)

6. **Complete emergency**
   ```bash
   PATCH /api/emergency/:id/status (status: "completed")
   ```

---

## 🚨 Production Considerations

- **Security**: Add authentication middleware, rate limiting, input validation
- **Monitoring**: Add logging (Winston/Pino), error tracking (Sentry)
- **Scaling**: Use Redis for session management, MongoDB replica sets
- **Performance**: Add indexes (already implemented), connection pooling
- **Backup**: Regular MongoDB backups, Redis persistence
- **HTTPS**: Use reverse proxy (Nginx) with SSL certificates

---

## 📄 License

ISC

---

## 👨‍💻 Development

This is a **production-grade backend** following industry best practices:
- Clean architecture with separation of concerns
- Proper error handling and logging
- Database indexes for performance
- WebSocket for real-time updates
- Scalable service layer design
- Ready for SMS and Maps integration

**Built for real-world emergency response systems.**

---

## 📞 Support

For issues or questions, please open an issue on the repository.
