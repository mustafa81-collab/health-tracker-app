#!/bin/bash

# Health Tracker iOS Build Script
# This script builds an IPA file for distribution

set -e

echo "🏗️  Building Health Tracker iOS App..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SCHEME="HealthTracker"
WORKSPACE="HealthTracker.xcworkspace"
CONFIGURATION="Release"
ARCHIVE_PATH="./build/HealthTracker.xcarchive"
EXPORT_PATH="./build/HealthTracker-IPA"
IPA_NAME="HealthTracker.ipa"

# Check if we're in the ios directory
if [ ! -f "$WORKSPACE" ]; then
    echo -e "${RED}❌ Error: Must run this script from the ios/ directory${NC}"
    echo "Run: cd ios && ./build-ipa.sh"
    exit 1
fi

# Check if Xcode is installed
if ! command -v xcodebuild &> /dev/null; then
    echo -e "${RED}❌ Error: Xcode is not installed${NC}"
    exit 1
fi

# Clean previous builds
echo -e "${YELLOW}🧹 Cleaning previous builds...${NC}"
rm -rf build/
mkdir -p build

# Install pods
echo -e "${YELLOW}📦 Installing CocoaPods dependencies...${NC}"
pod install

# Archive the app
echo -e "${YELLOW}📦 Archiving the app...${NC}"
xcodebuild archive \
    -workspace "$WORKSPACE" \
    -scheme "$SCHEME" \
    -configuration "$CONFIGURATION" \
    -archivePath "$ARCHIVE_PATH" \
    -allowProvisioningUpdates \
    CODE_SIGN_IDENTITY="" \
    CODE_SIGNING_REQUIRED=NO \
    CODE_SIGNING_ALLOWED=NO

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Archive failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Archive created successfully${NC}"

# Create export options plist for development
cat > build/ExportOptions.plist << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>development</string>
    <key>compileBitcode</key>
    <false/>
    <key>signingStyle</key>
    <string>automatic</string>
    <key>stripSwiftSymbols</key>
    <true/>
    <key>teamID</key>
    <string></string>
</dict>
</plist>
EOF

# Export IPA
echo -e "${YELLOW}📤 Exporting IPA...${NC}"
xcodebuild -exportArchive \
    -archivePath "$ARCHIVE_PATH" \
    -exportPath "$EXPORT_PATH" \
    -exportOptionsPlist build/ExportOptions.plist \
    -allowProvisioningUpdates

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Export failed${NC}"
    echo ""
    echo -e "${YELLOW}Note: To create a distributable IPA, you need:${NC}"
    echo "  1. An Apple Developer account"
    echo "  2. A valid provisioning profile"
    echo "  3. A signing certificate"
    echo ""
    echo "For testing without these, use the simulator or connect your device via Xcode."
    exit 1
fi

# Move and rename IPA
if [ -f "$EXPORT_PATH/$SCHEME.ipa" ]; then
    mv "$EXPORT_PATH/$SCHEME.ipa" "build/$IPA_NAME"
    echo -e "${GREEN}✅ IPA created successfully!${NC}"
    echo ""
    echo -e "${GREEN}📱 Your IPA is ready at: ios/build/$IPA_NAME${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. For TestFlight: Upload to App Store Connect"
    echo "  2. For Ad-hoc: Share the IPA file directly"
    echo "  3. For Development: Install via Xcode or Apple Configurator"
else
    echo -e "${RED}❌ IPA file not found after export${NC}"
    exit 1
fi
