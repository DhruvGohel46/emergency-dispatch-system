
---

# **SaHaay — Autonomous Ambulance Dispatch & Emergency Response Platform**

SaHaay is a **nation-scale, autonomous emergency response system** designed to eliminate ambulance delays, uncertainty, and failures by using **real-time geospatial intelligence, automated dispatch, failover routing, and continuous tracking**.

It transforms how emergencies are handled by replacing phone-based guesswork with **live, data-driven, accountable, and self-healing rescue workflows**.

---

# 1. The Real Problem

In India, calling an ambulance is still a **blind gamble**.

Victims and families do not know:

* When the ambulance will arrive
* Which ambulance is coming
* Where it currently is
* Whether the driver is reliable
* Whether traffic or breakdowns will delay it

Government systems like **108 / 112** are centralized, manual, and opaque.
There is no:

* Real-time tracking
* Automated nearest-vehicle dispatch
* Failover if an ambulance breaks down
* Traffic route clearance
* Digital audit trail

This leads to preventable deaths inside the **Golden Hour**.

---

# 2. Real-World Evidence of Failure

The problems SaHaay solves are documented in national media:

* **Heart patient dies after ambulance delay** — Bengaluru
  The New Indian Express
  [https://www.newindianexpress.com/states/karnataka/2025/Dec/17/heart-patient-dies-on-road-in-bengaluru-after-hospital-allegedly-denies-ambulance-pleas-for-help-ignored](https://www.newindianexpress.com/states/karnataka/2025/Dec/17/heart-patient-dies-on-road-in-bengaluru-after-hospital-allegedly-denies-ambulance-pleas-for-help-ignored)

* **Newborn dies after ambulance breakdown** — Madhya Pradesh
  Times of India
  [https://timesofindia.indiatimes.com/city/indore/newborn-dies-after-ambulance-breakdown-delays-her-shifting-to-indore-from-barwani/articleshow/125511519.cms](https://timesofindia.indiatimes.com/city/indore/newborn-dies-after-ambulance-breakdown-delays-her-shifting-to-indore-from-barwani/articleshow/125511519.cms)

* **16-month-old dies after ambulance stuck in traffic for 5 hours**
  The Logical Indian
  [https://thelogicalindian.com/16-month-old-baby-dies-after-ambulance-stuck-5-hours-in-mumbai-ahmedabad-highway-traffic-jam](https://thelogicalindian.com/16-month-old-baby-dies-after-ambulance-stuck-5-hours-in-mumbai-ahmedabad-highway-traffic-jam)

* **Pregnant women left without ambulances after service disruption** — Jaipur
  Times of India
  [https://timesofindia.indiatimes.com/city/jaipur/pregnant-women-suffer-as-104-ambulance-calls-diverted](https://timesofindia.indiatimes.com/city/jaipur/pregnant-women-suffer-as-104-ambulance-calls-diverted)

* **Untrained ambulance staff cause service failures** — Guwahati
  Times of India
  [https://timesofindia.indiatimes.com/city/guwahati/new-recruits-lack-training-sacked-ambulance-staff](https://timesofindia.indiatimes.com/city/guwahati/new-recruits-lack-training-sacked-ambulance-staff)

These are not rare cases — they reflect a **systemic failure of emergency response infrastructure**.

---

# 3. Why Current Systems Fail

| Failure                              | Current System           |
| ------------------------------------ | ------------------------ |
| No nearest-ambulance logic           | Manual phone dispatch    |
| No live tracking                     | Caller waits blindly     |
| No failover if ambulance breaks down | Patient dies             |
| Traffic jams block ambulances        | No coordination          |
| Fake calls overload 108              | Real emergencies delayed |
| No accountability                    | No digital audit         |

---

# 4. What SaHaay Does Differently

SaHaay is **autonomous by design**.

It replaces human-driven call centers with **software-driven orchestration**.

### Core Principles

* Nearest ambulance always dispatched first
* Continuous live GPS tracking
* Automatic failover and re-dispatch
* Traffic-aware routing
* Offline SMS access
* Full digital audit trail

---

# 5. End-to-End Emergency Flow

### Step 1 — Accident Detection

A user presses **“Accident Detected”** or an accident is detected automatically using **phone gyroscope & vibration sensors**.

The phone:

* Captures GPS using Google Location API
* Sends location to SaHaay backend

---

### Step 2 — Intelligent Dispatch

SaHaay:

1. Searches all ambulances within **500 meters**
2. If none accept within **2 minutes**, expands to **1 km**
3. Sends real-time requests to all eligible drivers

---

### Step 3 — Driver Acceptance & Locking

The first driver to accept:

* Is assigned
* All others are automatically canceled
* Driver, vehicle and ETA are stored
* User receives driver + vehicle details

---

### Step 4 — Live Tracking & Best Route

SaHaay:

* Calculates the fastest route via Google Maps
* Streams live GPS of ambulance to the user
* Predicts ETA in real time

---

### Step 5 — Traffic Route Clearance

Every major checkpoint on the ambulance route:

* Receives automated email alerts
* Can clear signals or traffic

This creates a **digital green corridor**.

---

### Step 6 — Failover on Breakdown

If the ambulance:

* Breaks down
* Gets stuck
* Has a puncture

The driver presses **Emergency Transfer**.

SaHaay:

* Uses the ambulance’s current GPS
* Finds the nearest available ambulance
* Transfers the mission automatically

No human intervention required.

---

### Step 7 — Reaching Patient & Hospital

Driver marks:

* Reached patient
* En route to hospital
* Reached hospital

Every step:

* Updates database
* Notifies user
* Is logged permanently

---

# 6. Offline Mode (Disaster Ready)

If internet is unavailable:

* User sends SMS:
  `EMERGENCY#latitude,longitude`
* Server processes it
* Dispatches ambulances
* Sends all updates back via SMS

This makes SaHaay usable in:

* Villages
* Earthquakes
* Floods
* Network outages

---

# 7. Autonomous Architecture

SaHaay is **self-healing**:

| Failure             | Automatic Recovery  |
| ------------------- | ------------------- |
| Driver rejects      | Next nearest driver |
| No driver in 500m   | Expand to 1 km      |
| Ambulance breakdown | Redispatch          |
| Traffic jam         | Route recalculated  |
| App offline         | SMS fallback        |

No call center required.

---

# 8. Technology Stack

| Layer          | Technology           |
| -------------- | -------------------- |
| Mobile App     | React Native         |
| Backend        | Node.js, Express     |
| Database       | MongoDB              |
| Real-Time      | WebSockets           |
| Maps & Routing | Google Maps API      |
| SMS            | Twilio / SMS Gateway |
| Deployment     | Cloud + Containers   |

---

# 9. Scalability Across India

SaHaay is built to scale to **millions of emergencies**.

### Horizontal Scaling

* Stateless Node.js services
* Load balancers
* Auto-scaling clusters

### Geo-Distributed Databases

* MongoDB clusters by region
* Faster local queries
* Reduced latency

### Microservices

* Dispatch Engine
* Tracking Engine
* Messaging Engine
* Routing Engine

Each scales independently.

### Cloud Deployment

* Containers (Docker)
* Orchestrated via Kubernetes
* Deployed per state / region

This allows:

* Gujarat cluster
* Maharashtra cluster
* Delhi cluster
  all running independently but connected.

---

# 10. Why This Will Save Lives

SaHaay removes:

* Human delay
* Guesswork
* Broken coordination

And replaces it with:

* Real-time intelligence
* Automated routing
* Continuous accountability

It turns ambulances into a **coordinated emergency network**, not isolated vehicles.

This is integration of offline DSM-SMS system :  https://github.com/Ahad-Dngwala/SAHAAY.github.io

---

# Final Statement

SaHaay is not an app.
It is **India’s first autonomous emergency response infrastructure**.

It ensures that **no patient is left waiting because of a broken system**.
