<div align="center">
  <img src="frontend/src/assets/images/vetrolog-full.png" alt="VetroLog Banner" width="700" />
  
  <p><strong>High-Performance Desktop Database Inspector for Mobile Apps (Flutter, Android, iOS, React Native)</strong></p>
  
  <p>
    <img src="https://img.shields.io/badge/Go-1.26-00ADD8?logo=go" alt="Go" />
    <img src="https://img.shields.io/badge/Wails-v2-DF1A29?logo=wails" alt="Wails" />
    <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" alt="React" />
    <img src="https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript" alt="TypeScript" />
    <img src="https://img.shields.io/badge/SQLite-Pure--Go-003B57?logo=sqlite" alt="SQLite" />
  </p>
</div>

---

## 🌟 Overview

**VetroLog** is a modern, cross-platform desktop application designed to inspect, query, and edit mobile local databases (SQLite, Hive, SharedPreferences) in real time.

- **Zero-Code ADB Native Bridge**: Inspect SQLite databases (`.db`) and SharedPreferences directly from physical Android devices and emulators over ADB without writing a single line of client code in your Flutter or Android project.
- **WebSocket Live Stream Mode**: Real-time mutation streaming for Flutter, Kotlin, Swift, and React Native apps.
- **Pure-Go SQLite Engine**: Query, filter, and edit records with automatic write-back sync to the phone sandbox.
- **Dark Glassmorphic UI**: High-contrast, sortable, paginated DataGrid with SQL Query Editor and Mutation Console.

---

## 🚀 Quick Start

### 1. Run Development Server

```bash
# Start Wails desktop app in dev mode
wails dev
```

### 2. Inspect Over ADB (Zero Code Required)

1. Connect your Android device via USB (with **USB Debugging** enabled).
2. Run your Flutter app in debug mode (`flutter run`).
3. In VetroLog's top header, select your device and app package from the **ADB dropdown**.
4. All SQLite databases (`databases/`, `app_flutter/`) and SharedPreferences load automatically!

---

## 📱 Mobile Client SDKs (Optional WebSocket Streaming)

If you wish to stream live in-memory mutations over WebSockets, lightweight client helpers are provided in `clients/`:

- [Flutter Client](clients/flutter/)
- [Android Kotlin Client](clients/android-kotlin/)
- [iOS Swift Client](clients/ios-swift/)
- [React Native Client](clients/react-native/)
