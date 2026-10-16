# VetroLog React Native Client

Connect your React Native app (Expo or Bare React Native) to the **VetroLog Desktop Inspector** over Wi-Fi or USB.

---

## 1. Zero External Dependencies

VetroLog uses the global `WebSocket` API provided out-of-the-box by React Native.

---

## 2. Copy Client File

Copy `VetroLog.ts` into your app's `src/` or `lib/` directory.

---

## 3. Initialize in `App.tsx` or `index.js`

### Option A: USB (Recommended for stability)
Forward port 9222 via ADB on your Mac terminal:
```bash
adb reverse tcp:9222 tcp:9222
```

In your app:
```typescript
import { VetroLog } from './lib/VetroLog';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Initialize connection
VetroLog.init({ host: 'localhost', port: 9222 });

// Automatically register AsyncStorage for real-time inspection
VetroLog.getInstance().registerAsyncStorage(AsyncStorage);
```

### Option B: Local Wi-Fi (Wireless)
Replace `192.168.0.x` with the IP shown in the VetroLog Desktop **"Connect App"** modal:
```typescript
VetroLog.init({ host: '192.168.0.17', port: 9222 });
```

---

## 4. Notify Real-Time SQLite or State Mutations

```typescript
// Call this whenever an item is added, updated, or deleted
VetroLog.getInstance().notifyMutation({
  databaseId: 'sqlite.db',
  tableName: 'cart_items',
  type: 'INSERT',
  query: 'INSERT INTO cart_items (id, title) VALUES (1, "Keyboard")',
  newValues: { id: 1, title: 'Keyboard' },
});
```
