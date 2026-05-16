# qbitUI Mobile

React Native (Expo) mobile app for qbitUI — control your qBittorrent instance from iOS or Android.

## Development

### Prerequisites

- Node.js 20+
- Expo CLI: `npm install -g expo-cli`
- For iOS: Xcode 15+ on macOS
- For Android: Android Studio with SDK 34

### Install

```bash
cd packages/mobile
npm install
```

### Run

```bash
npm start          # Expo dev server
npm run android    # Run on Android
npm run ios        # Run on iOS
```

## Building

### Android (APK + AAB)

```bash
npm run prebuild -- --platform android
cd android
./gradlew assembleRelease   # APK
./gradlew bundleRelease     # AAB
```

### iOS (IPA)

```bash
npm run prebuild -- --platform ios
cd ios
xcodebuild -workspace qbitui.xcworkspace -scheme qbitui -configuration Release -archivePath build/qbitui.xcarchive archive
xcodebuild -exportArchive -archivePath build/qbitui.xcarchive -exportOptionsPlist exportOptions.plist -exportPath build/
```

## Signing

- Android: Place `keystore.jks` in `android/app/` and configure `android/gradle.properties`
- iOS: Configure signing in Xcode or via `exportOptions.plist`
