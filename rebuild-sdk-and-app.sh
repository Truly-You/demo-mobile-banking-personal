#!/bin/bash

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SDK_PATH="$SCRIPT_DIR/../../sdks/react-native-sdk"
DEMO_PATH="$SCRIPT_DIR"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Rebuild SDK Native Code + Demo App${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Check if SDK path exists
if [ ! -d "$SDK_PATH" ]; then
    echo -e "${RED}Error: SDK not found at $SDK_PATH${NC}"
    exit 1
fi

# Function to rebuild SDK Android native code
rebuild_sdk_android() {
    echo -e "${YELLOW}[SDK Android] Rebuilding native code...${NC}"
    cd "$SDK_PATH/android"
    
    if [ ! -f "./gradlew" ]; then
        echo -e "${YELLOW}[SDK Android] gradlew not found, checking for gradle wrapper...${NC}"
        if command -v gradle >/dev/null 2>&1; then
            gradle wrapper --gradle-version 8.6 --no-daemon || true
            if [ -f "./gradlew" ]; then
                chmod +x ./gradlew
            fi
        fi
    fi
    
    if [ -f "./gradlew" ]; then
        ./gradlew clean build --warning-mode none 2>&1 | grep -E "BUILD|error|FAILED" | tail -20
        BUILD_STATUS=${PIPESTATUS[0]}
    else
        echo -e "${RED}[SDK Android] ✗ gradlew not found${NC}"
        return 1
    fi
    
    if [ $BUILD_STATUS -eq 0 ]; then
        echo -e "${GREEN}[SDK Android] ✓ Native code rebuilt${NC}\n"
        return 0
    else
        echo -e "${RED}[SDK Android] ✗ Build failed${NC}\n"
        return 1
    fi
}

# Function to rebuild SDK iOS native code
rebuild_sdk_ios() {
    echo -e "${YELLOW}[SDK iOS] Rebuilding native code...${NC}"
    cd "$SDK_PATH/ios"
    
    if [ ! -f "Podfile" ]; then
        echo -e "${YELLOW}[SDK iOS] No Podfile found, skipping iOS rebuild${NC}\n"
        return 0
    fi
    
    # Run pod install to rebuild native dependencies
    pod install 2>&1 | grep -E "Installing|Updating|error|warning" | tail -20
    POD_STATUS=${PIPESTATUS[0]}
    
    if [ $POD_STATUS -eq 0 ]; then
        echo -e "${GREEN}[SDK iOS] ✓ Native code rebuilt${NC}\n"
        return 0
    else
        echo -e "${RED}[SDK iOS] ✗ Pod install failed${NC}\n"
        return 1
    fi
}

# Function to rebuild demo app Android
rebuild_app_android() {
    if ! adb devices | grep -q "device$"; then
        echo -e "${YELLOW}[App Android] No device connected, skipping${NC}\n"
        return 0
    fi
    
    echo -e "${YELLOW}[App Android] Rebuilding and installing...${NC}"
    cd "$DEMO_PATH/android"
    
    RN_PORT_VAL=${RN_PORT:-8081}
    set +e  # Temporarily disable exit on error to capture build status
    ./gradlew clean installDebug -PreactNativeDevServerPort="$RN_PORT_VAL" --warning-mode none 2>&1 | tee /tmp/android_app_build.log | grep -E "BUILD|Installing|error|FAILED" | tail -15
    BUILD_STATUS=${PIPESTATUS[0]}
    set -e  # Re-enable exit on error
    
    if [ $BUILD_STATUS -eq 0 ]; then
        echo -e "${GREEN}[App Android] ✓ Installed successfully${NC}\n"
        return 0
    else
        echo -e "${RED}[App Android] ✗ Build failed (exit code: $BUILD_STATUS)${NC}"
        echo -e "${YELLOW}[App Android] Full build log: /tmp/android_app_build.log${NC}\n"
        return 1
    fi
}

# Function to rebuild demo app iOS
rebuild_app_ios() {
    IOS_UDID="00008020-00124D5E2268002E"
    IOS_DEVICE_ID=$(xcrun devicectl list devices 2>/dev/null | grep "connected" | awk '{print $3}')
    
    if [ -z "$IOS_DEVICE_ID" ]; then
        echo -e "${YELLOW}[App iOS] No device connected, skipping${NC}\n"
        return 0
    fi
    
    echo -e "${YELLOW}[App iOS] Rebuilding...${NC}"
    cd "$DEMO_PATH/ios"
    
    set +e  # Temporarily disable exit on error to capture build status
    xcodebuild -workspace NairaBankPersonal.xcworkspace \
               -scheme NairaBankPersonal \
               -configuration Debug \
               -destination "id=$IOS_UDID" \
               -allowProvisioningUpdates clean build 2>&1 | tee /tmp/ios_app_build.log | grep -E "BUILD|error|warning:" | tail -15
    BUILD_STATUS=${PIPESTATUS[0]}
    set -e  # Re-enable exit on error
    
    if [ $BUILD_STATUS -eq 0 ]; then
        echo -e "${GREEN}[App iOS] Build successful${NC}"
        echo -e "${YELLOW}[App iOS] Installing...${NC}"
        APP_PATH=$(find ~/Library/Developer/Xcode/DerivedData/NairaBankPersonal-*/Build/Products/Debug-iphoneos/NairaBankPersonal.app -maxdepth 0 2>/dev/null | head -n 1)
        if [ -n "$APP_PATH" ]; then
            xcrun devicectl device install app --device "$IOS_DEVICE_ID" "$APP_PATH" 2>&1 | grep -E "installed|App" || true
            echo -e "${GREEN}[App iOS] ✓ Installed successfully${NC}\n"
            return 0
        else
            echo -e "${RED}[App iOS] ✗ Could not find built app${NC}\n"
            return 1
        fi
    else
        echo -e "${RED}[App iOS] ✗ Build failed (exit code: $BUILD_STATUS)${NC}"
        echo -e "${YELLOW}[App iOS] Full build log: /tmp/ios_app_build.log${NC}\n"
        return 1
    fi
}

# Main execution
echo -e "${BLUE}Step 1: Rebuilding SDK native code...${NC}\n"

# Rebuild SDK Android
if rebuild_sdk_android; then
    SDK_ANDROID_OK=true
else
    SDK_ANDROID_OK=false
    echo -e "${RED}SDK Android rebuild failed, but continuing...${NC}\n"
fi

# Rebuild SDK iOS
if rebuild_sdk_ios; then
    SDK_IOS_OK=true
else
    SDK_IOS_OK=false
    echo -e "${RED}SDK iOS rebuild failed, but continuing...${NC}\n"
fi

echo -e "${BLUE}Step 2: Rebuilding demo app...${NC}\n"

# Rebuild demo app Android
if rebuild_app_android; then
    APP_ANDROID_OK=true
else
    APP_ANDROID_OK=false
fi

# Rebuild demo app iOS
if rebuild_app_ios; then
    APP_IOS_OK=true
else
    APP_IOS_OK=false
fi

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Build Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "SDK Android: $([ "$SDK_ANDROID_OK" = true ] && echo "${GREEN}✓${NC}" || echo "${RED}✗${NC}")"
echo -e "SDK iOS:     $([ "$SDK_IOS_OK" = true ] && echo "${GREEN}✓${NC}" || echo "${RED}✗${NC}")"
echo -e "App Android: $([ "$APP_ANDROID_OK" = true ] && echo "${GREEN}✓${NC}" || echo "${RED}✗${NC}")"
echo -e "App iOS:     $([ "$APP_IOS_OK" = true ] && echo "${GREEN}✓${NC}" || echo "${RED}✗${NC}")"
echo -e "${BLUE}========================================${NC}\n"

# Exit with error if any critical build failed
if [ "$APP_ANDROID_OK" = false ] && [ "$APP_IOS_OK" = false ]; then
    echo -e "${RED}All app builds failed!${NC}"
    exit 1
fi

echo -e "${GREEN}=== Complete ===${NC}"



