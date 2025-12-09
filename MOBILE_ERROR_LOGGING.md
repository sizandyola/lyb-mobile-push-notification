# Mobile App Error Logging Integration

This guide explains how to integrate error logging from your mobile app to the backend server.

## API Endpoint

**POST** `https://your-server.com/api/logs/error`

## Request Format

### Required Fields
- `errorType` (string): Category of the error (e.g., "NETWORK_ERROR", "API_ERROR", "CRASH")
- `message` (string): Error message

### Optional Fields
- `tokenId` (string): Push token ID if available
- `platform` (string): "ios" or "android"
- `stackTrace` (string): Stack trace of the error
- `context` (object): Additional context (screen, action, user data, etc.)
- `appVersion` (string): Version of the mobile app

### Example Request

```json
{
  "errorType": "NETWORK_ERROR",
  "message": "Failed to fetch user data",
  "platform": "ios",
  "stackTrace": "Error: Network request failed\n  at fetch...",
  "context": {
    "screen": "ProfileScreen",
    "action": "loadUserData",
    "userId": "123"
  },
  "appVersion": "1.0.0"
}
```

### Response

**Success (200)**
```json
{
  "success": true,
  "id": "uuid-of-error-log"
}
```

**Error (400/500)**
```json
{
  "error": "Error message"
}
```

---

## React Native / Expo Implementation

### 1. Create Error Logger Service

Create a file `services/errorLogger.js`:

```javascript
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://your-server.com/api/logs/error';

class ErrorLogger {
  async logError({ errorType, message, stackTrace, context }) {
    try {
      // Get token ID if available
      const tokenId = await AsyncStorage.getItem('pushTokenId');

      const payload = {
        errorType,
        message,
        platform: Platform.OS,
        stackTrace: stackTrace || null,
        context: context || null,
        appVersion: Constants.expoConfig?.version || 'unknown',
        tokenId: tokenId || null,
      };

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Failed to log error to server:', data);
      }
    } catch (error) {
      // Silently fail to avoid infinite error loops
      console.error('Error logger failed:', error);
    }
  }

  // Log network errors
  logNetworkError(error, context = {}) {
    this.logError({
      errorType: 'NETWORK_ERROR',
      message: error.message || 'Network request failed',
      stackTrace: error.stack,
      context,
    });
  }

  // Log API errors
  logApiError(endpoint, statusCode, message, context = {}) {
    this.logError({
      errorType: 'API_ERROR',
      message: `${endpoint} - ${statusCode}: ${message}`,
      context: { endpoint, statusCode, ...context },
    });
  }

  // Log crashes
  logCrash(error, context = {}) {
    this.logError({
      errorType: 'CRASH',
      message: error.message || 'App crashed',
      stackTrace: error.stack,
      context,
    });
  }

  // Log custom errors
  logCustomError(errorType, message, context = {}) {
    this.logError({
      errorType,
      message,
      context,
    });
  }
}

export default new ErrorLogger();
```

### 2. Set Up Global Error Handler

In your `App.js` or main app file:

```javascript
import React, { useEffect } from 'react';
import errorLogger from './services/errorLogger';

// Set up global error handler
ErrorUtils.setGlobalHandler((error, isFatal) => {
  errorLogger.logCrash(error, {
    isFatal,
    timestamp: new Date().toISOString(),
  });

  // You can also show an error screen to the user here
  if (isFatal) {
    // Handle fatal errors
    console.error('FATAL ERROR:', error);
  }
});

export default function App() {
  useEffect(() => {
    // Log unhandled promise rejections
    const handleUnhandledRejection = (event) => {
      errorLogger.logError({
        errorType: 'UNHANDLED_REJECTION',
        message: event.reason?.message || 'Unhandled promise rejection',
        stackTrace: event.reason?.stack,
        context: { type: 'promise_rejection' },
      });
    };

    // Note: This is for web, for native you might need a different approach
    if (typeof window !== 'undefined') {
      window.addEventListener('unhandledrejection', handleUnhandledRejection);
      return () => {
        window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      };
    }
  }, []);

  return (
    // Your app components
  );
}
```

### 3. Usage Examples

#### Example 1: Logging Network Errors

```javascript
import errorLogger from './services/errorLogger';

async function fetchUserData() {
  try {
    const response = await fetch('https://api.example.com/user');
    const data = await response.json();
    return data;
  } catch (error) {
    // Log network error
    errorLogger.logNetworkError(error, {
      screen: 'ProfileScreen',
      action: 'fetchUserData',
    });
    throw error;
  }
}
```

#### Example 2: Logging API Errors

```javascript
import errorLogger from './services/errorLogger';

async function login(email, password) {
  try {
    const response = await fetch('https://api.example.com/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();

      // Log API error
      errorLogger.logApiError(
        '/login',
        response.status,
        error.message || 'Login failed',
        { email }
      );

      throw new Error(error.message);
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}
```

#### Example 3: Logging Custom Errors

```javascript
import errorLogger from './services/errorLogger';

function processPayment(amount) {
  if (amount <= 0) {
    // Log validation error
    errorLogger.logCustomError(
      'VALIDATION_ERROR',
      'Invalid payment amount',
      {
        screen: 'CheckoutScreen',
        amount,
        timestamp: new Date().toISOString(),
      }
    );
    throw new Error('Invalid amount');
  }

  // Process payment...
}
```

#### Example 4: Using with React Error Boundaries

```javascript
import React from 'react';
import errorLogger from './services/errorLogger';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error
    errorLogger.logCrash(error, {
      componentStack: errorInfo.componentStack,
      screen: this.props.screenName || 'unknown',
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <View>
          <Text>Something went wrong. Please try again.</Text>
        </View>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
```

### 4. Integration with Existing Push Token Registration

If you're already registering push tokens, save the token ID for error logging:

```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';

async function registerPushToken(token) {
  try {
    const response = await fetch('https://your-server.com/api/notifications/register-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        platform: Platform.OS,
        // ... other fields
      }),
    });

    const data = await response.json();

    if (data.success && data.tokenId) {
      // Save token ID for error logging
      await AsyncStorage.setItem('pushTokenId', data.tokenId);
    }
  } catch (error) {
    console.error('Failed to register push token:', error);
  }
}
```

---

## Common Error Types

Here are some recommended error types you can use:

- `NETWORK_ERROR` - Network connection issues
- `API_ERROR` - API request failures
- `CRASH` - App crashes or fatal errors
- `VALIDATION_ERROR` - Input validation failures
- `AUTH_ERROR` - Authentication/authorization failures
- `STORAGE_ERROR` - AsyncStorage or local storage errors
- `PERMISSION_ERROR` - Permission-related errors (camera, location, etc.)
- `PAYMENT_ERROR` - Payment processing errors
- `RENDER_ERROR` - Component rendering errors
- `TIMEOUT_ERROR` - Request timeout errors
- `UNHANDLED_REJECTION` - Unhandled promise rejections

---

## Viewing Error Logs

Access the error logs dashboard at:

**https://your-server.com/admin/error-logs**

Features:
- View all error logs in a table
- Filter by error type and platform
- View detailed error information including stack traces
- See error statistics and trends

---

## Best Practices

1. **Don't Log Sensitive Data**: Never include passwords, tokens, or personal information in error logs
2. **Add Context**: Include relevant context like screen name, user action, and app state
3. **Use Appropriate Error Types**: Use consistent error type names across your app
4. **Handle Logging Failures**: The error logger should never crash your app
5. **Rate Limiting**: Consider implementing rate limiting to avoid flooding the server with errors
6. **Privacy**: Ensure compliance with privacy regulations (GDPR, CCPA, etc.)

---

## Testing

Test the error logging by intentionally triggering errors:

```javascript
// Test network error
errorLogger.logNetworkError(new Error('Test network error'), {
  screen: 'TestScreen',
  test: true,
});

// Test API error
errorLogger.logApiError('/test', 500, 'Test API error', {
  test: true,
});

// Test crash
errorLogger.logCrash(new Error('Test crash'), {
  test: true,
});
```

Then check the admin dashboard to verify the errors were logged correctly.
