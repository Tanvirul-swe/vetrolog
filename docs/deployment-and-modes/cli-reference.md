# CLI Reference & Options

VetroLog supports command-line flags and environment variables for configuring runtime modes, port bindings, and browser behavior.

---

## 💻 Commands & Subcommands

### Default Command (Native Desktop Window)
Running `vetrolog` with no arguments launches the native desktop application (macOS, Windows, Linux) via Wails v2:
```bash
./vetrolog
```

### `serve` Subcommand (Web Mode)
Launches the embedded HTTP server:
```bash
./vetrolog serve
```

---

## 🚩 Command-Line Flags

| Flag | Type | Default | Description |
| :--- | :---: | :---: | :--- |
| **`--web`** | `boolean` | `false` | Starts VetroLog in Local Web Server mode instead of opening a desktop window. |
| **`--port`** | `integer` | `8787` | Specifies the listening HTTP port when running in Web Server mode. |
| **`--no-browser`** | `boolean` | `false` | Prevents VetroLog from automatically launching the default system browser upon starting web mode. |
| **`--help`**, **`-h`** | `boolean` | `false` | Displays help information and CLI usage options. |

---

## 🌍 Environment Variables

VetroLog respects the following environment variables if defined:

### `ADB_PATH`
By default, VetroLog searches for `adb` in:
1. System `$PATH`
2. Android SDK standard locations:
   * macOS: `~/Library/Android/sdk/platform-tools/adb`
   * Windows: `%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe`
   * Linux: `~/Android/Sdk/platform-tools/adb`

If your ADB binary is installed in a non-standard location, set `ADB_PATH`:
```bash
export ADB_PATH="/opt/custom-android/platform-tools/adb"
./vetrolog
```

---

## 💡 Practical Examples

```bash
# 1. Run desktop window normally
./vetrolog

# 2. Start web server on custom port 3000 and auto-open Chrome
./vetrolog --web --port 3000

# 3. Headless server on a remote Linux runner
./vetrolog --web --port 8787 --no-browser
```

---

## Next Steps

* Learn how GitHub Actions builds binaries in **[CI/CD & Releases](ci-cd-releases.md)**.
