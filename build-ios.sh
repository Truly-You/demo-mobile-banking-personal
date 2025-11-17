#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo -e "${YELLOW}Building iOS app...${NC}\n"

cd ios

# iOS Bundle ID and UDID (for xcodebuild)
IOS_UDID="00008020-00124D5E2268002E"

echo -e "${YELLOW}Running xcodebuild...${NC}\n"

# Build with full output (no filtering)
xcodebuild -workspace NairaBankPersonal.xcworkspace \
           -scheme NairaBankPersonal \
           -configuration Debug \
           -destination "id=$IOS_UDID" \
           -allowProvisioningUpdates \
           clean build

if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}✓ Build successful${NC}"
    echo -e "${YELLOW}App location:${NC}"
    find ~/Library/Developer/Xcode/DerivedData/NairaBankPersonal-*/Build/Products/Debug-iphoneos/NairaBankPersonal.app -maxdepth 0 2>/dev/null | head -n 1
else
    echo -e "\n${RED}✗ Build failed${NC}"
    exit 1
fi

