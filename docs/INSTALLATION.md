# VetroLog Installation Guide

This guide covers step-by-step installation instructions for **macOS**, **Windows**, **Linux**, and **Local Web Server Mode**.

---

## 1. 🍎 macOS Installation

VetroLog supports all modern Macs, including **Apple Silicon (M1, M2, M3, M4)** and **Intel x86_64** via a Universal Binary.

### Option A: Disk Image (.dmg) — Recommended
1. Download **`VetroLog-macOS-Universal.dmg`** from [GitHub Releases](https://github.com/Tanvirul-swe/vetrolog/releases/latest).
2. Double-click the downloaded `.dmg` file to open it.
3. Drag the **VetroLog** icon into your **Applications** folder.
4. Eject the DMG image.

### Option B: Portable ZIP
1. Download **`VetroLog-macOS-Universal.zip`**.
2. Double-click to extract `VetroLog.app`.
3. Move `VetroLog.app` to your `/Applications` directory or launch it directly.

---

### ⚠️ macOS Gatekeeper: "Apple could not verify VetroLog"

Because VetroLog is a free, open-source tool without an expensive paid Apple Developer certificate, macOS Gatekeeper may display a security alert on the first launch:

> *"Apple could not verify ‘VetroLog’ is free of malware that may harm your Mac or compromise your privacy."*

**You only need to approve it once using any of these three quick methods:**

#### Method 1: The Right-Click Trick (Easiest - No Terminal)
1. Open **Finder** and navigate to your **Applications** folder.
2. **Right-click** (or hold `Control` and click) on **`VetroLog`**.
3. Select **Open** from the context menu.
4. An alert will appear with an **"Open"** button. Click **Open**.

macOS will permanently remember your permission, and VetroLog will open normally with a standard double-click from then on!

#### Method 2: Via System Settings
1. Open **System Settings** on your Mac.
2. Go to **Privacy & Security**.
3. Scroll down to the **Security** section.
4. Under *"VetroLog was blocked from use because it is not from an identified developer"*, click **"Open Anyway"**.
5. Confirm with your Mac password or Touch ID.

#### Method 3: Terminal Command (One-Liner)
Open your terminal and run:
```bash
xattr -d com.apple.quarantine /Applications/VetroLog.app
```
*(This immediately removes the internet download quarantine flag applied by macOS).*

---

## 2. 🪟 Windows Installation

VetroLog runs on **Windows 10** and **Windows 11** (64-bit).

### Option A: Guided Setup Wizard (.exe) — Recommended
1. Download **`vetrolog-amd64-installer.exe`** from [GitHub Releases](https://github.com/Tanvirul-swe/vetrolog/releases/latest).
2. Double-click to run the installer.
3. Follow the setup wizard to choose your installation directory.
4. Shortcuts will automatically be created on your **Desktop** and in the **Start Menu**.

### Option B: Standalone Portable ZIP
1. Download **`VetroLog-Windows-x64-Portable.zip`**.
2. Extract the ZIP anywhere (e.g. `C:\Tools\VetroLog` or a USB drive).
3. Double-click **`vetrolog.exe`** to launch immediately. No administrator rights required!

---

### ⚠️ Windows SmartScreen: "Windows protected your PC"

If Windows SmartScreen displays a blue banner stating *"Windows protected your PC"*:
1. Click **"More info"**.
2. Click **"Run anyway"**.

---

## 3. 🐧 Linux Installation

VetroLog runs on Ubuntu, Debian, Linux Mint, Fedora, Arch Linux, and other distributions.

### Prerequisites (GTK3 & WebKit2GTK)
VetroLog relies on standard Linux desktop libraries. Ensure they are installed:

- **Ubuntu / Debian / Linux Mint**:
  ```bash
  sudo apt update
  sudo apt install -y libgtk-3-0 libwebkit2gtk-4.0-37
  # On Ubuntu 24.04+:
  # sudo apt install -y libgtk-3-0 libwebkit2gtk-4.1-0
  ```
- **Fedora / RHEL**:
  ```bash
  sudo dnf install -y gtk3 webkit2gtk4.1
  ```
- **Arch Linux**:
  ```bash
  sudo pacman -S webkit2gtk-4.1 gtk3
  ```

### Option A: Debian / Ubuntu Package (.deb)
1. Download **`VetroLog-Linux-amd64.deb`** from [GitHub Releases](https://github.com/Tanvirul-swe/vetrolog/releases/latest).
2. Install via terminal:
   ```bash
   sudo dpkg -i VetroLog-Linux-amd64.deb
   sudo apt-get install -f # Fix any missing dependencies if needed
   ```
3. Launch VetroLog from your desktop application launcher or type `vetrolog` in terminal.

### Option B: Standalone Tarball (.tar.gz)
1. Download **`VetroLog-Linux-x64.tar.gz`**.
2. Extract the archive:
   ```bash
   tar -xvf VetroLog-Linux-x64.tar.gz
   cd VetroLog-Linux-x64
   ./vetrolog
   ```

---

## 4. 🌐 Local Web Server Mode (Browser Access)

If you prefer using **Chrome, Safari, Firefox, or Edge**, or if you work on a headless server or remote machine:

1. Download the executable for your OS or build from source.
2. Run VetroLog with the `--web` flag:
   ```bash
   ./vetrolog --web
   ```
3. Your default web browser will automatically open pointing to **`http://localhost:8787`**.

### Additional Flags:
- **Custom Port**:
  ```bash
  ./vetrolog --web --port 8080
  ```
- **Headless Mode** *(Suppress auto-opening the browser; great for Docker or remote SSH sessions)*:
  ```bash
  ./vetrolog --web --no-browser
  ```
