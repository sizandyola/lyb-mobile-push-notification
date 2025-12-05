# Push Notification API - Mobile Integration Guide

## Base URL
```
http://localhost:3000/api/notifications
# Production: https://your-domain.com/api/notifications
```

---

## 1. Register Push Token

**Endpoint:** `POST /register-token`

**When to call:** When user opens the app and gets Expo push token

```typescript
// Example usage in React Native
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const registerPushToken = async () => {
  const token = await Notifications.getExpoPushTokenAsync();

  const response = await fetch('http://localhost:3000/api/notifications/register-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      expoPushToken: token.data,
      platform: Platform.OS,
      deviceInfo: {
        brand: Constants.deviceName,
        osVersion: Platform.Version,
      }
    })
  });

  const result = await response.json();
  console.log('Token registered:', result);
};
```

**Request Body:**
```json
{
  "expoPushToken": "ExponentPushToken[xxxxxx]",
  "platform": "ios",
  "deviceInfo": {
    "brand": "iPhone",
    "osVersion": "17.0"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Token registered successfully",
  "tokenId": "uuid-here"
}
```

---

## 2. Unregister Push Token

**Endpoint:** `POST /unregister-token`

**When to call:** When user logs out

```typescript
const unregisterPushToken = async (token: string) => {
  const response = await fetch('http://localhost:3000/api/notifications/unregister-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      expoPushToken: token
    })
  });

  const result = await response.json();
  console.log('Token unregistered:', result);
};
```

**Request Body:**
```json
{
  "expoPushToken": "ExponentPushToken[xxxxxx]"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Token unregistered successfully",
  "count": 1
}
```

---

## Complete Mobile Integration Example

```typescript
// services/pushNotifications.ts
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const API_URL = 'http://localhost:3000/api/notifications';

export const initializePushNotifications = async () => {
  // Request permissions
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') {
    console.log('Permission not granted');
    return;
  }

  // Get Expo push token
  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: Constants.expoConfig?.extra?.eas?.projectId,
  });

  // Register with backend
  await fetch(`${API_URL}/register-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      expoPushToken: tokenData.data,
      platform: Platform.OS,
      deviceInfo: {
        brand: Constants.deviceName,
        osVersion: Platform.Version,
      }
    })
  });

  return tokenData.data;
};

export const unregisterToken = async (token: string) => {
  await fetch(`${API_URL}/unregister-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expoPushToken: token })
  });
};
```

**Usage in App.tsx:**
```typescript
import { useEffect } from 'react';
import { initializePushNotifications } from './services/pushNotifications';

export default function App() {
  useEffect(() => {
    initializePushNotifications();
  }, []);

  return (
    // Your app content
  );
}
```

---

## Testing

1. Start backend: `npm run dev`
2. Run mobile app on physical device
3. Check admin dashboard at `http://localhost:3000`
4. Send test notification from dashboard
5. Notification should appear on device

---

## Error Handling

All endpoints return errors in this format:
```json
{
  "error": "Error message here",
  "success": false
}
```

Common errors:
- `400`: Invalid request (missing fields, invalid token format)
- `500`: Server error
