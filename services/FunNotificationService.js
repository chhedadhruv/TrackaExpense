import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import NotificationService from './NotificationService';
import moment from 'moment';

class FunNotificationService {
  constructor() {
    this.notificationService = NotificationService;
    this.funMessages = {
      morning: [
        'Good morning! 🌅 Your wallet is calling - time to track those expenses!',
        'Rise and shine! ☀️ Don\'t let your money slip through your fingers today!',
        'Morning! 🌸 Your financial future is waiting for you to log today\'s activities!',
        'Hey there! 🌺 Start your day right by tracking your finances!',
        'Good morning! 🌻 Your budget misses you - give it some attention today!',
      ],
      afternoon: [
        'Afternoon check-in! 🌞 How\'s your spending looking today?',
        'Hey! 🌤️ Don\'t forget to log that lunch expense!',
        'Afternoon vibes! 🌈 Your expenses are waiting to be recorded!',
        'Hi there! 🌸 Time for a quick financial check-in!',
        'Afternoon! 🌺 Your wallet needs some love - log those expenses!',
      ],
      evening: [
        'Evening! 🌆 Time to wrap up your day with some financial tracking!',
        'Good evening! 🌅 Your expenses are calling - don\'t keep them waiting!',
        'Evening check-in! 🌇 How did your money behave today?',
        'Hey! 🌆 Don\'t let today\'s expenses slip away - log them now!',
        'Good evening! 🌅 Your financial diary is waiting for today\'s entry!',
      ],
      weekend: [
        'Weekend vibes! 🎉 But your expenses don\'t take weekends off!',
        'Happy weekend! 🌈 Time to catch up on your financial tracking!',
        'Weekend mode! 🎊 Your budget still needs your attention!',
        'Hey! 🎈 Weekend expenses count too - don\'t forget to log them!',
        'Weekend! 🎉 Your financial goals are still working hard for you!',
      ],
      motivational: [
        'You\'re doing amazing! 💪 Every expense you track is a step towards financial freedom!',
        'Keep going! 🚀 Your financial discipline is inspiring!',
        'You\'re on fire! 🔥 Your money management skills are getting stronger!',
        'Amazing work! ⭐ You\'re building wealth one transaction at a time!',
        'You\'re unstoppable! 💎 Your financial future is in great hands!',
      ],
      funny: [
        'Your expenses are like your ex - they keep coming back! 😂 Time to track them!',
        'Money talks, but yours is probably saying "Why don\'t you track me?" 💬',
        'Your wallet is like a good friend - it\'s always there, but you should check on it! 👛',
        'Expenses are like calories - they add up whether you count them or not! 🍕',
        'Your budget is like a plant - it needs regular attention to grow! 🌱',
        'Money doesn\'t grow on trees, but it does grow when you track it! 🌳',
        'Your expenses are like your inbox - they never stop coming! 📧',
        'Budgeting is like dieting - easier when you track everything! 🥗',
        'Your wallet is like your phone - you should check it regularly! 📱',
        'Expenses are like your weight - they\'re easier to manage when you track them! ⚖️',
      ],
      playful: [
        'Aapko dekh ke toh humara dil melt ho gaya, ab bas expenses track kar lo! 💕',
        'You\'re the main course, but your expenses are the side dish! 🍽️',
        'Aapka financial health humara priority hai! Track karo aur healthy raho! 💚',
        'Your money is like biryani - it\'s better when you know what\'s in it! 🍛',
        'Aapke paise ko dekh ke humara mood ban gaya! Track karo aur khush raho! 😊',
        'You\'re the chef of your financial kitchen - time to track those ingredients! 👨‍🍳',
        'Aapka budget humara favorite dish hai! Keep it updated! 🍜',
        'Your expenses are like your favorite restaurant - they deserve attention! 🍕',
        'Aapke financial goals ko dekh ke humara heart skip ho gaya! 💓',
        'You\'re the star of your financial story - keep writing those chapters! ⭐',
      ],
      achievement: [
        'Congratulations! 🎉 You\'ve been tracking expenses for a week!',
        'Amazing! 🏆 You\'re building a strong financial foundation!',
        'Well done! 🎊 Your financial discipline is paying off!',
        'Fantastic! 🎈 You\'re on the right track to financial success!',
        'Excellent! 🎯 Your money management skills are improving!',
      ],
      seasonal: {
        winter: [
          'Winter is coming! ❄️ But your expenses are already here - track them!',
          'Cold weather, hot expenses! 🔥 Time to log those winter bills!',
          'Winter vibes! ⛄ Your budget needs some warmth - track your expenses!',
        ],
        summer: [
          'Summer heat! ☀️ But your expenses are hotter - track them!',
          'Hot weather, cool expenses! 🧊 Time to log those summer spends!',
          'Summer vibes! 🌞 Your budget is melting - track your expenses!',
        ],
        monsoon: [
          'Monsoon mood! 🌧️ But your expenses are pouring in - track them!',
          'Rainy day, sunny expenses! ☔ Time to log those monsoon bills!',
          'Monsoon vibes! 🌦️ Your budget is getting wet - track your expenses!',
        ],
      },
    };
  }

  // Send fun notification based on time and context
  async sendFunNotification(userEmail, context = 'general') {
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) return;

      // Check if user has already received fun notification today
      const today = moment().format('YYYY-MM-DD');
      const funCheck = await firestore()
        .collection('users')
        .doc(currentUser.uid)
        .collection('reminderLogs')
        .doc(`fun_${today}`)
        .get();

      if (funCheck.exists) {
        return;
      }

      const message = this.getFunMessage(context);
      const notificationData = {
        type: 'fun_notification',
        title: 'Hey there! 👋',
        body: message,
        data: {
          type: 'fun_notification',
          context: context,
          action: 'view_dashboard',
        },
        icon: '😊',
        priority: 'low',
      };

      await this.notificationService.sendNotificationToUsers([userEmail], notificationData);
      
      // Log fun notification sent
      await this.logFunNotificationSent(currentUser.uid, today, context);
    } catch (error) {
      console.error('Failed to send fun notification:', error);
    }
  }

  // Get fun message based on context
  getFunMessage(context) {
    const currentHour = moment().hour();
    const currentDay = moment().day();
    const isWeekend = currentDay === 0 || currentDay === 6;
    
    let messages = [];
    
    switch (context) {
      case 'morning':
        messages = this.funMessages.morning;
        break;
      case 'afternoon':
        messages = this.funMessages.afternoon;
        break;
      case 'evening':
        messages = this.funMessages.evening;
        break;
      case 'weekend':
        messages = this.funMessages.weekend;
        break;
      case 'motivational':
        messages = this.funMessages.motivational;
        break;
      case 'funny':
        messages = this.funMessages.funny;
        break;
      case 'playful':
        messages = this.funMessages.playful;
        break;
      case 'achievement':
        messages = this.funMessages.achievement;
        break;
      case 'seasonal':
        messages = this.getSeasonalMessages();
        break;
      default:
        // Auto-select based on time
        if (isWeekend) {
          messages = this.funMessages.weekend;
        } else if (currentHour < 12) {
          messages = this.funMessages.morning;
        } else if (currentHour < 18) {
          messages = this.funMessages.afternoon;
        } else {
          messages = this.funMessages.evening;
        }
    }
    
    return messages[Math.floor(Math.random() * messages.length)];
  }

  // Get seasonal messages
  getSeasonalMessages() {
    const month = moment().month();
    let season = 'winter';
    
    if (month >= 2 && month <= 4) {
      season = 'summer';
    } else if (month >= 5 && month <= 9) {
      season = 'monsoon';
    }
    
    return this.funMessages.seasonal[season] || this.funMessages.seasonal.winter;
  }

  // Send achievement notification
  async sendAchievementNotification(userEmail, achievementType) {
    try {
      const messages = this.funMessages.achievement;
      const randomMessage = messages[Math.floor(Math.random() * messages.length)];

      const notificationData = {
        type: 'achievement',
        title: 'Achievement Unlocked! 🏆',
        body: randomMessage,
        data: {
          type: 'achievement',
          achievementType: achievementType,
          action: 'view_achievements',
        },
        icon: '🏆',
        priority: 'normal',
      };

      await this.notificationService.sendNotificationToUsers([userEmail], notificationData);
    } catch (error) {
      console.error('Failed to send achievement notification:', error);
    }
  }

  // Send motivational notification
  async sendMotivationalNotification(userEmail) {
    try {
      const messages = this.funMessages.motivational;
      const randomMessage = messages[Math.floor(Math.random() * messages.length)];

      const notificationData = {
        type: 'motivational',
        title: 'You\'re Amazing! 💪',
        body: randomMessage,
        data: {
          type: 'motivational',
          action: 'view_dashboard',
        },
        icon: '💪',
        priority: 'low',
      };

      await this.notificationService.sendNotificationToUsers([userEmail], notificationData);
    } catch (error) {
      console.error('Failed to send motivational notification:', error);
    }
  }

  // Send funny notification
  async sendFunnyNotification(userEmail) {
    try {
      const messages = this.funMessages.funny;
      const randomMessage = messages[Math.floor(Math.random() * messages.length)];

      const notificationData = {
        type: 'funny',
        title: 'LOL! 😂',
        body: randomMessage,
        data: {
          type: 'funny',
          action: 'view_dashboard',
        },
        icon: '😂',
        priority: 'low',
      };

      await this.notificationService.sendNotificationToUsers([userEmail], notificationData);
    } catch (error) {
      console.error('Failed to send funny notification:', error);
    }
  }

  // Send playful notification
  async sendPlayfulNotification(userEmail) {
    try {
      const messages = this.funMessages.playful;
      const randomMessage = messages[Math.floor(Math.random() * messages.length)];

      const notificationData = {
        type: 'playful',
        title: 'Aapka favorite app! 🍕',
        body: randomMessage,
        data: {
          type: 'playful',
          action: 'view_dashboard',
        },
        icon: '🍕',
        priority: 'low',
      };

      await this.notificationService.sendNotificationToUsers([userEmail], notificationData);
    } catch (error) {
      console.error('Failed to send playful notification:', error);
    }
  }

  // Send seasonal notification
  async sendSeasonalNotification(userEmail) {
    try {
      const messages = this.getSeasonalMessages();
      const randomMessage = messages[Math.floor(Math.random() * messages.length)];

      const notificationData = {
        type: 'seasonal',
        title: 'Seasonal Vibes! 🌟',
        body: randomMessage,
        data: {
          type: 'seasonal',
          action: 'view_dashboard',
        },
        icon: '🌟',
        priority: 'low',
      };

      await this.notificationService.sendNotificationToUsers([userEmail], notificationData);
    } catch (error) {
      console.error('Failed to send seasonal notification:', error);
    }
  }

  // Log fun notification sent
  async logFunNotificationSent(userId, date, context) {
    try {
      await firestore()
        .collection('users')
        .doc(userId)
        .collection('reminderLogs')
        .doc(`fun_${date}`)
        .set({
          type: 'fun_notification',
          context: context,
          date: date,
          sentAt: firestore.FieldValue.serverTimestamp(),
        });
    } catch (error) {
      console.error('Failed to log fun notification:', error);
    }
  }

  // Send random fun notification (for testing or random triggers)
  async sendRandomFunNotification(userEmail) {
    try {
      const contexts = ['morning', 'afternoon', 'evening', 'funny', 'playful', 'motivational'];
      const randomContext = contexts[Math.floor(Math.random() * contexts.length)];
      
      await this.sendFunNotification(userEmail, randomContext);
    } catch (error) {
      console.error('Failed to send random fun notification:', error);
    }
  }
}

export default new FunNotificationService();
