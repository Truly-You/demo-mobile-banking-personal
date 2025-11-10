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
    xcodebuild -workspace NairaBankPersonal.xcworkspace \
               -scheme NairaBankPersonal \
               -configuration Debug \
               -destination "id=$IOS_UDID" \
               -allowProvisioningUpdates 2>&1 | grep -E "BUILD" | tail -3
    
    echo -e "${GREEN}[iOS] Installing...${NC}"
    cd ..
    xcrun devicectl device install app --device "$IOS_DEVICE_ID" \
        /Users/roryspies/Library/Developer/Xcode/DerivedData/NairaBankPersonal-bzkizebvyqvjceccafnyxfkezzyc/Build/Products/Debug-iphoneos/NairaBankPersonal.app 2>&1 | grep -E "installed|App"
    echo -e "${GREEN}[iOS] ✓ Done${NC}\n"
fi

# Android
if adb devices | grep -q "device$"; then
    echo -e "${YELLOW}[Android] Building...${NC}"
    cd android
    ./gradlew assembleRelease --warning-mode none 2>&1 | grep -E "BUILD" | tail -3
    
    echo -e "${GREEN}[Android] Installing...${NC}"
    cd ..
    adb install -r android/app/build/outputs/apk/release/app-release.apk
    echo -e "${GREEN}[Android] ✓ Done${NC}\n"
fi

echo -e "${GREEN}=== Complete ===${NC}"


