# WinGet Submission for VetroLog

These manifests publish VetroLog to the official Microsoft Windows Package Manager repository (`microsoft/winget-pkgs`).

## 📥 Instant Local Testing (Windows)

To validate and test installing VetroLog locally from these manifests:

```powershell
# Validate manifests
winget validate --manifest distribution/winget/manifests/h/Hifzio/VetroLog/1.3.2/

# Test local installation
winget install --manifest distribution/winget/manifests/h/Hifzio/VetroLog/1.3.2/
```

## 🚀 Submitting to Microsoft Official Repository

### Option A: Using `wingetcreate` CLI (Recommended)
1. Install the official Microsoft wingetcreate tool:
   ```powershell
   winget install Microsoft.WingetCreate
   ```
2. Submit with your GitHub Personal Access Token:
   ```powershell
   wingetcreate submit distribution/winget/manifests/h/Hifzio/VetroLog/1.3.2/ --token <YOUR_GITHUB_TOKEN>
   ```

### Option B: Fork & PR to `microsoft/winget-pkgs`
1. Fork [microsoft/winget-pkgs](https://github.com/microsoft/winget-pkgs).
2. Copy the directory `distribution/winget/manifests/h/Hifzio/VetroLog/1.3.2/` into `manifests/h/Hifzio/VetroLog/1.3.2/` in your fork.
3. Open a Pull Request to `microsoft/winget-pkgs`. Microsoft's automated CI will validate, virus-scan, and auto-merge!

Once merged, anyone on Windows can install with:
```powershell
winget install Hifzio.VetroLog
```
