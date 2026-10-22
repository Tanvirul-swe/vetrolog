---
title: "Flutter Database Guide (sqflite & Drift)"
---

Flutter is one of the most popular mobile frameworks. Most Flutter applications persist relational data using either **`sqflite`** or **`drift`** (formerly Moor).

VetroLog provides first-class support for Flutter SQLite databases out of the box with zero plugins.

---

## 📂 Where Flutter Stores Database Files

In Flutter, developers typically obtain the database path via one of two methods:

### 1. `getDatabasesPath()` (Standard `sqflite`)
Stores files in the system database path:
```
/data/data/<package_name>/databases/my_database.db
```

### 2. `getApplicationDocumentsDirectory()` (`path_provider` & Drift)
Stores files inside the application documents path:
```
/data/data/<package_name>/app_flutter/my_database.db
```

:::tip
**Automatic Multi-Directory Discovery**:
VetroLog automatically scans both `databases/` and `app_flutter/` simultaneously. Regardless of which method your Flutter app uses, your databases appear automatically in the sidebar!
:::

---

## 🚀 Running Your Flutter App for Inspection

To inspect your Flutter database:

1. Connect your phone via USB or start an emulator.
2. Launch your Flutter app in debug mode:
   ```bash
   flutter run
   ```
   *(Debug mode automatically sets `android:debuggable="true"` in the Android manifest).*
3. Open **VetroLog**.
4. In the top bar, select your device and pick your app package name (e.g. `com.example.my_flutter_app (Active)`).
5. All SQLite databases created by `sqflite` or `drift` will appear in the sidebar immediately.

![VetroLog Inspecting Flutter SQLite Database](/assets/images/live_inspector_hero.png)

---

## 🔄 Reactive UI Updates with Drift & StreamBuilder

If your Flutter app uses reactive queries:
* **Drift**: `database.select(database.users).watch()`
* **sqflite**: Wrapped in a custom `StreamController` or `ValueNotifier`

When you edit a cell or delete a row in VetroLog:
1. VetroLog writes the mutation directly to the phone's SQLite database.
2. The file system notifies the SQLite file watcher.
3. Your Flutter UI updates **instantly on the phone screen without restarting the app!**

![Live Table Inspection of Flutter Database](/assets/images/datagrid_view.png)

---

## 🛠️ Recommended SQLite Configuration in Flutter

To get optimal performance and real-time synchronization in Flutter, ensure WAL mode is enabled:

```dart
import 'package:sqflite/sqflite.dart';

Future<Database> openMyDatabase() async {
  return await openDatabase(
    'my_app.db',
    version: 1,
    onConfigure: (db) async {
      // Enable foreign keys
      await db.execute('PRAGMA foreign_keys = ON;');
      // Enable Write-Ahead Logging for high performance & live sync
      await db.execute('PRAGMA journal_mode = WAL;');
    },
  );
}
```

---

## Next Steps

* Inspect tables live with the **[Live Table Inspector](/core-features/live-inspector/)**.
* Generate and test queries in the **[SQL Playground](/sql-playground/overview/)**.
