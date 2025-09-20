# Google Sign-In Setup Guide

## Prerequisites
- Google Cloud Console project
- Firebase project configured
- Android/iOS app registered

## Configuration Steps

### 1. Get Web Client ID
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to "APIs & Services" > "Credentials"
4. Find your Web application client ID (not Android/iOS client ID)
5. Copy the Web Client ID

### 2. Update LoginScreen.js
Replace `YOUR_WEB_CLIENT_ID` in `screens/LoginScreen.js` with your actual Web Client ID:

```javascript
GoogleSignin.configure({
  webClientId: 'your-actual-web-client-id.apps.googleusercontent.com',
});
```

### 3. Android Configuration
Add to `android/app/build.gradle`:
```gradle
dependencies {
    implementation 'com.google.android.gms:play-services-auth:20.7.0'
}
```

### 4. iOS Configuration
Add to `ios/Podfile`:
```ruby
pod 'GoogleSignIn'
```

Then run:
```bash
cd ios && pod install
```

### 5. Platform-specific Setup

#### Android
1. Add SHA-1 fingerprint to Firebase Console
2. Download `google-services.json` and place in `android/app/`
3. Ensure the package name matches your app

#### iOS
1. Add SHA-1 fingerprint to Firebase Console
2. Download `GoogleService-Info.plist` and add to Xcode project
3. Ensure the bundle ID matches your app

## Testing
1. Run the app on a physical device (Google Sign-In doesn't work on simulators)
2. Test the "Sign in with Google" button
3. Verify user data is created in Firestore

## Troubleshooting
- Ensure you're using the Web Client ID, not Android/iOS client ID
- Check that SHA-1 fingerprints are correctly added
- Verify package name/bundle ID matches Firebase configuration
- Test on physical device, not simulator
