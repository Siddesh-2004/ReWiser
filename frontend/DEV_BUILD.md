# Testing voice answers (Expo Go can't do it)

`expo-speech-recognition` is native code, and Expo Go only ships a fixed set of native modules.
Use a development build instead. It is your own copy of Expo Go that includes this module.
Your JS code and hot reload work exactly the same.

## Option A: cloud build (no Android Studio needed)
```bash
npm install
npx expo install expo-dev-client
npm i -g eas-cli
eas login
eas build --profile development --platform android   # ~10-15 min, gives a QR/link to an APK
```
Install the APK on your phone, then:
```bash
npm run dev          # = expo start --dev-client
```
Open the installed "Voice Revision" app and connect to the dev server.

## Option B: local build (needs Android Studio + USB debugging)
```bash
npm install
npx expo install expo-dev-client
npx expo run:android
```

## Notes
- Phone and PC must be on the same Wi-Fi (EXPO_PUBLIC_API_URL in .env points at your PC's LAN IP).
- Speech recognition on Android uses the Google app; make sure it is installed and the mic permission is allowed.
- iOS needs a paid Apple developer account for device builds; the simulator works with `npx expo run:ios` on a Mac.
- Until then, Expo Go still works for everything else; the answer screen falls back to typing
  (you can also tap the keyboard's mic icon to dictate).
