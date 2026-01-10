# 🚀 Quick Start Guide

## Installation & Setup

1. **Clone/Download the project**
   ```bash
   cd Ambulance-ecosystem
   ```

2. **Install dependencies** (Already done ✅)
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   # Copy the template
   cp env.template .env
   
   # Edit .env with your configuration
   # Minimum required: MONGODB_URI
   ```

4. **Start MongoDB** (Required)
   ```bash
   # If installed locally:
   mongod
   
   # Or use MongoDB Atlas connection string in .env
   ```

5. **Start Redis** (Optional but recommended)
   ```bash
   # If installed locally:
   redis-server
   
   # Or update REDIS_HOST/REDIS_PORT in .env
   # System will work without Redis (fallback to MongoDB)
   ```

6. **Start the server**
   ```bash
   # Development mode (auto-reload)
   npm run dev
   
   # Production mode
   npm start
   ```

7. **Verify server is running**
   ```bash
   curl http://localhost:3000/health
   # Should return: {"status":"ok","timestamp":"..."}
   ```

---

## Quick Test Flow

### 1. Register a Driver
```bash
POST http://localhost:3000/api/driver/register
Content-Type: application/json

{
  "name": "John Doe",
  "phone": "+1234567890",
  "vehicleNo": "DL-01-AB-1234"
}
```

### 2. Update Driver Location (make them available)
```bash
POST http://localhost:3000/api/driver/location
Content-Type: application/json

{
  "driverId": "PASTE_DRIVER_ID_FROM_STEP_1",
  "lat": 28.6139,
  "lng": 77.2090
}
```

```bash
POST http://localhost:3000/api/driver/status
Content-Type: application/json

{
  "driverId": "PASTE_DRIVER_ID_FROM_STEP_1",
  "status": "available"
}
```

### 3. Create Emergency
```bash
POST http://localhost:3000/api/emergency/create
Content-Type: application/json

{
  "phone": "+9876543210",
  "lat": 28.6140,
  "lng": 77.2091,
  "address": "Delhi, India"
}
```

This will automatically:
- Create the emergency
- Search for drivers within 500m
- Expand to 1km if needed
- Send dispatch requests via WebSocket
- Create pending assignments

### 4. Driver Accepts Assignment
```bash
POST http://localhost:3000/api/driver/accept
Content-Type: application/json

{
  "driverId": "PASTE_DRIVER_ID",
  "emergencyId": "PASTE_EMERGENCY_ID_FROM_STEP_3"
}
```

### 5. Track Location (WebSocket)
Connect to `ws://localhost:3000` and listen for:
- `driver:{driverId}:request` - New emergency request
- `track:{emergencyId}` - Real-time GPS updates
- `emergency:{emergencyId}:assigned` - Assignment confirmation

---

## SMS Testing (Twilio)

1. Configure Twilio in `.env`:
   ```
   TWILIO_ACCOUNT_SID=your_account_sid
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_PHONE_NUMBER=+1234567890
   ```

2. Set webhook URL in Twilio console:
   ```
   https://your-domain.com/api/sms/incoming
   ```

3. Send SMS to your Twilio number:
   ```
   EMERGENCY#28.6139,77.2090#Delhi, India
   ```

4. System will automatically:
   - Parse coordinates
   - Create emergency
   - Start dispatch process

---

## WebSocket Client Example (JavaScript)

```javascript
const io = require('socket.io-client');

const socket = io('http://localhost:3000');

// Driver joins
socket.emit('driver:join', { driverId: 'YOUR_DRIVER_ID' });

// Listen for dispatch requests
socket.on('driver:YOUR_DRIVER_ID:request', (data) => {
  console.log('New emergency request:', data);
  // Show accept/reject button in UI
});

// Send location updates
socket.emit('location', {
  driverId: 'YOUR_DRIVER_ID',
  lat: 28.6139,
  lng: 77.2090,
  emergencyId: 'EMERGENCY_ID' // Optional
});

// User tracks emergency
socket.emit('emergency:join', { emergencyId: 'EMERGENCY_ID' });
socket.on('track:EMERGENCY_ID', (data) => {
  console.log('Driver location:', data);
  // Update map marker
});
```

---

## Common Issues

### MongoDB Connection Error
- **Issue**: `MongoServerError: connect ECONNREFUSED`
- **Solution**: 
  1. Make sure MongoDB is running: `mongod`
  2. Check `MONGODB_URI` in `.env`
  3. For MongoDB Atlas, ensure IP whitelist includes your IP

### Redis Connection Error
- **Issue**: `Redis connection error`
- **Solution**: 
  - Redis is optional. The system works without it.
  - If you want Redis, start server: `redis-server`
  - Or update `REDIS_HOST`/`REDIS_PORT` in `.env`

### Port Already in Use
- **Issue**: `Error: listen EADDRINUSE: address already in use :::3000`
- **Solution**: 
  - Change `PORT` in `.env`
  - Or kill process using port 3000

### Module Not Found
- **Issue**: `Cannot find module '...'`
- **Solution**: 
  ```bash
  npm install
  ```

---

## Environment Variables

Minimum required:
- `MONGODB_URI` - MongoDB connection string

Optional but recommended:
- `REDIS_HOST` - Redis host (default: localhost)
- `REDIS_PORT` - Redis port (default: 6379)
- `TWILIO_ACCOUNT_SID` - For SMS functionality
- `TWILIO_AUTH_TOKEN` - For SMS functionality
- `TWILIO_PHONE_NUMBER` - For SMS functionality
- `GOOGLE_MAPS_API_KEY` - For routing with traffic data

---

## Next Steps

- ✅ Phase 0-8: **COMPLETE**
- 🔜 Phase 9+: Google Maps routing, traffic signals, email notifications

---

## Production Deployment

1. Set `NODE_ENV=production` in `.env`
2. Use a process manager (PM2, systemd)
3. Set up reverse proxy (Nginx) with SSL
4. Configure MongoDB replica sets
5. Set up Redis cluster for scaling
6. Add monitoring (Winston/Pino logging)
7. Set up error tracking (Sentry)

---

**Ready to deploy! 🚀**
