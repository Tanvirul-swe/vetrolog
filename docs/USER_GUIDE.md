# VetroLog User Manual & Android ADB Guide

A comprehensive, step-by-step guide to inspecting, querying, and editing mobile SQLite databases using VetroLog.

---

## 1. Setting Up Your Android Phone / Emulator

VetroLog communicates with your mobile device via **ADB (Android Debug Bridge)**. Before you can inspect your databases, your phone must have **USB Debugging** enabled.

### A. Enabling Developer Options on Your Phone
1. Open **Settings** on your Android phone.
2. Scroll down and tap **About phone** (or **System > About phone**).
3. Find **Build number** and tap it **7 times** continuously.
4. You will see a toast notification: *"You are now a developer!"*.

### B. Enabling USB Debugging
1. Go back to **Settings > System > Developer options** (or **Additional settings > Developer options**).
2. Locate the **USB debugging** toggle and turn it **ON**.
3. Plug your phone into your computer using a USB cable.
4. Look at your phone screen: a prompt will appear:
   > *"Allow USB debugging from this computer?"*
5. Check the box **"Always allow from this computer"** and tap **Allow**.

> 💡 **Using an Android Emulator?** Emulators in Android Studio have USB debugging enabled by default. Simply start the emulator before opening VetroLog!

### C. Verify ADB Connection (Optional)
If you have the Android SDK installed, open your terminal and type:
```bash
adb devices
```
You should see your device listed as `device` (not `unauthorized` or `offline`):
```text
List of devices attached
ZD222RN8B5       device
```

---

## 2. Launching Your Mobile App

For VetroLog to inspect an app's databases, the app must be built in **debug mode**:

- **Flutter**:
  ```bash
  flutter run
  ```
- **Android Studio / Kotlin**:
  Click the green **Run (▶)** button (standard debug build).
- **React Native**:
  ```bash
  npx react-native run-android
  ```

> 🔒 **Why Debug Mode?** Android's operating system strictly forbids external tools from accessing an app's private sandbox in release builds for user security. Debug builds include the `android:debuggable="true"` flag, which allows VetroLog to safely read the database via ADB.

---

## 3. Connecting in VetroLog

Launch **VetroLog** (either the desktop app or `./vetrolog --web`):

```
┌────────────────────────────────────────────────────────────────────────┐
│ [VetroLog] v1.0   Search (⌘K)   📱 motorola_edge_50 │ 📦 aunkur (Active) │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Device Selector**: 
   - VetroLog continuously monitors USB ports. As soon as your phone is plugged in, its model name (e.g. `motorola_edge_50` or `emulator-5554`) appears automatically.
   - If multiple devices are plugged in, click the dropdown to switch between them.
2. **App Package Selector**:
   - VetroLog automatically scans for debuggable apps running on your device.
   - Apps actively in the foreground are flagged with `(Active)` or `(Running)`.
   - Select your app from the dropdown.

---

## 4. Inspecting Databases & Tables

Once your app is selected, VetroLog automatically scans:
- SQLite databases in `databases/`
- Flutter sqflite databases in `app_flutter/`
- SharedPreferences XML in `shared_prefs/`

### A. The Sidebar Database Tree
- Databases are listed in the left sidebar.
- Expand any database to reveal its tables.
- **Dynamic Badges**: Each table displays a live badge indicating the number of records (e.g., `42 rows`).

### B. The DataGrid Table Viewer
Click on any table in the sidebar to open the DataGrid:
- **Pagination**: Navigate large tables with page controls (50, 100, or 250 rows per page).
- **Sorting**: Click any column header to sort ascending or descending.
- **Search Filtering (`⌘K`)**: Press `⌘K` or click the search bar to filter visible records instantly across all fields.

### C. Live Updates (Real-Time Sync) Toggle
Located in the DataGrid toolbar:
- **Live Updates: ON (Default)**: VetroLog automatically monitors SQLite Write-Ahead Logs (`-wal`). When your mobile app inserts, updates, or deletes records, VetroLog syncs the changes **live without requiring a page refresh**!
- **Live Updates: OFF**: Pauses automatic syncing, allowing you to examine a frozen snapshot of table records.
- **Manual Refresh (`⌘R`)**: Click the refresh icon anytime to force a clean re-sync.

---

## 5. Intelligent SQL Playground

VetroLog includes a state-of-the-art **Intelligent SQL Playground** built specifically for mobile developers. To access it, click the **SQL Playground** toggle in the top navigation bar or click the **Playground** button in the bottom drawer.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ [Inspector] [SQL Playground ●]   Ask AI / NL: "Show top 10 users"   [⚙️ AI] │
├──────────────────────────────────────────────────────────────────────────────┤
│ 1 │ SELECT u.id, u.name, COUNT(o.id) as orders_count                         │
│ 2 │ FROM "users" u JOIN "orders" o ON u.id = o.user_id                       │
│ 3 │ GROUP BY u.id ORDER BY orders_count DESC LIMIT 20;                       │
├──────────────────────────────────────────────────────────────────────────────┤
│ [▶ Execute ⌘↵]  [🛡️ Dry Run ⌘⇧↵]  [🔍 Explain Plan]  │  [Export 📤] [Code Gen 💻] │
├──────────────────────────────────────────────────────────────────────────────┤
│ [Results (20)]  [Visual Query Plan]  [Profiler & FPS]  [Index Advisor]       │
└──────────────────────────────────────────────────────────────────────────────┘
```

### The 8 Playground Features:

1. **Natural Language to SQL Engine**:
   - Type plain-English prompts in the top bar (e.g. *"Show users created this week who haven't logged in"* or *"Count orders grouped by status"*).
   - Works **100% offline** with zero setup using the built-in heuristic pattern matcher.
   - Or click **⚙️ Settings** to connect your preferred AI provider (**Google Gemini**, **OpenAI**, or self-hosted **Local Ollama**).
2. **Schema-Aware Autocomplete & Join Predictor**:
   - Multi-line editor with monospace typography, line numbers, and keyboard shortcuts (`⌘Enter` to run, `⌘⇧Enter` to dry-run).
   - Contextual completion popup suggests tables and column names with data types.
   - **Join Predictor**: Type `JOIN orders ON ` and VetroLog automatically detects foreign key relationships (`orders.user_id = users.id`) and completes the join clause with a single press of `Tab` or `Enter`!
3. **Safe Dry-Run & Transaction Sandbox**:
   - Click **🛡️ Dry Run** to simulate mutating queries (`UPDATE`, `DELETE`, `ALTER`, `INSERT`) inside an isolated, rollback transaction (`BEGIN TRANSACTION ... ROLLBACK`).
   - Previews the exact number of affected rows and sample diffs without writing any changes to your mobile device disk.
   - Flags missing `WHERE` clauses with high-visibility safety warnings.
4. **Live Visual Query Planner (`EXPLAIN QUERY PLAN`)**:
   - Analyzes execution paths to map full table scans (🔴 `SCAN`), indexed lookups (🟢 `SEARCH`), and temporary B-Tree sorts (🟡 `TEMP B-TREE`).
   - Pinpoints mobile performance bottlenecks with 1-click index recommendations.
5. **Bidirectional Inline Data Editor**:
   - Double-click any cell in the query results table to edit its value directly.
   - Pressing `Enter` automatically generates and executes the underlying `UPDATE` statement and syncs the changes to the Android app sandbox in real time.
6. **Query Performance Profiler**:
   - Tracks execution times down to microsecond (`μs`) precision.
   - Evaluates mobile UI thread safety:
     - 🟢 **Ultra Fast (< 2ms)**: Safe for 60/120 FPS UI threads.
     - 🟡 **Noticeable (3ms - 15ms)**: Recommend background isolate/thread.
     - 🔴 **Lag Warning (> 15ms)**: Will drop frames on mobile devices; index required.
   - Visual sparkline latency trend across recent execution runs.
7. **Smart Index & Schema Optimization Advisor**:
   - Identifies slow linear scans and generates exact composite index DDL statements (e.g., `CREATE INDEX IF NOT EXISTS "idx_orders_status" ON "orders" ("status");`).
   - **1-Click Apply Index**: Creates the index directly in SQLite and syncs to your phone over ADB, then re-analyzes the query plan to show the new green indexed node!
8. **Instant Data Exporter & Code Generator**:
   - **Export**: Download or copy results in **JSON**, **CSV**, **SQL Inserts**, or **Markdown**.
   - **Code Generator**: Converts working SQL queries into copy-paste ready code for **Flutter / Dart** (`sqflite` / `Drift`), **Android / Kotlin** (`Room @Query`), **iOS / Swift** (`GRDB`), and **Go**.

---

## 6. Editing Records & Live Write-Back

Need to test edge cases, change a user's role to admin, or update an account balance? You can edit database rows directly inside VetroLog!

### A. Double-Click Cell Editing
1. Double-click any table cell in the DataGrid.
2. Edit the value in the inline editor.
3. Press `Enter` to commit (or `Esc` to cancel).

### B. Row Detail Inspector
1. Click on any row to open the **Row Detail Sheet** on the right side.
2. View all columns in formatted JSON or key-value format.
3. Edit multiple fields simultaneously and click **Save Changes**.
4. To remove a record, click **Delete Row**.

> ⚡ **Automatic Sandbox Sync**: When you commit an edit, VetroLog automatically writes the changes back to the phone's SQLite database sandbox over ADB. When your mobile app next reads the database, it will immediately read the updated values!

---

## 7. Troubleshooting & FAQ

### Device shows "No ADB Device"
1. Verify your phone's USB connection mode is set to **File Transfer** (not "Charging only").
2. Ensure **USB Debugging** is toggled ON in Developer Options.
3. Run `adb devices` in your terminal to see if ADB needs an authorization confirmation on your phone.

### App shows "No debug apps"
1. Ensure your app was built in debug mode (`flutter run`), not a release APK.
2. Make sure the app is opened and currently running in the foreground on your phone.

### Changes made on phone don't reflect immediately
1. Ensure the **Live Updates: ON** toggle is active in the DataGrid toolbar.
2. If your mobile framework buffers transactions in memory, perform an action in the app that triggers a database write.
