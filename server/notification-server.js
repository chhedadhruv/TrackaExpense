'use strict';

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

// Initialize Firebase Admin using ENV vars (no JSON file required)
const {
  FIREBASE_PROJECT_ID,
  FIREBASE_CLIENT_EMAIL,
  FIREBASE_PRIVATE_KEY,
  PORT = 4000,
} = process.env;

if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
  // eslint-disable-next-line no-console
  console.error(
    'Missing Firebase Admin env vars. Please set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.'
  );
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: FIREBASE_PROJECT_ID,
    clientEmail: FIREBASE_CLIENT_EMAIL,
    privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});

const app = express();
app.use(cors());
app.use(express.json());

// Track sent notifications to prevent duplicates
const sentNotifications = new Set();

// Health endpoint
app.get('/health', (_req, res) => res.json({ ok: true }));

// Send FCM notification to multiple device tokens
app.post('/send-notification', async (req, res) => {
  try {
    const { tokens, notification, data } = req.body || {};

    // Create unique key for deduplication
    const notificationKey = `${notification?.title}_${notification?.body}_${tokens?.join(',')}`;
    
    if (sentNotifications.has(notificationKey)) {
      return res.json({ success: true, response: { successCount: 0, failureCount: 0, responses: [] } });
    }
    
    sentNotifications.add(notificationKey);
    
    // Clean up after 5 minutes
    setTimeout(() => {
      sentNotifications.delete(notificationKey);
    }, 5 * 60 * 1000);


    if (!Array.isArray(tokens) || tokens.length === 0) {
      return res.status(400).json({ error: 'tokens (array) is required' });
    }

    // Send individual messages to prevent duplicate issues
    const messages = tokens.map(token => ({
      token,
      notification: notification || undefined,
      data: Object.fromEntries(
        Object.entries(data || {}).map(([k, v]) => [k, String(v)])
      ),
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'trackaexpense_default_alerts',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK',
        },
      },
      apns: {
        headers: { 'apns-priority': '10' },
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            alert: {
              title: notification?.title,
              body: notification?.body,
            },
          },
        },
      },
    }));

    // Send individual messages
    const response = await admin.messaging().sendEach(messages);
    
    
    return res.json({ success: true, response });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('send-notification error:', error);
    return res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Notification server listening on http://localhost:${PORT}`);
});


