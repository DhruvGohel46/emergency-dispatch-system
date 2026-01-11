# 🧪 Test Backend Routes

## Quick Test Commands (PowerShell)

### 1. Test Health Check
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/health" -Method GET
```

Expected: `{"status":"ok","timestamp":"..."}`

---

### 2. Test User Registration
```powershell
$body = @{
    name = "Test User"
    phone = "+1234567890"
    role = "user"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/auth/register" -Method POST -ContentType "application/json" -Body $body
```

---

### 3. Test User Login
```powershell
$body = @{
    phone = "+1234567890"
    role = "user"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" -Method POST -ContentType "application/json" -Body $body
```

Expected: `{"success":true,"token":"...","user":{...}}`

---

### 4. Test Driver Registration
```powershell
$body = @{
    name = "Test Driver"
    phone = "+1234567891"
    vehicleNo = "DL-01-AB-1234"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/driver/register" -Method POST -ContentType "application/json" -Body $body
```

---

### 5. Test Driver Login
```powershell
$body = @{
    phone = "+1234567891"
    role = "driver"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" -Method POST -ContentType "application/json" -Body $body
```

---

## 🚀 Start Server First

```bash
cd ambulance-ecosystem
npm start
```

Wait for:
```
✅ MongoDB connected successfully
🚑 Ambulance Dispatch Backend running on port 3000
```

Then test routes above.

---

## ❌ If 404 Error

1. **Check server is running**: `GET http://localhost:3000/health`
2. **Check route mounting**: Look at `src/app.js` line 36: `app.use("/api/auth", authRoutes);`
3. **Check route file**: `src/routes/auth.routes.js` should have `router.post("/login", ...)`
4. **Restart server** after any changes

---

## ✅ Route Verification

All routes should be accessible at:
- ✅ `POST /api/auth/login`
- ✅ `POST /api/auth/register`
- ✅ `GET /api/auth/me` (requires token)
- ✅ `POST /api/driver/register`
- ✅ `POST /api/emergency/create`
- ✅ `GET /health`

---

**Test these commands first, then report which ones fail!** 🧪
