# 🔍 403 Error Debug Guide

## ❌ Error: `GET /api/driver/me 403 (Forbidden)`

This means the token exists but **role is wrong** or **driverId is missing**.

---

## 🔧 Quick Fix Steps

### Step 1: Clear All Tokens

Open browser console and run:

```javascript
localStorage.clear();
```

Or manually:
```javascript
localStorage.removeItem('token');
localStorage.removeItem('user');
localStorage.removeItem('role');
```

### Step 2: Register Driver Again

1. Go to homepage: `http://localhost:5173`
2. Click "Register" tab
3. Enter:
   - Name: `Test Driver`
   - Phone: `+1234567891` (use different phone)
   - Role: `Driver`
   - Vehicle: `DL-01-AB-1234`
4. Click "Create Driver Account"
5. Should auto-login and redirect

### Step 3: Check Token in Console

Open browser console and run:

```javascript
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || '{}');
const role = localStorage.getItem('role');

console.log('Token:', token ? 'Present' : 'Missing');
console.log('Role:', role);
console.log('User:', user);
```

**Expected:**
```
Token: Present
Role: driver
User: { id: "...", name: "...", role: "driver", vehicleNo: "...", ... }
```

**If Role is "user":**
- ❌ Wrong token - clear and re-register

### Step 4: Decode Token (Check Contents)

In browser console:

```javascript
const token = localStorage.getItem('token');
if (token) {
  const payload = JSON.parse(atob(token.split('.')[1]));
  console.log('Token payload:', payload);
}
```

**Expected Driver Token:**
```json
{
  "id": "...",
  "phone": "+1234567891",
  "role": "driver",
  "driverId": "...",
  "iat": ...,
  "exp": ...
}
```

**If role is "user" or driverId is missing:**
- ❌ Token is wrong - clear and re-register as driver

---

## 🐛 Backend Debug

### Check What Backend Receives

Add this to `src/middleware/auth.js` temporarily (in verifyDriver):

```javascript
console.log('🔍 Driver verification:', {
  role: req.user?.role,
  driverId: req.user?.driverId,
  id: req.user?.id,
  token: req.headers.authorization?.substring(0, 20) + '...'
});
```

### Check Login Response

In browser Network tab:
1. Go to Network tab
2. Filter: `XHR` or `Fetch`
3. Find `POST /api/auth/login`
4. Check Response:
   ```json
   {
     "success": true,
     "token": "...",
     "user": {
       "role": "driver",  // Should be "driver"
       "vehicleNo": "...",
       ...
     }
   }
   ```

---

## ✅ Correct Flow

1. **Register Driver:**
   ```
   POST /api/driver/register
   Response: { success: true, driver: {...} }
   ```

2. **Auto-login (after registration):**
   ```
   POST /api/auth/login { phone, role: "driver" }
   Response: {
     success: true,
     token: "eyJ...",
     user: {
       role: "driver",  // ✅ Must be "driver"
       vehicleNo: "...",
       ...
     }
   }
   ```

3. **Access Driver API:**
   ```
   GET /api/driver/me
   Headers: Authorization: Bearer <token>
   Response: { success: true, driver: {...} }
   ```

---

## ❌ Common Issues

### Issue 1: Token Has Role "user"

**Cause:** Logged in as user, then tried to access driver API

**Fix:**
1. Clear tokens
2. Register as driver (new phone number)
3. Don't login as user first

### Issue 2: Token Missing driverId

**Cause:** Login didn't set driverId in token

**Fix:**
1. Check `src/controllers/auth.controller.js` login function
2. Ensure `driverId` is set when role === "driver"
3. Clear tokens and re-login

### Issue 3: Driver Not Found in DB

**Cause:** Driver registered but not in database

**Fix:**
1. Check MongoDB: `db.drivers.find({ phone: "+1234567891" })`
2. If not found, register again
3. Check backend logs for registration errors

---

## 🧪 Test Command

Test backend directly:

```powershell
# Get token from localStorage first, then:
$token = "YOUR_TOKEN_HERE"
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

Invoke-RestMethod -Uri "http://localhost:3000/api/driver/me" -Method GET -Headers $headers
```

**Expected:** `{ success: true, driver: {...} }`  
**If 403:** Token has wrong role or missing driverId

---

## ✅ Verification Checklist

- [ ] Tokens cleared before registration
- [ ] Registered as Driver (not User)
- [ ] Role in localStorage is "driver"
- [ ] Token payload has `role: "driver"`
- [ ] Token payload has `driverId` field
- [ ] Driver exists in MongoDB
- [ ] Backend logs show driver verification success

---

**After following these steps, the 403 error should be fixed!** ✅
