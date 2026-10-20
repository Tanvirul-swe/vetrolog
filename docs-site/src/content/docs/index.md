---
title: VetroLog
description: Zero-config desktop database inspector for mobile developers.
template: splash
hero:
  tagline: High-performance desktop SQLite database inspector for mobile developers (Flutter, Android, React Native). Zero SDK code, live WAL synchronization, visual query planner, and natural language AI.
  image:
    file: ../../assets/logo.png
  actions:
    - text: 3-Minute Quick Start
      link: /vetrolog/getting-started/quickstart/
      icon: right-arrow
      variant: primary
    - text: View on GitHub
      link: https://github.com/Tanvirul-swe/vetrolog
      icon: external
      variant: secondary
---

import { Card, CardGrid } from '@astrojs/starlight/components';

## ⚡ Why Mobile Developers Choose VetroLog

<CardGrid stagger>
  <Card title="Zero SDK Boilerplate" icon="rocket">
    No SDK installation or network listeners required. VetroLog securely accesses app databases directly via Android Debug Bridge (`run-as`).
  </Card>
  <Card title="Real-Time WAL Auto-Sync" icon="laptop">
    Monitors SQLite Write-Ahead Logging (`-wal`) and Shared Memory (`-shm`) files live. Table data updates instantaneously on desktop when writes occur.
  </Card>
  <Card title="Intelligent SQL Console" icon="pencil">
    Multi-tab query editor with dot-notation column autocomplete, schema awareness, and execution timing.
  </Card>
  <Card title="Visual Query Plan & 60 FPS Profiler" icon="star">
    Evaluates `EXPLAIN QUERY PLAN` visually with high-cost table scan alerts, and benchmarks latency against the mobile 16.6ms UI frame budget.
  </Card>
  <Card title="Natural Language AI" icon="sun">
    Translates plain English into optimized SQLite queries using Google Gemini 2.5 Flash, OpenAI, or local Ollama models.
  </Card>
  <Card title="Multi-Platform & Web Mode" icon="setting">
    Native desktop application on macOS, Windows, and Linux, plus standalone headless Web Server mode (`./vetrolog --web`).
  </Card>
</CardGrid>

---

## 🎬 Live Database Inspection Preview

![VetroLog Live Database Inspector](/vetrolog/assets/images/live_inspector_hero.png)

---

## 🧭 Explore the Documentation

* **[What is VetroLog?](/vetrolog/getting-started/introduction/)**: Architecture and comparison against legacy tools.
* **[Installation Guide](/vetrolog/getting-started/installation/)**: Download DMG for macOS, Windows installer, or Linux binaries.
* **[Core Inspection Engine](/vetrolog/core-features/adb-discovery/)**: Deep dive into ADB discovery, live DataGrid, and WAL synchronization.
* **[Framework Guides](/vetrolog/framework-guides/flutter/)**: Best practices for Flutter (sqflite & Drift), Android Room, and React Native.
