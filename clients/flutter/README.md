# VetroLog Flutter Client SDK

Connect your Flutter mobile application to **VetroLog** desktop for real-time SQLite, Hive, and SharedPreferences inspection, live mutation logging, and ad-hoc query execution.

---

## 🚀 Quick Setup

### 1. Add dependency to `pubspec.yaml`

```yaml
dependencies:
  vetrolog_client:
    path: path/to/vetrolog/clients/flutter
  # or when published: vetrolog_client: ^1.0.0
```

### 2. Initialize in `main.dart`

```dart
import 'package:flutter/material.dart';
import 'package:vetrolog_client/vetrolog_client.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  // Connect to your desktop machine (use 10.0.2.2 for Android emulator or your Mac's LAN IP for physical device)
  VetroLog.init(
    host: 'localhost', // or '10.0.2.2' for Android emulator
    port: 9222,
    appName: 'MyFlutterApp',
  );

  runApp(const MyApp());
}
```

> **Tip for Android USB Devices:** Run `adb reverse tcp:9222 tcp:9222` in your terminal to forward the port directly over your USB cable with zero network configuration!

---

## 🗄️ Registering Databases

### SQLite (`sqflite`)

```dart
VetroLog.instance.registerDatabase(
  id: 'app_sqlite',
  name: 'app_database.db',
  type: 'sqlite',
  path: dbPath,
  tables: [
    {
      'name': 'users',
      'rowCount': 120,
      'columns': [
        {'name': 'id', 'type': 'INTEGER', 'isPrimaryKey': true},
        {'name': 'name', 'type': 'TEXT'},
        {'name': 'email', 'type': 'TEXT'},
      ],
    },
  ],
  onFetchTableData: (table, page, size) async {
    return await db.query(table, limit: size, offset: (page - 1) * size);
  },
  onExecuteQuery: (query) async {
    return await db.rawQuery(query);
  },
  onUpdateRow: (table, pk, newValues) async {
    final pkKey = pk.keys.first;
    await db.update(table, newValues, where: '$pkKey = ?', whereArgs: [pk[pkKey]]);
    return true;
  },
  onDeleteRow: (table, pk) async {
    final pkKey = pk.keys.first;
    await db.delete(table, where: '$pkKey = ?', whereArgs: [pk[pkKey]]);
    return true;
  },
);
```

### Hive Boxes

```dart
VetroLog.instance.registerDatabase(
  id: 'hive_settings',
  name: 'settings.hive',
  type: 'hive',
  path: box.path ?? 'memory',
  tables: [
    {
      'name': 'user_box',
      'rowCount': box.length,
      'columns': [
        {'name': 'key', 'type': 'STRING', 'isPrimaryKey': true},
        {'name': 'value', 'type': 'DYNAMIC'},
      ],
    },
  ],
  onFetchTableData: (table, page, size) async {
    return box.keys.map((k) => {'key': k, 'value': box.get(k)}).toList();
  },
  onUpdateRow: (table, pk, newValues) async {
    await box.put(pk['key'], newValues['value']);
    return true;
  },
  onDeleteRow: (table, pk) async {
    await box.delete(pk['key']);
    return true;
  },
);
```

---

## ⚡ Streaming Real-Time Mutations

Notify the desktop app whenever a write happens:

```dart
// After inserting into SQLite
await db.insert('users', values);

VetroLog.instance.notifyMutation(
  databaseId: 'app_sqlite',
  tableName: 'users',
  type: 'INSERT',
  newValues: values,
);
```
