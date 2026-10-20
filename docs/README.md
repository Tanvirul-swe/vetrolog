# Welcome to VetroLog

**VetroLog** is an open-source, high-performance desktop database inspector designed specifically for mobile developers (Flutter, Android, iOS, React Native). 

Unlike legacy inspection tools (such as Stetho or Flipper), VetroLog requires **zero SDK installation** and **zero code modifications** in your application. Simply connect your device via USB or start an emulator, and VetroLog communicates directly with SQLite via the Android Debug Bridge (ADB).

---

![VetroLog Live Database Inspector](.gitbook/assets/images/live_inspector_hero.png)

---

## ⚡ Core Highlights

{% hint style="info" %}
**Zero Code Required**: You do not need to add any third-party dependencies, network listeners, or native bridges to your mobile application.
{% endhint %}

* **Zero-Config ADB Mobile Inspector**: Instant detection of USB devices and running debuggable applications.
* **Real-Time WAL Sync**: Live synchronization with SQLite Write-Ahead Logging (`-wal`) and Shared Memory (`-shm`) files. When your phone writes data, VetroLog updates immediately.
* **Intelligent SQL Playground**: Multi-tab SQL console with dot-notation column autocomplete and automatic schema awareness.
* **Visual Query Plan**: Evaluates `EXPLAIN QUERY PLAN` visually with color-coded alerts for full table scans and temporary B-trees.
* **Natural Language to SQL**: Translates plain-English requests into optimized SQLite queries using Google Gemini 2.5 Flash, OpenAI, or local Ollama models.
* **1-Click Index Advisor**: Analyzes slow queries and recommends optimal indexes with estimated execution speedups.
* **Mobile 60 FPS Profiler**: Tracks query latency against the mobile 16.6ms UI frame budget to prevent dropped frames and stutters.
* **Safe Dry-Run Simulator**: Tests mutating queries (`UPDATE`, `DELETE`, `INSERT`) inside isolated transactions with automatic rollbacks.
* **Multi-Platform Code Generator**: Exports SQL queries directly into Flutter (Drift / sqflite), Android (Room), iOS (GRDB), and Go snippets.
* **Dual Operating Modes**: Run as a native desktop application on macOS, Windows, and Linux, or run headless via `./vetrolog --web` (`http://localhost:8787`).

---

## 🎬 Quick Interactive Tour

Watch how quickly VetroLog connects to a connected Android phone, detects the debuggable app, and navigates live SQLite databases:

![VetroLog Quick Tour](.gitbook/assets/demos/quickstart_tour.webp)

---

## 🧭 Navigation Guide

* **[Getting Started](getting-started/introduction.md)**: Understand the architecture and install VetroLog on macOS, Windows, or Linux.
* **[Quick Start Guide](getting-started/quickstart.md)**: Connect your device and inspect your first database in under 3 minutes.
* **[Core Inspection Engine](core-features/adb-discovery.md)**: Deep dive into ADB discovery, live DataGrid, and WAL synchronization.
* **[Intelligent SQL Playground](sql-playground/overview.md)**: Master query execution, visual plans, AI generation, and the Index Advisor.
* **[Framework Guides](framework-guides/flutter.md)**: Best practices for Flutter, Android Room, and React Native.
* **[Deployment & CLI Modes](deployment-and-modes/web-server-mode.md)**: Run VetroLog on remote servers, Docker, or CI/CD pipelines.
* **[Troubleshooting & FAQ](troubleshooting/common-issues.md)**: Resolving USB authorization, permission errors, and common questions.
