# VetroLog Android (Kotlin/Java) Client

Connect your native Android application to the **VetroLog Desktop Inspector** over Wi-Fi or USB.

---

## 1. Add Dependencies

Add the OkHttp dependency for WebSocket support in your `app/build.gradle` (or `build.gradle.kts`):

```groovy
dependencies {
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
}
```

Ensure your `AndroidManifest.xml` has Internet permission:
```xml
<uses-permission android:name="android.permission.INTERNET" />
```

---

## 2. Copy Client File

Copy `VetroLog.kt` into your project package (e.g., `com.yourapp.vetrolog`).

---

## 3. Initialize in `Application` or `MainActivity`

### Option A: USB (Recommended for stability)
Forward port 9222 via ADB on your Mac terminal:
```bash
adb reverse tcp:9222 tcp:9222
```

In your Kotlin code:
```kotlin
import com.vetrolog.client.VetroLog

class MainApplication : Application() {
    override fun onCreate() {
        super.onCreate()

        // Connect over USB (adb reverse)
        VetroLog.init(this, host = "localhost", port = 9222)

        // Automatically inspect SharedPreferences
        VetroLog.getInstance().registerSharedPreferences("user_settings")
        VetroLog.getInstance().registerSharedPreferences("auth_prefs")
    }
}
```

### Option B: Local Wi-Fi (Wireless)
Replace `192.168.0.x` with the IP shown in the VetroLog Desktop **"Connect App"** modal:
```kotlin
VetroLog.init(this, host = "192.168.0.17", port = 9222)
```

---

## 4. Room Database Query / Mutation Interceptor

To stream live SQL operations from Android Room to VetroLog:

```kotlin
val db = Room.databaseBuilder(context, AppDatabase::class.java, "app_database.db")
    .setQueryCallback(RoomDatabase.QueryCallback { sqlQuery, bindArgs ->
        val queryUpper = sqlQuery.trim().uppercase()
        val type = when {
            queryUpper.startsWith("INSERT") -> "INSERT"
            queryUpper.startsWith("UPDATE") -> "UPDATE"
            queryUpper.startsWith("DELETE") -> "DELETE"
            else -> "SELECT"
        }
        
        // Notify VetroLog Desktop of real-time mutation
        VetroLog.getInstance().notifyMutation(
            databaseId = "app_database",
            tableName = "users",
            type = type,
            query = sqlQuery
        )
    }, Executors.newSingleThreadExecutor())
    .build()
```
