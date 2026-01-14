# Health Tracker - Quick Start Guide

## 🎯 Choose Your Path

### Path 1: Test in Simulator (Fastest)
```bash
npm install
cd ios && pod install && cd ..
npm run ios
```
**Time**: 5 minutes  
**Result**: App running in iOS Simulator

---

### Path 2: Install on Your iPhone (Recommended)
```bash
# 1. Connect iPhone via USB
# 2. Open Xcode
cd ios && open HealthTracker.xcworkspace

# 3. In Xcode:
#    - Select your iPhone from device dropdown
#    - Click Play button (▶️)
#    - Wait for build to complete
#    - Trust developer on iPhone (Settings → General → Device Management)
```
**Time**: 10 minutes (first time)  
**Result**: App installed on your physical iPhone

📖 **Full guide**: [INSTALL_ON_IPHONE.md](./INSTALL_ON_IPHONE.md)

---

### Path 3: Build IPA for Sharing
```bash
npm run build:ios
# IPA created at: ios/build/HealthTracker.ipa
# Upload to https://www.diawi.com/ to share
```
**Time**: 15 minutes  
**Result**: IPA file you can share with others

📖 **Full guide**: [IOS_DISTRIBUTION_GUIDE.md](./IOS_DISTRIBUTION_GUIDE.md)

---

## 📚 Documentation Index

| Document | Purpose |
|----------|---------|
| **[INSTALL_ON_IPHONE.md](./INSTALL_ON_IPHONE.md)** | ⭐ Complete guide to install on physical iPhone |
| **[IOS_DISTRIBUTION_GUIDE.md](./IOS_DISTRIBUTION_GUIDE.md)** | All distribution methods (TestFlight, ad-hoc, etc.) |
| **[DISTRIBUTION_SUMMARY.md](./DISTRIBUTION_SUMMARY.md)** | Quick overview of all options |
| **[QUICK_INSTALL_GUIDE.md](./QUICK_INSTALL_GUIDE.md)** | 5-minute installation guide |
| **[README.md](./README.md)** | Project overview and setup |
| **[ARCHITECTURE.md](./ARCHITECTURE.md)** | Technical architecture details |

---

## 🔧 Common Commands

```bash
# Install dependencies
npm install
cd ios && pod install && cd ..

# Run on iOS Simulator
npm run ios

# Run tests
npm test

# Build IPA file
npm run build:ios

# Start Metro bundler
npm start

# Type checking
npm run type-check

# Linting
npm run lint
```

---

## ⚡ Troubleshooting Quick Fixes

### "No provisioning profile found"
```bash
# Sign in to Xcode with your Apple ID:
# Xcode → Preferences → Accounts → Add Apple ID
```

### "Bundle identifier already in use"
```bash
# In Xcode: Change Bundle Identifier to:
# com.yourname.healthtracker
```

### "Unable to install app"
```bash
# Delete app from iPhone and try again
```

### "CocoaPods errors"
```bash
cd ios
pod deintegrate
pod install
cd ..
```

### "Metro bundler issues"
```bash
npx react-native start --reset-cache
```

---

## 📱 What You'll Get

After installation, the Health Tracker app includes:

- ✅ **Dashboard** with daily/weekly statistics
- ✅ **Exercise Logging** with validation
- ✅ **Exercise History** with edit/delete
- ✅ **Recommendations** based on your activity
- ✅ **Quick Actions** for common tasks
- ✅ **Offline Mode** - works without internet
- ✅ **Data Persistence** - all data saved locally
- ✅ **Accessibility** - full screen reader support

---

## 🎯 Next Steps

1. **Choose your path** above
2. **Follow the guide** for your chosen method
3. **Start tracking** your fitness journey!

---

## 🆘 Need Help?

- **Installation issues**: See [INSTALL_ON_IPHONE.md](./INSTALL_ON_IPHONE.md) troubleshooting section
- **Distribution questions**: See [IOS_DISTRIBUTION_GUIDE.md](./IOS_DISTRIBUTION_GUIDE.md)
- **Technical details**: See [ARCHITECTURE.md](./ARCHITECTURE.md)

---

**Ready to start?** Pick a path above and follow the instructions! 🚀
