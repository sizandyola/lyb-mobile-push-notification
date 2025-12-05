# Push Notification Backend Implementation Guide

This guide shows how to build a backend system for managing push notifications using **Next.js**, **Prisma**, and **SQLite**.

## Overview

The backend will:
- Store push tokens from mobile devices
- Send notifications via Expo's Push Notification API
- Handle token registration/unregistration
- Support targeted notifications (by user, site, or broadcast)

## Architecture Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    COMPLETE SYSTEM FLOW                          │
└─────────────────────────────────────────────────────────────────┘

1. MOBILE APP (React Native + Expo)
   ├─> User opens app
   ├─> Request notification permission
   ├─> Get Expo Push Token from Expo servers
   ├─> Send token to YOUR Next.js backend
   └─> Store token in Zustand (local state)

2. NEXT.JS BACKEND
   ├─> Receive token from mobile app
   ├─> Store in SQLite database (via Prisma)
   ├─> Associate with user/site/device info
   └─> Return success response

3. SENDING NOTIFICATIONS (Admin/Automated)
   ├─> Admin creates announcement in dashboard
   ├─> Backend queries tokens from database
   │   - All users? Specific site? Single user?
   ├─> Call Expo Push Notification API
   └─> Send notifications in batches

4. EXPO PUSH SERVICE
   ├─> Routes notification to correct platform
   │   - iOS → Apple Push Notification service (APNs)
   │   - Android → Firebase Cloud Messaging (FCM)
   └─> Delivers to user's device

5. MOBILE APP RECEIVES NOTIFICATION
   ├─> Foreground: Show alert, add to store
   ├─> Background: System notification
   └─> User taps: Navigate to specific screen
```

---

## Part 1: Backend Setup (Next.js + Prisma + SQLite)

### 1.1 Initialize Next.js Project

```bash
# Create Next.js app
npx create-next-app@latest push-notification-backend
cd push-notification-backend

# Install dependencies
npm install prisma @prisma/client
npm install expo-server-sdk
npm install @types/node --save-dev

# Initialize Prisma with SQLite
npx prisma init --datasource-provider sqlite
```

### 1.2 Prisma Schema

**File: `prisma/schema.prisma`**

```prisma
// This is your Prisma schema file
// Learn more: https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

// Store push notification tokens
model PushToken {
  id        String   @id @default(uuid())
  token     String   @unique  // Expo Push Token (e.g., ExponentPushToken[xxxxx])

  // User/Device Info
  userId    String?  // Optional: Link to your user system
  siteId    String?  // Optional: Which employer site (domain)
  deviceId  String?  // Unique device identifier
  platform  String   // "ios" or "android"

  // Metadata
  deviceInfo Json?   // Store additional device info (model, OS version, etc.)
  isActive   Boolean @default(true)  // Can be disabled without deleting

  // Timestamps
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  lastUsedAt DateTime @default(now())  // Update when notification sent successfully

  // Indexes for fast queries
  @@index([userId])
  @@index([siteId])
  @@index([isActive])
}

// Optional: Track sent notifications
model NotificationLog {
  id          String   @id @default(uuid())

  // Who received it
  tokenId     String?  // Link to PushToken
  userId      String?
  siteId      String?

  // Notification content
  title       String
  body        String
  data        Json?    // Custom data payload

  // Status
  status      String   // "sent", "failed", "delivered", "read"

  // Expo ticket info (for tracking delivery)
  ticketId    String?
  receiptId   String?
  errorCode   String?
  errorMessage String?

  // Timestamps
  sentAt      DateTime @default(now())
  deliveredAt DateTime?
  readAt      DateTime?

  @@index([userId])
  @@index([siteId])
  @@index([status])
  @@index([sentAt])
}
```

### 1.3 Generate Prisma Client

```bash
# Run migration to create database
npx prisma migrate dev --name init

# Generate Prisma Client
npx prisma generate
```

### 1.4 Prisma Client Instance

**File: `lib/prisma.ts`**

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: ['query', 'error', 'warn'],
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
```

---

## Part 2: API Routes (Next.js)

### 2.1 Register Push Token

**File: `app/api/notifications/register-token/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Expo } from 'expo-server-sdk';

const expo = new Expo();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { expoPushToken, userId, siteId, deviceId, platform, deviceInfo } = body;

    // Validate the token format
    if (!Expo.isExpoPushToken(expoPushToken)) {
      return NextResponse.json(
        { error: 'Invalid Expo push token format' },
        { status: 400 }
      );
    }

    // Check if token already exists
    const existingToken = await prisma.pushToken.findUnique({
      where: { token: expoPushToken },
    });

    if (existingToken) {
      // Update existing token (user might have reinstalled app)
      const updated = await prisma.pushToken.update({
        where: { token: expoPushToken },
        data: {
          userId,
          siteId,
          deviceId,
          platform,
          deviceInfo,
          isActive: true,
          lastUsedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Token updated successfully',
        tokenId: updated.id,
      });
    }

    // Create new token
    const newToken = await prisma.pushToken.create({
      data: {
        token: expoPushToken,
        userId,
        siteId,
        deviceId,
        platform,
        deviceInfo,
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Token registered successfully',
      tokenId: newToken.id,
    });

  } catch (error) {
    console.error('[API] Error registering token:', error);
    return NextResponse.json(
      { error: 'Failed to register token' },
      { status: 500 }
    );
  }
}
```

### 2.2 Unregister Push Token

**File: `app/api/notifications/unregister-token/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { expoPushToken } = body;

    if (!expoPushToken) {
      return NextResponse.json(
        { error: 'expoPushToken is required' },
        { status: 400 }
      );
    }

    // Mark token as inactive (don't delete for audit trail)
    const updated = await prisma.pushToken.updateMany({
      where: { token: expoPushToken },
      data: { isActive: false },
    });

    return NextResponse.json({
      success: true,
      message: 'Token unregistered successfully',
      count: updated.count,
    });

  } catch (error) {
    console.error('[API] Error unregistering token:', error);
    return NextResponse.json(
      { error: 'Failed to unregister token' },
      { status: 500 }
    );
  }
}
```

### 2.3 Send Notification

**File: `app/api/notifications/send/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';

const expo = new Expo();

interface SendNotificationRequest {
  // Target audience (at least one required)
  userId?: string;      // Send to specific user
  siteId?: string;      // Send to all users in a site
  userIds?: string[];   // Send to multiple specific users
  broadcast?: boolean;  // Send to ALL users

  // Notification content
  title: string;
  body: string;
  data?: Record<string, any>;  // Custom data payload

  // Options
  sound?: string;
  badge?: number;
  priority?: 'default' | 'normal' | 'high';
}

export async function POST(request: NextRequest) {
  try {
    const requestBody: SendNotificationRequest = await request.json();
    const {
      userId,
      siteId,
      userIds,
      broadcast,
      title,
      body,
      data,
      sound = 'default',
      badge,
      priority = 'high',
    } = requestBody;

    // Validate required fields
    if (!title || !body) {
      return NextResponse.json(
        { error: 'title and body are required' },
        { status: 400 }
      );
    }

    // Build query to get tokens
    const whereClause: any = { isActive: true };

    if (broadcast) {
      // Send to everyone
      console.log('[Notifications] Broadcasting to all users');
    } else if (userId) {
      whereClause.userId = userId;
      console.log('[Notifications] Sending to user:', userId);
    } else if (siteId) {
      whereClause.siteId = siteId;
      console.log('[Notifications] Sending to site:', siteId);
    } else if (userIds && userIds.length > 0) {
      whereClause.userId = { in: userIds };
      console.log('[Notifications] Sending to users:', userIds);
    } else {
      return NextResponse.json(
        { error: 'Must specify userId, siteId, userIds, or broadcast' },
        { status: 400 }
      );
    }

    // Get tokens from database
    const tokens = await prisma.pushToken.findMany({
      where: whereClause,
    });

    if (tokens.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No active tokens found for the specified criteria',
        sent: 0,
      });
    }

    console.log(`[Notifications] Found ${tokens.length} tokens`);

    // Build Expo push messages
    const messages: ExpoPushMessage[] = tokens
      .filter(t => Expo.isExpoPushToken(t.token))
      .map(tokenRecord => ({
        to: tokenRecord.token,
        sound,
        title,
        body,
        data: data || {},
        badge,
        priority,
      }));

    // Send notifications in chunks (Expo recommends max 100 per request)
    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];
    const errors = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
        console.log(`[Notifications] Sent chunk of ${chunk.length} notifications`);
      } catch (error) {
        console.error('[Notifications] Error sending chunk:', error);
        errors.push(error);
      }
    }

    // Optional: Log notifications to database
    const logPromises = tokens.map(tokenRecord =>
      prisma.notificationLog.create({
        data: {
          tokenId: tokenRecord.id,
          userId: tokenRecord.userId,
          siteId: tokenRecord.siteId,
          title,
          body,
          data: data || {},
          status: 'sent',
          ticketId: null, // You can map this from tickets if needed
        },
      })
    );

    await Promise.allSettled(logPromises);

    // Update lastUsedAt for tokens
    await prisma.pushToken.updateMany({
      where: { id: { in: tokens.map(t => t.id) } },
      data: { lastUsedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      message: `Sent ${messages.length} notifications`,
      sent: messages.length,
      tickets,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error) {
    console.error('[API] Error sending notification:', error);
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    );
  }
}
```

### 2.4 Get Statistics (Optional)

**File: `app/api/notifications/stats/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get('siteId');

    // Total active tokens
    const totalActive = await prisma.pushToken.count({
      where: {
        isActive: true,
        ...(siteId && { siteId }),
      },
    });

    // Tokens by platform
    const byPlatform = await prisma.pushToken.groupBy({
      by: ['platform'],
      where: {
        isActive: true,
        ...(siteId && { siteId }),
      },
      _count: true,
    });

    // Recent notifications sent
    const recentNotifications = await prisma.notificationLog.count({
      where: {
        sentAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
        ...(siteId && { siteId }),
      },
    });

    return NextResponse.json({
      success: true,
      stats: {
        totalActiveTokens: totalActive,
        platformBreakdown: byPlatform.map(p => ({
          platform: p.platform,
          count: p._count,
        })),
        notificationsSent24h: recentNotifications,
      },
    });

  } catch (error) {
    console.error('[API] Error getting stats:', error);
    return NextResponse.json(
      { error: 'Failed to get statistics' },
      { status: 500 }
    );
  }
}
```

---

## Part 3: Mobile App Integration

### 3.1 Create Notification API Service

**File: `services/notifications/notificationApi.ts` (NEW FILE)**

```typescript
import { apiClient } from "@/system/api";
import { Platform } from "react-native";
import Constants from "expo-constants";

/**
 * Register push token with backend
 */
export const registerPushToken = async (
  expoPushToken: string,
  userId?: string,
  siteId?: string
) => {
  try {
    console.log("[NotificationAPI] Registering token with backend:", {
      token: expoPushToken,
      userId,
      siteId,
    });

    const response = await apiClient.post("/notifications/register-token", {
      expoPushToken,
      userId,
      siteId,
      deviceId: Constants.deviceId || Constants.sessionId,
      platform: Platform.OS,
      deviceInfo: {
        brand: Constants.deviceName,
        osVersion: Platform.Version,
        appVersion: Constants.expoConfig?.version,
      },
    });

    console.log("[NotificationAPI] Token registered successfully:", response.data);
    return response.data;
  } catch (error) {
    console.error("[NotificationAPI] Failed to register token:", error);
    throw error;
  }
};

/**
 * Unregister push token from backend
 */
export const unregisterPushToken = async (expoPushToken: string) => {
  try {
    console.log("[NotificationAPI] Unregistering token:", expoPushToken);

    const response = await apiClient.post("/notifications/unregister-token", {
      expoPushToken,
    });

    console.log("[NotificationAPI] Token unregistered successfully");
    return response.data;
  } catch (error) {
    console.error("[NotificationAPI] Failed to unregister token:", error);
    throw error;
  }
};
```

### 3.2 Update Notification Hook

**File: `hooks/use-notifications.ts` (UPDATE)**

```typescript
// Add import at top
import { registerPushToken } from "@/services/notifications/notificationApi";
import { useAuthStore } from "@/stores"; // Assuming you have user info here

// Inside the hook, update the token registration section (around line 65)
export const useNotifications = () => {
  // ... existing code ...

  const { user } = useAuthStore(); // Get current user
  const { currentSiteId } = useSiteStore(); // Get current site if available

  useEffect(() => {
    // ... existing setup code ...

    const initializeNotifications = async () => {
      try {
        setupNotificationHandler();

        const token = await registerForPushNotificationsAsync();

        if (token) {
          console.log("[useNotifications] ✅ Push token obtained successfully");
          setExpoPushToken(token);
          setPermissionStatus("granted");

          // ✅ NEW: Register token with backend
          try {
            await registerPushToken(
              token,
              user?.id,           // Pass user ID if available
              currentSiteId       // Pass site ID if available
            );
            console.log("[useNotifications] ✅ Token registered with backend");
          } catch (error) {
            console.error("[useNotifications] ⚠️ Failed to register token with backend:", error);
            // Don't fail the whole initialization if backend fails
            // The token is still stored locally and can be synced later
          }
        }

        // ... rest of initialization ...
      } catch (error) {
        console.error("[useNotifications] ❌ Error initializing notifications:", error);
        setPermissionStatus("error");
      }
    };

    initializeNotifications();

    return () => {
      // ... existing cleanup ...
    };
  }, [/* dependencies */]);
};
```

### 3.3 Handle Logout (Unregister Token)

**Example usage in logout function:**

```typescript
import { unregisterPushToken } from "@/services/notifications/notificationApi";
import { useNotificationStore } from "@/stores";

async function handleLogout() {
  const { expoPushToken } = useNotificationStore.getState();

  if (expoPushToken) {
    try {
      await unregisterPushToken(expoPushToken);
      console.log("Token unregistered on logout");
    } catch (error) {
      console.error("Failed to unregister token:", error);
    }
  }

  // ... rest of logout logic
}
```

---

## Part 4: Testing

### 4.1 Start Backend Server

```bash
cd push-notification-backend
npm run dev
```

Backend should run on `http://localhost:3000`

### 4.2 Update Mobile App API URL

**File: `.env`**

```env
EXPO_PUBLIC_API=http://localhost:3000/api
# OR if testing on device
EXPO_PUBLIC_API=http://YOUR_IP_ADDRESS:3000/api
```

### 4.3 Test Token Registration

1. **Run mobile app** on physical device
2. **Grant notification permissions**
3. **Check backend database:**

```bash
npx prisma studio
```

You should see your token in the `PushToken` table.

### 4.4 Test Sending Notification

**Using cURL:**

```bash
# Send to specific user
curl -X POST http://localhost:3000/api/notifications/send \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "title": "Hello!",
    "body": "This is a test notification from backend",
    "data": {
      "siteId": "example.com",
      "screen": "/site/example.com"
    }
  }'

# Send to all users in a site
curl -X POST http://localhost:3000/api/notifications/send \
  -H "Content-Type: application/json" \
  -d '{
    "siteId": "example.com",
    "title": "Site Announcement",
    "body": "New benefits available!"
  }'

# Broadcast to all users
curl -X POST http://localhost:3000/api/notifications/send \
  -H "Content-Type: application/json" \
  -d '{
    "broadcast": true,
    "title": "System Maintenance",
    "body": "App will be down for maintenance"
  }'
```

**Using Postman or Insomnia:**

```
POST http://localhost:3000/api/notifications/send
Content-Type: application/json

{
  "userId": "user123",
  "title": "Test Notification",
  "body": "Hello from backend!",
  "data": {
    "screen": "/site/example.com/benefits"
  }
}
```

### 4.5 Check Statistics

```bash
# Get overall stats
curl http://localhost:3000/api/notifications/stats

# Get stats for specific site
curl http://localhost:3000/api/notifications/stats?siteId=example.com
```

---

## Part 5: Admin Dashboard (Optional)

### 5.1 Simple Admin Page

**File: `app/admin/notifications/page.tsx`**

```typescript
'use client';

import { useState } from 'react';

export default function NotificationAdmin() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [target, setTarget] = useState<'broadcast' | 'site' | 'user'>('broadcast');
  const [targetValue, setTargetValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const sendNotification = async () => {
    setLoading(true);
    setResult(null);

    try {
      const payload: any = { title, body };

      if (target === 'broadcast') {
        payload.broadcast = true;
      } else if (target === 'site') {
        payload.siteId = targetValue;
      } else if (target === 'user') {
        payload.userId = targetValue;
      }

      const response = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({ error: 'Failed to send notification' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">Push Notification Admin</h1>

      <div className="space-y-4">
        {/* Title */}
        <div>
          <label className="block font-medium mb-2">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border rounded px-3 py-2"
            placeholder="Notification title"
          />
        </div>

        {/* Body */}
        <div>
          <label className="block font-medium mb-2">Body</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full border rounded px-3 py-2"
            rows={3}
            placeholder="Notification message"
          />
        </div>

        {/* Target */}
        <div>
          <label className="block font-medium mb-2">Target</label>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value as any)}
            className="w-full border rounded px-3 py-2"
          >
            <option value="broadcast">Broadcast (All Users)</option>
            <option value="site">Specific Site</option>
            <option value="user">Specific User</option>
          </select>
        </div>

        {/* Target Value */}
        {target !== 'broadcast' && (
          <div>
            <label className="block font-medium mb-2">
              {target === 'site' ? 'Site ID' : 'User ID'}
            </label>
            <input
              type="text"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder={target === 'site' ? 'example.com' : 'user123'}
            />
          </div>
        )}

        {/* Send Button */}
        <button
          onClick={sendNotification}
          disabled={loading || !title || !body}
          className="w-full bg-blue-600 text-white rounded px-4 py-2 font-medium hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? 'Sending...' : 'Send Notification'}
        </button>

        {/* Result */}
        {result && (
          <div className={`p-4 rounded ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <pre className="text-sm overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## Part 6: Production Deployment

### 6.1 Environment Variables

**File: `.env` (Backend)**

```env
# Database
DATABASE_URL="file:./prod.db"

# Optional: Rate limiting, authentication, etc.
API_SECRET_KEY="your-secret-key"
```

### 6.2 Deploy Backend

**Options:**

1. **Vercel** (Recommended for Next.js)
   ```bash
   npm install -g vercel
   vercel deploy
   ```

2. **Railway** (Supports persistent SQLite)
   - Connect GitHub repo
   - Auto-deploys on push

3. **Docker**
   ```dockerfile
   FROM node:18-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm install
   COPY . .
   RUN npx prisma generate
   RUN npm run build
   CMD ["npm", "start"]
   ```

### 6.3 Update Mobile App API URL

Update `.env` in mobile app:

```env
EXPO_PUBLIC_API=https://your-backend.vercel.app/api
```

### 6.4 Security Considerations

1. **Add API Authentication**
   - Require API key for `/notifications/send` endpoint
   - JWT authentication for user-specific endpoints

2. **Rate Limiting**
   - Prevent token spam registration
   - Limit notification sending

3. **Input Validation**
   - Validate all inputs with Zod or similar

**Example with API Key:**

```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Protect send endpoint
  if (pathname === '/api/notifications/send') {
    const apiKey = request.headers.get('x-api-key');

    if (apiKey !== process.env.API_SECRET_KEY) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
```

---

## Part 7: Advanced Features

### 7.1 Scheduled Notifications

Use a job queue like **Bull** or **pg-boss**, or simple cron jobs:

```typescript
// lib/scheduler.ts
import { prisma } from '@/lib/prisma';
import { sendNotificationToSite } from './notification-sender';

export async function sendDailyReminder() {
  const sites = await prisma.pushToken.groupBy({
    by: ['siteId'],
    where: { isActive: true },
  });

  for (const { siteId } of sites) {
    if (siteId) {
      await sendNotificationToSite(
        siteId,
        'Daily Reminder',
        'Check out your benefits!'
      );
    }
  }
}

// Run with cron: every day at 9 AM
// Use node-cron or deploy to a service with cron support
```

### 7.2 Notification Templates

```typescript
// lib/templates.ts
export const templates = {
  newBenefit: (benefitName: string) => ({
    title: 'New Benefit Available!',
    body: `Check out ${benefitName} in your benefits portal`,
    data: { type: 'new_benefit', benefitName },
  }),

  announcement: (message: string) => ({
    title: 'Important Announcement',
    body: message,
    data: { type: 'announcement' },
  }),

  reminder: (eventName: string, date: string) => ({
    title: 'Upcoming Event',
    body: `${eventName} is scheduled for ${date}`,
    data: { type: 'reminder', eventName, date },
  }),
};
```

### 7.3 User Preferences

Add to Prisma schema:

```prisma
model NotificationPreference {
  id        String   @id @default(uuid())
  userId    String   @unique

  // Preferences
  enableAnnouncements Boolean @default(true)
  enableReminders     Boolean @default(true)
  enableBenefitUpdates Boolean @default(true)

  // Quiet hours
  quietHoursStart String?  // "22:00"
  quietHoursEnd   String?  // "08:00"
  timezone        String?  // "America/New_York"

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

Check preferences before sending:

```typescript
const preferences = await prisma.notificationPreference.findUnique({
  where: { userId },
});

if (!preferences?.enableAnnouncements && notificationType === 'announcement') {
  console.log('User has disabled announcements');
  return;
}
```

---

## Summary

### What You Have Now:

✅ **Mobile App** (React Native + Expo)
- Token registration
- Notification listeners
- Local state management

✅ **Backend** (Next.js + Prisma + SQLite)
- Token storage
- Send notifications (user/site/broadcast)
- Statistics endpoint
- Notification logging

### The Flow:

1. **User opens app** → Gets Expo push token
2. **App sends token to your Next.js backend** → Stored in SQLite
3. **Admin/System wants to send notification** → Calls `/api/notifications/send`
4. **Backend queries tokens** → Sends to Expo's service
5. **Expo routes to platform** (APNs/FCM) → User receives notification
6. **App handles notification** → Navigate, show alert, etc.

### Files Created:

**Backend:**
- `prisma/schema.prisma` - Database schema
- `lib/prisma.ts` - Prisma client
- `app/api/notifications/register-token/route.ts` - Register token endpoint
- `app/api/notifications/unregister-token/route.ts` - Unregister endpoint
- `app/api/notifications/send/route.ts` - Send notification endpoint
- `app/api/notifications/stats/route.ts` - Statistics endpoint
- `app/admin/notifications/page.tsx` - Admin dashboard (optional)

**Mobile App:**
- `services/notifications/notificationApi.ts` - API integration
- Update `hooks/use-notifications.ts` - Register token with backend

### Next Steps:

1. Set up Next.js backend with Prisma and SQLite
2. Create API routes for token management
3. Update mobile app to call backend APIs
4. Test end-to-end flow
5. Build admin dashboard for sending notifications
6. Deploy to production
7. Add authentication and rate limiting

---

## Resources

- [Expo Push Notifications](https://docs.expo.dev/push-notifications/overview/)
- [expo-server-sdk](https://github.com/expo/expo-server-sdk-node)
- [Prisma Docs](https://www.prisma.io/docs)
- [Next.js App Router](https://nextjs.org/docs/app)
- [SQLite](https://www.sqlite.org/)
