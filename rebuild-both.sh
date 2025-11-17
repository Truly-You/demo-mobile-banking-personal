#!/bin/bash

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Quick rebuild and install${NC}\n"

# iOS
IOS_UDID="00008020-00124D5E2268002E"
IOS_DEVICE_ID=$(xcrun devicectl list devices 2>/dev/null | grep "connected" | awk '{print $3}')

if [ -n "$IOS_DEVICE_ID" ]; then
    echo -e "${YELLOW}[iOS] Building...${NC}"
    cd ios
    set +e  # Temporarily disable exit on error to capture build status
    xcodebuild -workspace NairaBankPersonal.xcworkspace \
               -scheme NairaBankPersonal \
               -configuration Debug \
               -destination "id=$IOS_UDID" \
               -allowProvisioningUpdates 2>&1 | tee /tmp/ios_build.log | grep -E "BUILD|error|warning:" | tail -10
    BUILD_STATUS=${PIPESTATUS[0]}
    set -e  # Re-enable exit on error
    cd ..
    
    if [ $BUILD_STATUS -ne 0 ]; then
        echo -e "${RED}[iOS] ✗ Build failed (exit code: $BUILD_STATUS)${NC}"
        echo -e "${YELLOW}[iOS] Full build log: /tmp/ios_build.log${NC}\n"
        exit 1
    fi
    
    echo -e "${GREEN}[iOS] Build successful${NC}"
    echo -e "${YELLOW}[iOS] Installing...${NC}"
    # Find the built app dynamically
    APP_PATH=$(find ~/Library/Developer/Xcode/DerivedData/NairaBankPersonal-*/Build/Products/Debug-iphoneos/NairaBankPersonal.app -maxdepth 0 2>/dev/null | head -n 1)
    if [ -n "$APP_PATH" ]; then
        xcrun devicectl device install app --device "$IOS_DEVICE_ID" "$APP_PATH" 2>&1 | grep -E "installed|App"
        echo -e "${GREEN}[iOS] ✓ Done${NC}\n"
    else
        echo -e "${RED}[iOS] ✗ Could not find built app${NC}\n"
        exit 1
    fi
fi

# Android
if adb devices | grep -q "device$"; then
    echo -e "${YELLOW}[Android] Building and installing...${NC}"
    cd android
    RN_PORT_VAL=${RN_PORT:-8081}
    set +e  # Temporarily disable exit on error to capture build status
    ./gradlew installDebug -PreactNativeDevServerPort="$RN_PORT_VAL" --warning-mode none 2>&1 | tee /tmp/android_build.log | grep -E "BUILD|Installing|error|FAILED" | tail -10
    BUILD_STATUS=${PIPESTATUS[0]}
    set -e  # Re-enable exit on error
    cd ..
    
    if [ $BUILD_STATUS -ne 0 ]; then
        echo -e "${RED}[Android] ✗ Build failed (exit code: $BUILD_STATUS)${NC}"
        echo -e "${YELLOW}[Android] Full build log: /tmp/android_build.log${NC}\n"
        exit 1
    fi
    
    echo -e "${GREEN}[Android] ✓ Done${NC}\n"
fi

echo -e "${GREEN}=== Complete ===${NC}"


