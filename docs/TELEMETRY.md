# Telemetry & Privacy in VetroLog

VetroLog is an open-source developer tool. We strongly value user privacy, security, and full transparency.

This document details exactly what anonymous metrics VetroLog collects, how Google Analytics 4 (GA4) and Google OAuth 2.0 operate, our strict Zero-PII guarantees, and instructions for how you can completely disable telemetry.

---

## 🔒 Our Privacy Guarantees

We enforce strict data isolation between your local development environment and our telemetry pipeline:

1. **Zero Database Data Collection**:
   - We **never** transmit SQL queries, statement syntax, or parameter values.
   - We **never** transmit table names, column names, schema definitions, or index details.
   - We **never** transmit database connection strings, passwords, SSH keys, or credentials.
   - We **never** transmit row data, cell contents, or SQLite file paths.

2. **Zero Personally Identifiable Information (PII)**:
   - We **never** transmit your email address, full name, or Google profile picture to Google Analytics.
   - IP anonymization is permanently enabled (`anonymize_ip: true`) at the Google Analytics Measurement Protocol level.

3. **Irreversible Pseudonymous User ID**:
   - Signing in with Google is **completely optional and non-blocking** (all core database inspection tools work 100% offline without login).
   - If you choose to sign in, we do **not** send your Google user ID or email to telemetry. Instead, we compute an irreversible one-way SHA-256 cryptographic hash (`sha256(sub)`) used exclusively for cross-session retention analysis.

4. **Zero Open-Source Secrets Exposure**:
   - No production Google Analytics measurement secrets or Google OAuth client credentials are hardcoded into the Git repository.
   - All credentials are loaded at runtime from `.env` or system environment variables, with safe demo fallbacks for open-source contributors.

---

## 📊 Event Taxonomy

Here is the exhaustive list of events that VetroLog may send to Google Analytics:

| Event Name | Purpose | Example Parameters |
| :--- | :--- | :--- |
| `app_started` | Track application launches & platform distribution | `platform: "darwin"`, `arch: "arm64"`, `version: "v1.5.1"`, `app_mode: "desktop"` |
| `session_heartbeat` | Measure active developer engagement time | `duration_minutes: 5` |
| `device_connected` | Count ADB device connection types | `connection_type: "adb_usb"`, `platform: "android"` |
| `database_inspected` | Understand popular database engines & scale | `framework: "sqlite"`, `live_sync: true`, `table_bucket: "6-20"` *(never table names)* |
| `feature_used` | Track feature adoption (SQL Playground, ER Diagram, Index Advisor) | `feature_name: "query_executed"`, `feature_name: "diagram_opened"` |
| `user_signed_in` | Track authenticated vs guest adoption | `provider: "google"` or `provider: "demo"` *(no email or PII)* |
| `user_signed_out` | Track sign-out actions | None |

---

## ⚙️ How to Disable Telemetry (Opt Out)

You have multiple ways to disable telemetry completely:

### 1. In-App User Interface
1. Click the **Profile** icon in the top header.
2. Select the **Privacy & Telemetry** tab.
3. Click **Open Telemetry Settings**.
4. Switch the **Enable Anonymous Telemetry** toggle to **OFF**.

### 2. Environment Variables
You can disable telemetry at startup by setting any of the following standard environment variables:

```bash
# Standard Do Not Track signal
export DO_NOT_TRACK=1

# Or VetroLog explicit flag
export VETROLOG_TELEMETRY_DISABLED=1
```

### 3. Local Configuration File (`.env`)
In your VetroLog workspace, create or edit `.env` and leave the measurement ID empty or set disabled:

```dotenv
VETROLOG_TELEMETRY_DISABLED=true
VETROLOG_GA_MEASUREMENT_ID=
```

---

## 🔑 Google OAuth 2.0 Integration

### Is Sign-In Required?
**No.** All core inspection capabilities—including ADB Android debugging, remote PostgreSQL/MySQL/MSSQL/Redis connections, ER Diagram visualizer, and SQL Studio—are **100% free and work offline without signing in**.

### What Is Sign-In Used For?
Sign-in provides:
- Developer profile identification.
- Future cross-workstation cloud sync of encrypted connection profiles and query snippets.

### Configuring Google OAuth in Development
To test or run Google OAuth in development, copy `.env.example` to `.env` and supply your credentials from Google Cloud Console:

```bash
cp .env.example .env
```

```dotenv
VETROLOG_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
VETROLOG_GOOGLE_CLIENT_SECRET=your-client-secret
VETROLOG_GOOGLE_REDIRECT_URL=http://localhost:8787/api/auth/google/callback
```

If these variables are omitted or retain default `DEMO_` placeholders, VetroLog operates seamlessly in **Demo Mode**, allowing you to test the sign-in experience locally with a simulated developer account.

