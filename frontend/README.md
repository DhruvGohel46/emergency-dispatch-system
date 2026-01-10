# Emergency Dispatch Frontend

A monorepo containing mobile applications for emergency dispatch system using React Native and Expo.

## Project Structure

```
emergency-dispatch-frontend/
├── packages/
│   ├── user-app/              # User Emergency App with Gearo integration
│   ├── ambulance-app/         # Ambulance Driver App
│   └── shared/                # Shared components, hooks, and utilities
└── package.json
```

## Apps

### User App (user-app)
Mobile application for users to report emergencies and track ambulances with Gearo integration.

**Start:** `npm run user:start`
**Android:** `npm run user:android`

### Ambulance App (ambulance-app)
Mobile application for ambulance drivers to receive and manage dispatch requests.

**Start:** `npm run ambulance:start`
**Android:** `npm run ambulance:android`

### Shared Package
Reusable components, hooks, and utilities shared between apps.

## Setup & Installation

1. Install dependencies:
```bash
npm install
```

2. Start the user app:
```bash
npm run user:start
```

3. Start the ambulance app:
```bash
npm run ambulance:start
```

## Technologies

- **React Native** - Cross-platform mobile framework
- **Expo** - React Native development platform
- **Redux & Redux Toolkit** - State management
- **React Navigation** - Navigation between screens
- **Geolocation** - GPS tracking
- **Gearo** - Real-time communication

## Development

Each app is self-contained within its package but shares common utilities through the shared package.

### Directory Structure

- `src/assets/` - Images, fonts, and other static assets
- `src/components/` - Reusable React components
- `src/screens/` - App screens/pages
- `src/services/` - API and external service integrations
- `src/hooks/` - Custom React hooks
- `src/navigation/` - Navigation configuration
- `src/store/` - Redux store configuration
- `src/utils/` - Utility functions
