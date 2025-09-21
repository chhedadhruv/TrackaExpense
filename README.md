# TrackaExpense

TrackaExpense is a comprehensive, ad-free personal finance app built using **React Native** and **Firebase**. The app helps you manage your expenses, track income, set savings goals, and split bills with an intuitive, easy-to-use interface.

## Features
- **Home Screen**: Displays your Total Expenses, Total Income, and a list of Recent Transactions for easy tracking.
- **Statistics**: View graphs of your expenses and income for any selected period to analyze your financial patterns.
- **Transactions**: Add new expenses or income quickly with a simple input form.
- **Savings Goals**: Set and track progress toward your savings goals using a progress bar.
- **Bill Splitting**: Split bills between friends equally or by percentage to simplify group expenses.
- **Profile**: Manage your profile, provide feedback, view the privacy policy, and log out securely.

## Installation

To run this project locally:

### 1. Clone the repository:
```bash
git clone https://github.com/chhedadhruv/TrackaExpense.git
```

### 2. Navigate to the project directory:
```bash
cd TrackaExpense
```

### 3. Install dependencies:
```bash
npm install
```

### 4. Start the development server:
```bash
npm start
```

### 5. Open the React Native CLI on Android Emulator:
```bash
npm run android
```

## Technologies Used
- **React Native**: A JavaScript framework for building native mobile applications.
- **Firebase**: A platform developed by Google for creating mobile and web applications.
- **React Navigation**: A library for routing and navigation in React Native.
- **React Native Paper**: A cross-platform material design library for React Native.
- **React Native Vector Icons**: A library for using custom icons in React Native.
- **React Native Chart Kit**: A library for creating customizable charts in React Native.

## APK Download
You can download the APK for the app from the following link: [TrackaExpense APK](https://trackaexpense.dhruvchheda.com)

## License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgements
- [React Native](https://reactnative.dev/)
- [Firebase](https://firebase.google.com/)
- [React Navigation](https://reactnavigation.org/)
- [React Native Paper](https://callstack.github.io/react-native-paper/)

## Contact
- **Dhruv Chheda**: [dhruvchheda.com](https://dhruvchheda.com)
- **Email**: me@dhruvchheda.com

## Environment Setup

### 1. Environment Variables

Copy the example environment file and configure your variables:

```bash
cp .env.example .env
```

Edit `.env` file with your actual values:

```env
# Google Sign-In Configuration
GOOGLE_WEB_CLIENT_ID=your-actual-web-client-id.apps.googleusercontent.com
```

### 2. Getting Google Web Client ID

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to "APIs & Services" > "Credentials"
4. Find your "Web application" client (not Android/iOS client)
5. Copy the Client ID and paste it in your `.env` file

### 3. Firebase Configuration

Make sure your `google-services.json` (Android) and `GoogleService-Info.plist` (iOS) files are properly configured with your SHA-1 fingerprints.

