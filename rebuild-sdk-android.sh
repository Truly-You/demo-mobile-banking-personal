#!/bin/bash

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SDK_PATH="$SCRIPT_DIR/../../sdks/react-native-sdk"

echo -e "${BLUE}Rebuilding SDK Android + Demo App${NC}\n"

# Rebuild SDK Android (using app's gradlew or system gradle)
echo -e "${YELLOW}[SDK] Rebuilding Android native code...${NC}"
cd "$SDK_PATH/android"

# Try app's gradlew first, then system gradle
if [ -f "$SCRIPT_DIR/android/gradlew" ]; then
    "$SCRIPT_DIR/android/gradlew" -p . clean build --warning-mode none 2>&1 | grep -E "BUILD|error|FAILED" | tail -10
    BUILD_STATUS=${PIPESTATUS[0]}
elif command -v gradle >/dev/null 2>&1; then
    gradle clean build --warning-mode none 2>&1 | grep -E "BUILD|error|FAILED" | tail -10
    BUILD_STATUS=${PIPESTATUS[0]}
else
    echo -e "${YELLOW}[SDK] No gradle found, will rebuild via app build${NC}\n"
    BUILD_STATUS=0
fi

if [ $BUILD_STATUS -eq 0 ]; then
    echo -e "${GREEN}[SDK] ✓ Rebuilt${NC}\n"
else
    echo -e "${YELLOW}[SDK] Direct build failed, will rebuild via app${NC}\n"
fi

# Rebuild demo app Android
if adb devices | grep -q "device$"; then
    echo -e "${YELLOW}[App] Rebuilding and installing...${NC}"
    cd "$SCRIPT_DIR/android"
    RN_PORT_VAL=${RN_PORT:-8081}
    ./gradlew clean installDebug -PreactNativeDevServerPort="$RN_PORT_VAL" --warning-mode none 2>&1 | grep -E "BUILD|Installing|error|FAILED" | tail -10
    if [ ${PIPESTATUS[0]} -eq 0 ]; then
        echo -e "${GREEN}[App] ✓ Installed${NC}\n"
    else
        echo -e "${RED}[App] ✗ Failed${NC}\n"
        exit 1
    fi
else
    echo -e "${YELLOW}[App] No Android device connected${NC}\n"
fi

echo -e "${GREEN}Done!${NC}"

