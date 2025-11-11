#!/bin/bash

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Building and installing Naira Bank app on all platforms...${NC}\n"

# iOS Bundle ID and UDID (for xcodebuild)
IOS_UDID="00008020-00124D5E2268002E"  # Used for xcodebuild
IOS_BUNDLE_ID="com.nairabankmobile.company"

# Android Package Name
ANDROID_PACKAGE_NAME="com.nairabankmobile"

# Check for connected devices
echo "Checking for connected devices..."
IOS_CONNECTED=$(xcrun devicectl list devices 2>/dev/null | grep -c "connected" || echo "0")
ANDROID_CONNECTED=$(adb devices | grep -c "device$" || echo "0")

# Get the actual iOS device ID from devicectl for installation
if [ "$IOS_CONNECTED" -gt "0" ]; then
    IOS_DEVICE_ID=$(xcrun devicectl list devices 2>/dev/null | grep "connected" | awk '{print $3}')
    echo "Detected iOS device ID: $IOS_DEVICE_ID"
fi

if [ "$IOS_CONNECTED" = "0" ] && [ "$ANDROID_CONNECTED" = "0" ]; then
    echo -e "${RED}Error: No devices connected${NC}"
    exit 1
fi

echo -e "iOS device: $([ "$IOS_CONNECTED" -gt "0" ] && echo "${GREEN}Connected${NC}" || echo "${RED}Not connected${NC}")"
echo -e "Android device: $([ "$ANDROID_CONNECTED" -gt "0" ] && echo "${GREEN}Connected${NC}" || echo "${RED}Not connected${NC}")\n"

# Function to uninstall iOS app
uninstall_ios() {
    if [ "$IOS_CONNECTED" -gt "0" ]; then
        echo -e "${YELLOW}[iOS] Uninstalling old app...${NC}"
        xcrun devicectl device uninstall app --device "$IOS_DEVICE_ID" "$IOS_BUNDLE_ID" 2>&1 | grep -v "Error: The app is not installed" || true
        echo -e "${GREEN}[iOS] Old app removed${NC}\n"
    fi
}

# Function to uninstall Android app
uninstall_android() {
    if [ "$ANDROID_CONNECTED" -gt "0" ]; then
        echo -e "${YELLOW}[Android] Uninstalling old app...${NC}"
        adb uninstall "$ANDROID_PACKAGE_NAME" 2>&1 | grep -v "Failure" || true
        echo -e "${GREEN}[Android] Old app removed${NC}\n"
    fi
}

# Function to build and install iOS
build_ios() {
    if [ "$IOS_CONNECTED" -gt "0" ]; then
        echo -e "${YELLOW}[iOS] Building...${NC}"
        cd ios
        # Note: xcodebuild uses UDID format, devicectl uses UUID format
        xcodebuild -workspace NairaBankPersonal.xcworkspace \
                   -scheme NairaBankPersonal \
                   -configuration Debug \
                   -destination "id=$IOS_UDID" \
                   -allowProvisioningUpdates \
                   clean build 2>&1 | grep -E "(BUILD|error|warning:.*)" | tail -20
        
        if [ ${PIPESTATUS[0]} -eq 0 ]; then
            echo -e "${GREEN}[iOS] Build successful${NC}"
            echo -e "${YELLOW}[iOS] Installing...${NC}"
            # Find the built app dynamically
            APP_PATH=$(find ~/Library/Developer/Xcode/DerivedData/NairaBankPersonal-*/Build/Products/Debug-iphoneos/NairaBankPersonal.app -maxdepth 0 2>/dev/null | head -n 1)
            if [ -n "$APP_PATH" ]; then
                xcrun devicectl device install app --device "$IOS_DEVICE_ID" "$APP_PATH"
                echo -e "${GREEN}[iOS] ✓ Installed successfully${NC}\n"
            else
                echo -e "${RED}[iOS] ✗ Could not find built app${NC}\n"
                return 1
            fi
        else
            echo -e "${RED}[iOS] Build failed${NC}\n"
            return 1
        fi
        cd ..
    else
        echo -e "${YELLOW}[iOS] Skipping (device not connected)${NC}\n"
    fi
}

# Function to build and install Android
build_android() {
    if [ "$ANDROID_CONNECTED" -gt "0" ]; then
        echo -e "${YELLOW}[Android] Building...${NC}"
        cd android
        ./gradlew assembleRelease --warning-mode none 2>&1 | grep -E "(BUILD|Task :app)" | tail -10
        
        if [ ${PIPESTATUS[0]} -eq 0 ]; then
            echo -e "${GREEN}[Android] Build successful${NC}"
            echo -e "${YELLOW}[Android] Installing...${NC}"
            cd ..
            adb install -r android/app/build/outputs/apk/release/app-release.apk
            echo -e "${GREEN}[Android] ✓ Installed successfully${NC}\n"
        else
            echo -e "${RED}[Android] Build failed${NC}\n"
            cd ..
            return 1
        fi
    else
        echo -e "${YELLOW}[Android] Skipping (device not connected)${NC}\n"
    fi
}

# Uninstall old apps first
echo -e "${YELLOW}=== Step 1: Uninstalling old apps ===${NC}\n"
uninstall_ios
uninstall_android

# Build both platforms in parallel (comment out to build sequentially)
# build_ios &
# IOS_PID=$!
# build_android &
# ANDROID_PID=$!
# wait $IOS_PID
# wait $ANDROID_PID

# Or build sequentially (safer):
echo -e "${YELLOW}=== Step 2: Building and installing ===${NC}\n"
build_ios
build_android

echo -e "${GREEN}=== All builds and installations complete ===${NC}"

