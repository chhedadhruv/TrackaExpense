'use strict';

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const cron = require('node-cron');

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

// ---------------------------------------------------------------------------
// Fun notification messages
// ---------------------------------------------------------------------------

const FUN_MESSAGES = {
  evening: [
    "Evening! 🌆 Time to wrap up your day with some financial tracking!",
    "Good evening! 🌅 Your expenses are calling - don't keep them waiting!",
    "Evening check-in! 🌇 How did your money behave today?",
    "Hey! 🌆 Don't let today's expenses slip away - log them now!",
    "Good evening! 🌅 Your financial diary is waiting for today's entry!",
  ],
  weekend: [
    "Weekend vibes! 🎉 But your expenses don't take weekends off!",
    "Happy weekend! 🌈 Time to catch up on your financial tracking!",
    "Weekend mode! 🎊 Your budget still needs your attention!",
    "Hey! 🎈 Weekend expenses count too - don't forget to log them!",
    "Weekend! 🎉 Your financial goals are still working hard for you!",
  ],
  motivational: [
    "You're doing amazing! 💪 Every expense you track is a step towards financial freedom!",
    "Keep going! 🚀 Your financial discipline is inspiring!",
    "You're on fire! 🔥 Your money management skills are getting stronger!",
    "Amazing work! ⭐ You're building wealth one transaction at a time!",
    "You're unstoppable! 💎 Your financial future is in great hands!",
  ],
  funny: [
    "Your expenses are like your ex - they keep coming back! 😂 Time to track them!",
    "Money talks, but yours is probably saying \"Why don't you track me?\" 💬",
    "Your wallet is like a good friend - it's always there, but you should check on it! 👛",
    "Expenses are like calories - they add up whether you count them or not! 🍕",
    "Your budget is like a plant - it needs regular attention to grow! 🌱",
  ],
  playful: [
    "Aapko dekh ke toh humara dil melt ho gaya, ab bas expenses track kar lo! 💕",
    "Your money is like biryani - it's better when you know what's in it! 🍛",
    "Aapke paise ko dekh ke humara mood ban gaya! Track karo aur khush raho! 😊",
    "You're the chef of your financial kitchen - time to track those ingredients! 👨‍🍳",
    "Aapka budget humara favorite dish hai! Keep it updated! 🍜",
  ],
};

const FUN_TITLES = {
  evening:     'Hey there! 👋',
  weekend:     'Weekend Vibes! 🎉',
  motivational: "You're Amazing! 💪",
  funny:       'LOL! 😂',
  playful:     'Aapka favorite app! 🍕',
};

function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Returns today's date string (YYYY-MM-DD) in IST
function getISTDateString(daysAgo = 0) {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const d = new Date(Date.now() + IST_OFFSET_MS - daysAgo * 86400000);
  return d.toISOString().slice(0, 10);
}

// Returns the current day-of-week in IST (0=Sun, 6=Sat)
function getISTDay() {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  return new Date(Date.now() + IST_OFFSET_MS).getUTCDay();
}

// Returns a random UTC timestamp (ms) for a time between 18:00–22:00 IST today.
// If current IST time is already past 22:00, returns null (skip today).
// If current IST time is between 18:00 and 22:00, picks a random time in the remaining window.
function getRandomScheduledTimestampToday() {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const nowUTC = Date.now();
  const nowIST = new Date(nowUTC + IST_OFFSET_MS);
  const istHour = nowIST.getUTCHours();
  const istMinute = nowIST.getUTCMinutes();
  const istMinuteOfDay = istHour * 60 + istMinute;

  const windowStartMinute = 18 * 60;  // 18:00 IST
  const windowEndMinute   = 22 * 60;  // 22:00 IST

  if (istMinuteOfDay >= windowEndMinute) return null; // too late today

  const from = Math.max(istMinuteOfDay, windowStartMinute);
  const randomMinuteOfDay = from + Math.floor(Math.random() * (windowEndMinute - from));

  // Convert back to UTC timestamp
  const startOfDayIST = new Date(nowIST);
  startOfDayIST.setUTCHours(0, 0, 0, 0);
  const scheduledIST = new Date(startOfDayIST.getTime() + randomMinuteOfDay * 60 * 1000);
  return scheduledIST.getTime() - IST_OFFSET_MS; // UTC ms
}

// Checks if this user is due for a fun notification and returns the context, or null to skip.
// Creates the schedule doc on first call of the day; sends when scheduled time is reached.
async function getFunContextForUser(uid) {
  const db = admin.firestore();
  const today = getISTDateString();
  const logRef = db.collection('users').doc(uid).collection('reminderLogs').doc(`fun_${today}`);
  const logDoc = await logRef.get();

  if (logDoc.exists) {
    if (logDoc.data().sentAt) return null; // already sent today
    // Scheduled but not yet sent — check if it's time
    const scheduledAt = logDoc.data().scheduledAt;
    if (!scheduledAt || Date.now() < scheduledAt) return null; // not time yet
  } else {
    // First check today — assign a random send time
    const scheduledAt = getRandomScheduledTimestampToday();
    if (!scheduledAt) return null; // past 22:00 IST, skip today

    await logRef.set({ date: today, scheduledAt, type: 'fun_notification' });
    if (Date.now() < scheduledAt) return null; // scheduled for later
  }

  // Time to send — determine context from user activity
  const todaySnap = await db
    .collection('users').doc(uid)
    .collection('transactions')
    .where('date', '==', today)
    .limit(1)
    .get();

  if (!todaySnap.empty) return 'motivational'; // active today

  const twoDaysAgo = getISTDateString(2);
  const recentSnap = await db
    .collection('users').doc(uid)
    .collection('transactions')
    .where('date', '>=', twoDaysAgo)
    .limit(1)
    .get();

  if (recentSnap.empty) {
    // Inactive 2+ days — re-engagement
    return (getISTDay() === 0 || getISTDay() === 6) ? 'funny' : 'motivational';
  }

  return (getISTDay() === 0 || getISTDay() === 6) ? 'weekend' : 'evening';
}

// Runs every 15 minutes — sends fun notifications to users whose scheduled time has arrived
async function sendDailyFunNotifications() {
  const db = admin.firestore();
  const today = getISTDateString();

  let usersSnap;
  try {
    usersSnap = await db.collection('users').where('fcmToken', '!=', null).get();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[FunNotification] Failed to fetch users:', err.message);
    return;
  }

  const tasks = usersSnap.docs.map(async (doc) => {
    const { fcmToken, email } = doc.data();
    if (!fcmToken) return;

    try {
      const context = await getFunContextForUser(doc.id);
      if (!context) return;

      const messages = FUN_MESSAGES[context] || FUN_MESSAGES.evening;
      const title = FUN_TITLES[context] || 'Hey there! 👋';
      const body = getRandom(messages);

      await admin.messaging().send({
        token: fcmToken,
        notification: { title, body },
        data: {
          type: 'fun_notification',
          context,
          action: 'view_dashboard',
          url: 'trackaexpense://home',
        },
        android: {
          priority: 'high',
          notification: { sound: 'default', channelId: 'trackaexpense_default_alerts' },
        },
        apns: {
          headers: { 'apns-priority': '10' },
          payload: { aps: { sound: 'default', badge: 1 } },
        },
      });

      // Mark as sent
      await db
        .collection('users').doc(doc.id)
        .collection('reminderLogs').doc(`fun_${today}`)
        .update({
          context,
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
        });

      // eslint-disable-next-line no-console
      console.log(`[FunNotification] Sent to ${email} (context: ${context})`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[FunNotification] Failed for ${email}:`, err.message);
    }
  });

  await Promise.allSettled(tasks);
}

// Check every 15 minutes who's due for their randomised daily notification
cron.schedule('*/15 * * * *', sendDailyFunNotifications);

// ---------------------------------------------------------------------------
// HTTP endpoints
// ---------------------------------------------------------------------------

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
