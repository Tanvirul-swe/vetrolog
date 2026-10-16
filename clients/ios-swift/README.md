# VetroLog iOS (Swift) Client

Connect your native iOS application (Swift / UIKit / SwiftUI) to the **VetroLog Desktop Inspector** over Wi-Fi or USB.

---

## 1. Zero External Dependencies

VetroLog for iOS uses Apple's native `URLSessionWebSocketTask` (iOS 13+). You do not need to install any CocoaPods or SPM packages.

---

## 2. Add File to Xcode

Drag and drop `VetroLog.swift` into your Xcode project.

Ensure `NSLocalNetworkUsageDescription` and `NSBonjourServices` are included in your `Info.plist` if you want local network permissions:
```xml
<key>NSLocalNetworkUsageDescription</key>
<string>VetroLog connects to the desktop database inspector on your local network.</string>
<key>NSBonjourServices</key>
<array>
    <string>_vetrolog._tcp</string>
</array>
```

---

## 3. Initialize in `AppDelegate` or `@main App`

### Option A: iOS Simulator or USB
On Simulator or when connected via USB tethering:
```swift
import UIKit

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        
        // Connect to Desktop Inspector
        VetroLog.initialize(host: "localhost", port: 9222)
        
        // Automatically inspect standard UserDefaults
        VetroLog.shared.registerUserDefaults()
        
        return true
    }
}
```

### Option B: Physical Device over Wi-Fi
Replace `192.168.0.x` with the IP displayed in the desktop **"Connect App"** modal:
```swift
VetroLog.initialize(host: "192.168.0.17", port: 9222)
```

---

## 4. Notify Real-Time SQLite or CoreData Mutations

Whenever you perform an insert, update, or delete:
```swift
VetroLog.shared.notifyMutation(
    databaseId: "main.db",
    tableName: "orders",
    type: "INSERT",
    query: "INSERT INTO orders VALUES (101, 'iPhone', 999.0)",
    newValues: ["id": 101, "item": "iPhone", "price": 999.0]
)
```
