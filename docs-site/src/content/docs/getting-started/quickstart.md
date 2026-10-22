---
title: "Quick Start (3-Minute Tutorial)"
---

Get started with VetroLog and inspect your real-time mobile database in 3 minutes.

---

## Step 1: Enable USB Debugging on Your Device

VetroLog communicates directly with Android devices via the **Android Debug Bridge (ADB)**.

### For Physical Android Phones:
1. Open **Settings** on your phone.
2. Tap **About Phone** and locate the **Build Number**.
3. Tap **Build Number** 7 times until you see the message: *"You are now a developer!"*.
4. Return to **Settings > System > Developer Options**.
5. Enable the **USB Debugging** toggle.
6. Connect your phone to your computer with a USB cable.
7. Accept the **"Allow USB debugging from this computer?"** dialog on your phone screen.

:::note
**Using an Android Emulator?**
Emulators in Android Studio have USB debugging enabled automatically. Simply boot the emulator!
:::

Verify your device is recognized by running:
```bash
adb devices
```
You should see your device ID with the `device` status:
```text
List of devices attached
ZD222RN8B5       device
```

---

## Step 2: Launch Your App in Debug Mode

VetroLog accesses database files through Android's secure `run-as` utility, which is enabled for apps compiled with `android:debuggable="true"`:

* **Flutter**:
  ```bash
  flutter run
  ```
* **React Native**:
  ```bash
  npx react-native run-android
  ```
* **Native Android (Kotlin / Java)**:
  Click the **Run (▶)** button in Android Studio.

---

## Step 3: Connect & Inspect in VetroLog

1. Launch **VetroLog**.
2. Notice the top header bar:
   * **Device Selector**: Automatically selects your connected device (e.g. `📱 motorola_edge_50`).
   * **App Package Selector**: Automatically highlights debuggable apps on your phone (e.g. `📦 aunkur (Active)`).

![VetroLog Device & App Discovery](/assets/demos/quickstart_tour.webp)

3. In the left sidebar, click on any database to expand its tables.
4. Click on any table (such as `general_info_table`) to view live records in the DataGrid:

![VetroLog DataGrid View](/assets/images/datagrid_view.png)

:::tip
**Congratulations!** You are now inspecting a live mobile database with zero SDK code.
:::

---

## Next Steps

* Learn how **[Real-Time WAL Sync](/core-features/wal-realtime-sync/)** updates your data automatically when the phone writes to the database.
* Explore the **[Intelligent SQL Playground](/sql-playground/overview/)** to execute multi-tab queries and optimize execution with AI.
