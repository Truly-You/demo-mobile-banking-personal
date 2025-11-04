#!/bin/bash

# Setup script for Android development

echo "Setting up Hello World React Native app for Android..."

# Check if debug keystore exists
if [ ! -f "android/app/debug.keystore" ]; then
    echo "Creating debug keystore..."
    cd android/app
    keytool -genkeypair -v -storetype PKCS12 \
        -keystore debug.keystore \
        -storepass android \
        -alias androiddebugkey \
        -keypass android \
        -keyalg RSA \
        -keysize 2048 \
        -validity 10000 \
        -dname "CN=Android Debug,O=Android,C=US"
    cd ../..
    echo "✓ Debug keystore created"
else
    echo "✓ Debug keystore already exists"
fi

# Check ADB
echo ""
echo "Checking ADB connection..."
if command -v adb &> /dev/null; then
    DEVICES=$(adb devices | grep -v "List" | grep "device" | wc -l)
    if [ "$DEVICES" -gt 0 ]; then
        echo "✓ Android device(s) connected:"
        adb devices | grep "device"
    else
        echo "⚠ No Android devices detected"
        echo "  Please connect your device and enable USB debugging"
    fi
else
    echo "⚠ ADB not found in PATH"
    echo "  Make sure Android SDK platform-tools is in your PATH"
fi

echo ""
echo "Setup complete! To run the app:"
echo "  1. npm install"
echo "  2. npm start (in one terminal)"
echo "  3. npm run android (in another terminal)"

