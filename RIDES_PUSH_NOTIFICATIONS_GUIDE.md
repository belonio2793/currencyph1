# Push Notifications Setup Guide - Rides Feature

## Overview
This guide explains how to implement push notifications for ride requests, driver arrivals, payment confirmations, and ride updates for the Uber-style rides application.

## Architecture

### Push Notification Triggers
1. **Ride Request** - New request received by driver
2. **Driver Accepted** - Driver accepts rider's request
3. **Driver Arriving** - Driver is 5 minutes away
4. **Driver Arrived** - Driver arrived at pickup location
5. **Payment Confirmed** - Payment successful
6. **New Message** - Chat message from other party
7. **Ride Completed** - Ride finished
8. **Rating Reminder** - Rate your driver/rider

## Implementation Options

### Option 1: Supabase + Firebase Cloud Messaging (FCM)
**Best for**: Android, Web, cross-platform

#### Prerequisites
- Supabase project
- Firebase project
- Firebase service account key

#### Implementation Steps

1. **Install Dependencies**
```bash
npm install firebase
npm install @react-native-firebase/messaging  # For React Native
```

2. **Initialize Firebase in App**
```javascript
// src/lib/firebaseConfig.js
import { initializeApp } from 'firebase/app'
import { getMessaging } from 'firebase/messaging'

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
export const messaging = getMessaging(app)
```

3. **Register for Push Notifications**
```javascript
// src/lib/pushNotifications.js
import { messaging } from './firebaseConfig'
import { getToken, onMessage } from 'firebase/messaging'
import { supabase } from './supabaseClient'

export const registerForPushNotifications = async (userId) => {
  try {
    // Request notification permission
    const permission = await Notification.requestPermission()
    if (permission === 'granted') {
      // Get FCM token
      const token = await getToken(messaging, {
        vapidKey: process.env.VITE_FIREBASE_VAPID_KEY
      })

      // Save token to database
      await supabase
        .from('push_notification_tokens')
        .upsert({
          user_id: userId,
          token: token,
          device_type: 'web',
          created_at: new Date().toISOString()
        })

      // Listen for messages
      onMessage(messaging, (payload) => {
        handlePushNotification(payload)
      })

      return token
    }
  } catch (error) {
    console.error('Push notification registration failed:', error)
  }
}

const handlePushNotification = (payload) => {
  const { title, body, data } = payload.notification
  
  // Create desktop notification
  if ('Notification' in window) {
    new Notification(title, {
      body: body,
      icon: '/logo.png',
      badge: '/badge.png',
      tag: data?.rideId || 'ride-notification',
      requireInteraction: data?.requireInteraction === 'true'
    })
  }
}
```

4. **Create Push Notification Service**
```javascript
// src/lib/rideNotifications.js
import { supabase } from './supabaseClient'

export const sendPushNotification = async (userId, notification) => {
  try {
    const { data: tokens, error } = await supabase
      .from('push_notification_tokens')
      .select('token')
      .eq('user_id', userId)
      .eq('is_active', true)

    if (error || !tokens || tokens.length === 0) {
      return
    }

    // Send via Supabase Edge Function
    for (const { token } of tokens) {
      await supabase.functions.invoke('send-push-notification', {
        body: {
          token,
          ...notification
        }
      })
    }
  } catch (err) {
    console.error('Error sending push notification:', err)
  }
}

// Specific notification functions
export const notifyRideRequest = async (driverId, rideData) => {
  await sendPushNotification(driverId, {
    title: 'New Ride Request! 🚗',
    body: `Pickup at ${rideData.start_address || 'your location'}`,
    data: {
      rideId: rideData.id,
      type: 'ride-request',
      requireInteraction: 'true'
    }
  })
}

export const notifyDriverAccepted = async (riderId, driverName) => {
  await sendPushNotification(riderId, {
    title: `${driverName} Accepted Your Ride ✓`,
    body: 'Your driver is on the way',
    data: {
      type: 'ride-accepted'
    }
  })
}

export const notifyDriverArriving = async (riderId, eta) => {
  await sendPushNotification(riderId, {
    title: 'Your Driver is Arriving Soon 📍',
    body: `ETA: ${eta} minutes`,
    data: {
      type: 'driver-arriving'
    }
  })
}

export const notifyPaymentConfirmed = async (userId, amount) => {
  await sendPushNotification(userId, {
    title: 'Payment Confirmed ✓',
    body: `₱${amount} payment successful`,
    data: {
      type: 'payment-confirmed'
    }
  })
}

export const notifyMessage = async (userId, senderName, message) => {
  await sendPushNotification(userId, {
    title: `Message from ${senderName}`,
    body: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
    data: {
      type: 'new-message'
    }
  })
}
```

### Option 2: Supabase Edge Function + OneSignal
**Best for**: More reliable delivery, analytics, segmentation

#### Setup Steps

1. **Create OneSignal Account**
- Visit https://onesignal.com
- Create new app
- Get API key and APP ID

2. **Create Edge Function**
```typescript
// supabase/functions/send-push-notification/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const ONESIGNAL_API_KEY = Deno.env.get("ONESIGNAL_API_KEY")
const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID")

serve(async (req) => {
  try {
    const { userId, title, body, data } = await req.json()

    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": `Basic ${ONESIGNAL_API_KEY}`
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        filters: [
          { field: "tag", key: "user_id", value: userId }
        ],
        headings: { en: title },
        contents: { en: body },
        data: data,
        priority: 10
      })
    })

    return new Response(
      JSON.stringify({ success: response.ok }),
      { headers: { "Content-Type": "application/json" } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400 }
    )
  }
})
```

### Option 3: Supabase + Twilio (SMS Fallback)
**Best for**: Ensuring notifications reach users without apps

```javascript
// src/lib/smsNotifications.js
export const sendSMSNotification = async (phoneNumber, message) => {
  const response = await supabase.functions.invoke('send-sms', {
    body: {
      to: phoneNumber,
      message: message
    }
  })
  return response
}

export const notifyRideRequestViaSMS = async (driver, rideData) => {
  const message = `Your next ride: Pickup at ${rideData.start_address}. Earn ₱${rideData.estimated_total_price}. Tap to accept: [app-link]`
  await sendSMSNotification(driver.phone_number, message)
}
```

## Database Schema for Push Notifications

```sql
-- Push notification tokens
CREATE TABLE push_notification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id),
  token TEXT NOT NULL,
  device_type VARCHAR(50), -- 'web', 'ios', 'android'
  device_name TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notification history
CREATE TABLE push_notification_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  notification_type VARCHAR(50),
  title VARCHAR(255),
  body TEXT,
  data JSONB,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE
);

-- Notification preferences
CREATE TABLE notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  ride_requests BOOLEAN DEFAULT TRUE,
  driver_updates BOOLEAN DEFAULT TRUE,
  payment_notifications BOOLEAN DEFAULT TRUE,
  chat_messages BOOLEAN DEFAULT TRUE,
  promotional BOOLEAN DEFAULT FALSE,
  sms_enabled BOOLEAN DEFAULT FALSE,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Integration with Rides Feature

### 1. Initialize on User Login
```javascript
// In Rides.jsx useEffect
useEffect(() => {
  if (userId) {
    registerForPushNotifications(userId)
  }
}, [userId])
```

### 2. Send on Ride Events
```javascript
// When ride is requested
const requestRide = async () => {
  const { data } = await supabase.from('rides').insert({...})
  
  // Notify available drivers
  const drivers = await getAvailableDrivers()
  for (const driver of drivers) {
    await notifyRideRequest(driver.id, data[0])
  }
}

// When driver accepts
const acceptRide = async (rideId) => {
  const { data } = await supabase.from('rides').update({...})
  
  // Notify rider
  const ride = data[0]
  const driver = await getDriver(userId)
  await notifyDriverAccepted(ride.rider_id, driver.full_name)
}
```

### 3. Handle Notification Preferences
```javascript
// Check preferences before sending
const shouldNotify = async (userId, type) => {
  const { data } = await supabase
    .from('notification_preferences')
    .select(type)
    .eq('user_id', userId)
    .single()

  if (!data[type]) return false

  // Check quiet hours
  const now = new Date()
  const currentTime = now.getHours() + ':' + now.getMinutes()
  
  if (data.quiet_hours_start && data.quiet_hours_end) {
    if (currentTime >= data.quiet_hours_start && 
        currentTime <= data.quiet_hours_end) {
      return false
    }
  }

  return true
}
```

## Environment Variables Required

```env
# Firebase
VITE_FIREBASE_API_KEY=xxx
VITE_FIREBASE_AUTH_DOMAIN=xxx
VITE_FIREBASE_PROJECT_ID=xxx
VITE_FIREBASE_STORAGE_BUCKET=xxx
VITE_FIREBASE_MESSAGING_SENDER_ID=xxx
VITE_FIREBASE_APP_ID=xxx
VITE_FIREBASE_VAPID_KEY=xxx

# OneSignal
ONESIGNAL_API_KEY=xxx
ONESIGNAL_APP_ID=xxx

# Twilio (optional SMS)
TWILIO_ACCOUNT_SID=xxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_PHONE_NUMBER=xxx
```

## Testing Push Notifications

### 1. Local Testing
```javascript
// Test notification display
const testNotification = new Notification('Test Title', {
  body: 'This is a test notification',
  icon: '/logo.png'
})
```

### 2. Firebase Console Testing
- Go to Firebase Console
- Select "Cloud Messaging"
- Send test message
- Select device and verify

### 3. With Real Ride
1. Open app in two browsers
2. One as driver, one as rider
3. Request ride from rider
4. Check driver's notification
5. Accept ride
6. Check rider's notification

## Best Practices

### Do's ✅
- ✅ Send notifications only when necessary
- ✅ Respect user's quiet hours
- ✅ Include actionable information
- ✅ Use clear, concise titles and bodies
- ✅ Group similar notifications
- ✅ Include ride ID in data for easy navigation
- ✅ Test with real scenarios
- ✅ Monitor delivery rates

### Don'ts ❌
- ❌ Send too many notifications
- ❌ Use vague titles ("New update")
- ❌ Send during quiet hours without permission
- ❌ Forget to unregister tokens on logout
- ❌ Store sensitive data in notifications
- ❌ Ignore delivery failures
- ❌ Skip permission checks

## Troubleshooting

### Notifications Not Showing
1. Check browser permissions
2. Verify FCM token is stored
3. Check network connection
4. Review Supabase logs
5. Test with Firebase Console

### High Failure Rate
1. Implement token refresh logic
2. Remove invalid tokens
3. Check Firebase quotas
4. Monitor API rate limits

### Battery Drain Issues
1. Batch notifications
2. Use low-priority for non-urgent
3. Implement exponential backoff
4. Add frequency caps

## Next Steps

1. Choose notification service (Firebase FCM recommended)
2. Set up service account and keys
3. Create database tables
4. Implement notification functions
5. Add to Rides component
6. Test thoroughly
7. Monitor in production
8. Iterate based on user feedback

## Resources

- Firebase Cloud Messaging: https://firebase.google.com/docs/cloud-messaging
- OneSignal: https://documentation.onesignal.com
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
- Web Push API: https://developer.mozilla.org/en-US/docs/Web/API/Push_API
- Service Workers: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API

---

**Status**: Ready for Implementation
**Priority**: High (Critical for user engagement)
**Estimated Setup Time**: 2-4 hours
