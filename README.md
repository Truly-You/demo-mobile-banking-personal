# Hello World React Native App

A simple React Native "Hello World" application that runs on Android devices connected via ADB.

## Prerequisites

1. **Node.js** (v18 or higher)
2. **React Native CLI** (install globally: `npm install -g react-native-cli`)
3. **Android Studio** with Android SDK
4. **Java Development Kit (JDK)** - version 17 or 11
5. **ADB** (Android Debug Bridge) - typically comes with Android SDK

## Setup Instructions

### 1. Install Dependencies

```bash
cd hello-world-rn
npm install
```

### 2. Generate Debug Keystore (if needed)

The debug keystore is needed for signing the app. If it doesn't exist, create it:

```bash
cd android/app
keytool -genkeypair -v -storetype PKCS12 -keystore debug.keystore -storepass android -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Android Debug,O=Android,C=US"
cd ../..
```

### 3. Connect Android Device via ADB

Make sure your Android device is connected and ADB can see it:

```bash
adb devices
```

You should see your device listed. If not:
- Enable **Developer Options** on your Android device
- Enable **USB Debugging**
- Accept the USB debugging authorization prompt on your device

### 4. Run the App

#### Option 1: Using npm scripts (recommended)

```bash
# Start Metro bundler
npm start

# In another terminal, build and install on device
npm run android
```

#### Option 2: Using React Native CLI directly

```bash
# Start Metro bundler
npx react-native start

# In another terminal, run on Android
npx react-native run-android
```

#### Option 3: Manual build and install

```bash
# Build the APK
cd android
./gradlew assembleDebug

# Install via ADB
adb install app/build/outputs/apk/debug/app-debug.apk

# Or install and launch
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.helloworldrn/.MainActivity
```

## Troubleshooting

### ADB not detecting device
- Ensure USB debugging is enabled
- Try different USB cable/port
- Run `adb kill-server && adb start-server`

### Build errors
- Ensure Android SDK is properly configured
- Check that `ANDROID_HOME` environment variable is set
- Try `cd android && ./gradlew clean`

### Metro bundler issues
- Clear cache: `npm start -- --reset-cache`
- Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`

## Project Structure

```
hello-world-rn/
├── App.tsx              # Main React component
├── index.js             # Entry point
├── android/             # Android native code
│   └── app/
│       └── src/
│           └── main/
│               ├── java/com/helloworldrn/
│               └── res/
└── package.json
```

## Development

The app will hot-reload when you make changes to `App.tsx` or other JavaScript/TypeScript files. Just save your changes and the app will update automatically on your connected device.

