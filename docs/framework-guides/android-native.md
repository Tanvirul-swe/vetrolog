# Native Android Guide (Room & SQLite)

For native Android developers using Kotlin or Java, the dominant persistence library is **Android Room** (built on top of SQLite).

VetroLog provides zero-config inspection for all Room databases, standard `SQLiteOpenHelper` implementations, and `SharedPreferences` XML files.

---

## 📂 Where Native Android Stores Data

Android stores app-private data in sandbox subdirectories:

1. **SQLite & Room Databases**:
   ```
   /data/data/<package_name>/databases/<database_name>.db
   /data/data/<package_name>/databases/<database_name>.db-wal
   /data/data/<package_name>/databases/<database_name>.db-shm
   ```
2. **Android SharedPreferences**:
   ```
   /data/data/<package_name>/shared_prefs/<name>.xml
   ```

{% hint style="info" %}
**SharedPreferences Inspection**:
VetroLog not only discovers SQLite databases, but also parses XML `shared_prefs/` files into readable key-value tables!
{% endhint %}

---

## 🚀 Running Your Android App for Inspection

1. Open your project in **Android Studio**.
2. Select a connected phone or emulator from the device menu.
3. Click the green **Run (▶)** or **Debug (🐞)** button.
   * Debug builds built via Gradle automatically include `android:debuggable="true"` in the merged `AndroidManifest.xml`.
4. Open **VetroLog**.
5. Select your device from the header and choose your application package (e.g. `com.example.androidapp (Active)`).
6. Your Room database and its entities will immediately load in the sidebar.

---

## 🔄 Room LiveData & Kotlin Flow Reactivity

Android Room uses invalidation trackers to observe table mutations. When you use reactive queries in your DAO:

```kotlin
@Dao
interface UserDao {
    @Query("SELECT * FROM users ORDER BY name ASC")
    fun observeAllUsers(): Flow<List<UserEntity>>
}
```

When you edit or delete records in VetroLog:
1. VetroLog commits the edit to the SQLite table via ADB.
2. Room's SQLite trigger / content observer fires.
3. The Kotlin `Flow` or `LiveData` emits the new list to your UI automatically!

---

## 🛠️ Recommended Room Configuration

When building your Room database with `Room.databaseBuilder()`, ensure multi-instance invalidation is enabled if you perform writes from multiple processes:

```kotlin
val db = Room.databaseBuilder(
    context.applicationContext,
    AppDatabase::class.java,
    "app_database.db"
)
    .enableMultiInstanceInvalidation()
    .build()
```

---

## Next Steps

* Use the **[Index Advisor](../sql-playground/index-advisor.md)** to optimize Room `@Query` performance.
* Check out the **[Common Issues Guide](../troubleshooting/common-issues.md)** for ADB troubleshooting.
