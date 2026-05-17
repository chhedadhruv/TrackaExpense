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
// Email automation (writes to `mail` collection → Trigger Email extension)
// ---------------------------------------------------------------------------

function formatCurrencyAmount(amount, currencyCode) {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currencyCode || 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch (_) {
    return `${currencyCode || '₹'}${amount}`;
  }
}

// Returns the ISO week string (YYYY-Www) for the given date
function getISOWeekString(date) {
  const d = new Date(date);
  const dayOfWeek = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function getISTMonthString() {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const d = new Date(Date.now() + IST_OFFSET_MS);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function sendWeeklySummaryEmails() {
  const db = admin.firestore();
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const weekKey = getISOWeekString(new Date(Date.now() + IST_OFFSET_MS));

  // Date range: last 7 days
  const today = getISTDateString();
  const sevenDaysAgo = getISTDateString(6);

  let usersSnap;
  try {
    usersSnap = await db.collection('users').get();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[WeeklyEmail] Failed to fetch users:', err.message);
    return;
  }

  const tasks = usersSnap.docs.map(async (doc) => {
    const { email, name, currency } = doc.data();
    if (!email) return;

    const logRef = db.collection('users').doc(doc.id).collection('reminderLogs').doc(`email_week_${weekKey}`);
    const logDoc = await logRef.get();
    if (logDoc.exists) return; // already sent this week

    try {
      const txSnap = await db
        .collection('users').doc(doc.id)
        .collection('transactions')
        .where('date', '>=', sevenDaysAgo)
        .where('date', '<=', today)
        .get();

      if (txSnap.empty) return; // no activity this week, skip

      let totalExpense = 0;
      let totalIncome = 0;
      const categoryMap = {};

      txSnap.docs.forEach((t) => {
        const { amount, type, category } = t.data();
        const amt = Number(amount) || 0;
        if (type === 'expense') {
          totalExpense += amt;
          categoryMap[category] = (categoryMap[category] || 0) + amt;
        } else {
          totalIncome += amt;
        }
      });

      const topCategory = Object.entries(categoryMap).sort((a, b) => b[1] - a[1])[0];
      const savings = totalIncome - totalExpense;
      const currencyCode = currency || 'INR';

      const topCategoryLine = topCategory
        ? `<tr><td style="padding:8px 0;color:#666">Top category</td><td style="padding:8px 0;font-weight:600;text-align:right">${topCategory[0]} (${formatCurrencyAmount(topCategory[1], currencyCode)})</td></tr>`
        : '';

      const savingsColor = savings >= 0 ? '#25B07F' : '#F64E4E';
      const savingsLabel = savings >= 0 ? 'Saved' : 'Overspent';

      const html = `
<!DOCTYPE html><html><body style="font-family:sans-serif;background:#F4F6FA;margin:0;padding:24px">
<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
  <h2 style="color:#677CD2;margin-top:0">Weekly Summary 📊</h2>
  <p style="color:#444">Hey ${name || 'there'}, here's how your week looked:</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0">
    <tr><td style="padding:8px 0;color:#666">Total income</td><td style="padding:8px 0;font-weight:600;text-align:right;color:#25B07F">${formatCurrencyAmount(totalIncome, currencyCode)}</td></tr>
    <tr><td style="padding:8px 0;color:#666">Total expenses</td><td style="padding:8px 0;font-weight:600;text-align:right;color:#F64E4E">${formatCurrencyAmount(totalExpense, currencyCode)}</td></tr>
    ${topCategoryLine}
    <tr style="border-top:1px solid #eee"><td style="padding:12px 0 0;font-weight:700">${savingsLabel}</td><td style="padding:12px 0 0;font-weight:700;text-align:right;color:${savingsColor}">${formatCurrencyAmount(Math.abs(savings), currencyCode)}</td></tr>
  </table>
  <p style="color:#888;font-size:13px;margin-bottom:0">Keep tracking your expenses to reach your financial goals. Open <strong>TrackaExpense</strong> to see the full breakdown.</p>
</div>
</body></html>`;

      await db.collection('mail').add({
        to: email,
        message: {
          subject: `Your Weekly Summary — ${formatCurrencyAmount(totalExpense, currencyCode)} spent this week`,
          html,
          text: `Weekly Summary\n\nIncome: ${formatCurrencyAmount(totalIncome, currencyCode)}\nExpenses: ${formatCurrencyAmount(totalExpense, currencyCode)}\n${topCategory ? `Top category: ${topCategory[0]}\n` : ''}${savingsLabel}: ${formatCurrencyAmount(Math.abs(savings), currencyCode)}\n\nOpen TrackaExpense for the full breakdown.`,
        },
      });

      await logRef.set({ sentAt: admin.firestore.FieldValue.serverTimestamp(), weekKey });
      // eslint-disable-next-line no-console
      console.log(`[WeeklyEmail] Sent to ${email}`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[WeeklyEmail] Failed for ${email}:`, err.message);
    }
  });

  await Promise.allSettled(tasks);
}

async function sendMonthlySummaryEmails() {
  const db = admin.firestore();
  const monthKey = getISTMonthString();

  // Date range: current month so far
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const nowIST = new Date(Date.now() + IST_OFFSET_MS);
  const year = nowIST.getUTCFullYear();
  const month = nowIST.getUTCMonth() + 1;
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const monthEnd = getISTDateString();

  // The previous month label for the email (this runs on the 1st so we report last month)
  const prevMonth = new Date(Date.UTC(year, month - 2, 1));
  const prevMonthLabel = prevMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const prevMonthStart = `${prevMonth.getUTCFullYear()}-${String(prevMonth.getUTCMonth() + 1).padStart(2, '0')}-01`;
  const prevMonthEnd = getISTDateString(1); // yesterday = last day of prev month

  let usersSnap;
  try {
    usersSnap = await db.collection('users').get();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[MonthlyEmail] Failed to fetch users:', err.message);
    return;
  }

  const tasks = usersSnap.docs.map(async (doc) => {
    const { email, name, currency } = doc.data();
    if (!email) return;

    const logRef = db.collection('users').doc(doc.id).collection('reminderLogs').doc(`email_month_${monthKey}`);
    const logDoc = await logRef.get();
    if (logDoc.exists) return;

    try {
      const txSnap = await db
        .collection('users').doc(doc.id)
        .collection('transactions')
        .where('date', '>=', prevMonthStart)
        .where('date', '<=', prevMonthEnd)
        .get();

      if (txSnap.empty) return;

      let totalExpense = 0;
      let totalIncome = 0;
      const categoryMap = {};
      const dailyExpense = {};

      txSnap.docs.forEach((t) => {
        const { amount, type, category, date } = t.data();
        const amt = Number(amount) || 0;
        if (type === 'expense') {
          totalExpense += amt;
          categoryMap[category] = (categoryMap[category] || 0) + amt;
          dailyExpense[date] = (dailyExpense[date] || 0) + amt;
        } else {
          totalIncome += amt;
        }
      });

      const topCategories = Object.entries(categoryMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);
      const avgDailyExpense = totalExpense / Object.keys(dailyExpense).length || 0;
      const savings = totalIncome - totalExpense;
      const currencyCode = currency || 'INR';
      const savingsColor = savings >= 0 ? '#25B07F' : '#F64E4E';
      const savingsLabel = savings >= 0 ? 'Net savings' : 'Net deficit';

      const categoryRows = topCategories
        .map(([cat, amt]) => `<tr><td style="padding:6px 0;color:#666">${cat}</td><td style="padding:6px 0;text-align:right;font-weight:600">${formatCurrencyAmount(amt, currencyCode)}</td></tr>`)
        .join('');

      const html = `
<!DOCTYPE html><html><body style="font-family:sans-serif;background:#F4F6FA;margin:0;padding:24px">
<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
  <h2 style="color:#677CD2;margin-top:0">${prevMonthLabel} Report 📈</h2>
  <p style="color:#444">Hey ${name || 'there'}, here's your complete month at a glance:</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0">
    <tr><td style="padding:8px 0;color:#666">Total income</td><td style="padding:8px 0;font-weight:600;text-align:right;color:#25B07F">${formatCurrencyAmount(totalIncome, currencyCode)}</td></tr>
    <tr><td style="padding:8px 0;color:#666">Total expenses</td><td style="padding:8px 0;font-weight:600;text-align:right;color:#F64E4E">${formatCurrencyAmount(totalExpense, currencyCode)}</td></tr>
    <tr><td style="padding:8px 0;color:#666">Avg daily spend</td><td style="padding:8px 0;font-weight:600;text-align:right">${formatCurrencyAmount(Math.round(avgDailyExpense), currencyCode)}</td></tr>
    <tr style="border-top:1px solid #eee"><td style="padding:12px 0 0;font-weight:700">${savingsLabel}</td><td style="padding:12px 0 0;font-weight:700;text-align:right;color:${savingsColor}">${formatCurrencyAmount(Math.abs(savings), currencyCode)}</td></tr>
  </table>
  ${topCategories.length ? `<h3 style="color:#333;font-size:15px">Top spending categories</h3><table style="width:100%;border-collapse:collapse">${categoryRows}</table>` : ''}
  <p style="color:#888;font-size:13px;margin-bottom:0">Open <strong>TrackaExpense</strong> to explore your full monthly breakdown and set goals for next month.</p>
</div>
</body></html>`;

      await db.collection('mail').add({
        to: email,
        message: {
          subject: `Your ${prevMonthLabel} Report — ${formatCurrencyAmount(totalExpense, currencyCode)} spent`,
          html,
          text: `${prevMonthLabel} Report\n\nIncome: ${formatCurrencyAmount(totalIncome, currencyCode)}\nExpenses: ${formatCurrencyAmount(totalExpense, currencyCode)}\n${savingsLabel}: ${formatCurrencyAmount(Math.abs(savings), currencyCode)}\n\nOpen TrackaExpense for the full breakdown.`,
        },
      });

      await logRef.set({ sentAt: admin.firestore.FieldValue.serverTimestamp(), monthKey });
      // eslint-disable-next-line no-console
      console.log(`[MonthlyEmail] Sent to ${email}`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[MonthlyEmail] Failed for ${email}:`, err.message);
    }
  });

  await Promise.allSettled(tasks);
}

async function sendSavingsGoalCompletionEmails() {
  const db = admin.firestore();

  let usersSnap;
  try {
    usersSnap = await db.collection('users').get();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[GoalEmail] Failed to fetch users:', err.message);
    return;
  }

  const tasks = usersSnap.docs.map(async (doc) => {
    const { email, name, currency } = doc.data();
    if (!email) return;

    try {
      const goalsSnap = await db
        .collection('users').doc(doc.id)
        .collection('savings')
        .get();

      const completedGoals = goalsSnap.docs.filter((g) => {
        const { currentAmount, targetAmount, goalReachedEmailSent } = g.data();
        return (
          !goalReachedEmailSent &&
          targetAmount > 0 &&
          Number(currentAmount) >= Number(targetAmount)
        );
      });

      if (completedGoals.length === 0) return;

      const currencyCode = currency || 'INR';

      for (const goalDoc of completedGoals) {
        const { name: goalName, targetAmount } = goalDoc.data();

        const html = `
<!DOCTYPE html><html><body style="font-family:sans-serif;background:#F4F6FA;margin:0;padding:24px">
<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.08);text-align:center">
  <div style="font-size:64px;margin-bottom:16px">🎉</div>
  <h2 style="color:#677CD2;margin-top:0">Goal Reached!</h2>
  <p style="color:#444">Hey ${name || 'there'}, you did it!</p>
  <div style="background:#F0F4FF;border-radius:12px;padding:20px;margin:20px 0">
    <p style="color:#677CD2;font-size:18px;font-weight:700;margin:0">${goalName}</p>
    <p style="color:#25B07F;font-size:24px;font-weight:700;margin:8px 0 0">${formatCurrencyAmount(targetAmount, currencyCode)}</p>
  </div>
  <p style="color:#444">You've reached your savings goal. Open <strong>TrackaExpense</strong> to celebrate and set your next goal!</p>
</div>
</body></html>`;

        await db.collection('mail').add({
          to: email,
          message: {
            subject: `🎉 You reached your "${goalName}" savings goal!`,
            html,
            text: `Goal Reached!\n\nHey ${name || 'there'}, you've reached your "${goalName}" savings goal of ${formatCurrencyAmount(targetAmount, currencyCode)}!\n\nOpen TrackaExpense to celebrate and set your next goal.`,
          },
        });

        await goalDoc.ref.update({ goalReachedEmailSent: true });
        // eslint-disable-next-line no-console
        console.log(`[GoalEmail] Sent goal completion email to ${email} for goal: ${goalName}`);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[GoalEmail] Failed for ${email}:`, err.message);
    }
  });

  await Promise.allSettled(tasks);
}

// Weekly summary — every Sunday at 8:00 AM IST (02:30 UTC)
cron.schedule('30 2 * * 0', sendWeeklySummaryEmails);

// Monthly report — 1st of each month at 9:00 AM IST (03:30 UTC)
cron.schedule('30 3 1 * *', sendMonthlySummaryEmails);

// Savings goal completion check — every 6 hours
cron.schedule('0 */6 * * *', sendSavingsGoalCompletionEmails);

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
