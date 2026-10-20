# Frequently Asked Questions (FAQ)

Frequently asked questions about VetroLog, mobile database inspection, and privacy.

---

### Q1: Does VetroLog require any third-party SDK or code in my mobile app?
**No.** VetroLog requires **zero dependencies** and **zero lines of code** in your Flutter, Android, or React Native application. It communicates through the Android Debug Bridge (ADB) using the native `run-as` mechanism.

---

### Q2: Can VetroLog inspect production / release builds of an app?
**No.** Android's operating system strictly enforces sandboxing on release builds (`android:debuggable="false"`). Without root access, no tool can read another application's private files in production. VetroLog is designed for **development, testing, and QA environments**.

---

### Q3: What database engines and storage formats are supported?
VetroLog supports:
* **SQLite 3**: Standard `.db`, `.sqlite`, `.sqlite3` files.
* **SQLite WAL & SHM**: Write-Ahead Logging (`.db-wal` and `.db-shm`) with real-time live sync.
* **Android SharedPreferences**: XML files in `shared_prefs/` parsed as structured key-value tables.
* **Flutter sqflite & Drift**: Both default and custom storage paths (`app_flutter/`).

---

### Q4: Can I use VetroLog 100% offline without an internet connection?
**Yes.** All core features—ADB inspection, table browsing, live WAL sync, data editing, visual query plans, and index advisor—run 100% locally on your machine.
* For Natural Language to SQL, you can use the **Offline Rule Engine** or **Local Ollama** (`codellama`, `llama3`) for a completely private, offline experience.

---

### Q5: How does VetroLog handle very large tables with 100,000+ rows?
VetroLog is engineered for speed:
* Tables are paginated by default (50, 100, or 250 rows).
* The SQL Playground automatically applies a safe `LIMIT 100` to prevent memory spikes, with an optional **Fetch 10k** button.
* The frontend uses virtualized list rendering to maintain smooth 60 FPS scrolling.

---

### Q6: Does VetroLog support wireless ADB?
**Yes.** If your phone and computer are on the same Wi-Fi network:
1. Connect via USB initially and enable wireless ADB:
   ```bash
   adb tcpip 5555
   ```
2. Unplug the USB cable and connect wirelessly:
   ```bash
   adb connect <phone-ip-address>:5555
   ```
3. VetroLog will detect the wireless device automatically.

---

### Q7: Are my API keys (Gemini / OpenAI) safe?
**Yes.** All API keys are stored strictly inside your local browser storage (`localStorage`). They are never sent to VetroLog servers. When you generate a query, requests are sent directly from your computer to the AI provider's official endpoint.

---

## Have More Questions?

Join our community and contribute:
* **[GitHub Discussions](https://github.com/Tanvirul-swe/vetrolog/discussions)**
* **[Issue Tracker](https://github.com/Tanvirul-swe/vetrolog/issues)**
