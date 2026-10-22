---
title: "Common Issues & Troubleshooting"
---

This guide addresses common setup issues and provides direct solutions.

---

## 1. Device Shows as `unauthorized` or `offline`

### Symptom:
VetroLog displays "Scanning USB Devices..." or `adb devices` lists your phone as `unauthorized`:
```text
ZD222RN8B5       unauthorized
```

### Solution:
1. Unlock your phone screen.
2. Unplug and replug the USB cable.
3. A prompt will appear on your phone:
   > *"Allow USB debugging from this computer?"*
4. Check the box **"Always allow from this computer"** and tap **Allow**.
5. Run `adb devices` in terminal to confirm status is now `device`.

---

## 2. "run-as: Package is not debuggable"

### Symptom:
VetroLog connects to the device, but cannot access database files for a specific package name.

### Solution:
Android enforces a strict security sandbox. Android's `run-as` tool strictly forbids external access to production/release builds:
* Make sure your app is compiled in **debug mode** (`flutter run`, `npx react-native run-android`, or Android Studio Debug run).
* In native Android, ensure your `build.gradle` has:
  ```groovy
  buildTypes {
      debug {
          debuggable true
      }
  }
  ```

---

## 3. "No Databases Detected" in Sidebar

### Symptom:
Your app package is selected, but the sidebar shows `0 stores` or says no databases detected.

### Solution:
1. **Has the app initialized the database yet?**
   Mobile apps frequently create the SQLite database file on first read/write. If you just launched a brand new installation, navigate to a screen in your app that performs a database query.
2. **Check SQLite location**:
   VetroLog automatically checks:
   * `/data/data/<package>/databases/`
   * `/data/data/<package>/app_flutter/`
3. Click the **Refresh (⟳)** icon in the VetroLog header to force a rescan.

---

## 4. macOS Gatekeeper: "App cannot be opened"

### Symptom:
macOS displays an alert saying the developer cannot be verified or app is from an unidentified developer.

### Solution:
* **Option A**: Right-click (or Control-click) `VetroLog.app` in your `/Applications` folder and select **Open**. Click **Open** again in the confirmation dialog.
* **Option B**: Run this command in terminal to remove the quarantine attribute:
  ```bash
  xattr -d com.apple.quarantine /Applications/VetroLog.app
  ```

---

## 5. ADB Server Conflicts (`daemon not running`)

### Symptom:
ADB hangs or reports port `5037` is already in use by another tool.

### Solution:
Restart the ADB server:
```bash
adb kill-server
adb start-server
```

---

## 6. Gemini AI Model Not Found Error

### Symptom:
`models/gemini-1.5-flash is not found for API version v1beta, or is not supported for generateContent`.

### Solution:
Google deprecated older 1.5 model aliases on `v1beta`.
* VetroLog v1.2.0 defaults to **`gemini-2.5-flash`**.
* Open **AI Settings (⚙️)** in the Natural Language bar.
* Click **Test & Detect** to validate your key and select `gemini-2.5-flash` from the dropdown.

---

## Next Steps

* Still have questions? Browse the **[FAQ](/faq/)**.
* Need to report a bug? Open an issue on **[GitHub](https://github.com/Tanvirul-swe/issues)**.
