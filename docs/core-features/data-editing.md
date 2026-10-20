# Bidirectional Data Editing

VetroLog is not just a read-only viewer. It allows you to **edit values and delete rows directly from your desktop**, writing the updates back to your mobile device in real time.

This makes debugging edge cases, testing form validation, and resetting test user states effortless.

---

## ✏️ Editing Table Cells In-Place

1. **Open any table** in the DataGrid.
2. **Double-click on any cell** you wish to modify (e.g. changing a `name`, `status`, or `price`).
3. An inline editor appears. Enter the new value:
   * **Numbers**: Validated automatically as integers or floats.
   * **Strings**: Stored as UTF-8 text.
   * **Booleans**: Can be toggled or edited as `1` / `0`.
   * **NULL**: Emptying the field or typing `NULL` sets the cell to SQL NULL.
4. Press **Enter** to save (or press **Escape** to cancel).

### Optimistic UI & Safe Write-Back
* **Immediate Feedback**: The cell updates optimistically on your screen with a subtle green pulse.
* **Under the Hood**: VetroLog detects the table's Primary Key (`PK`) and executes a targeted SQL update:
  ```sql
  UPDATE users SET name = 'Jane Doe' WHERE id = 42;
  ```
* **Mobile Synchronization**: The update is written directly into the mobile sandbox database. If your app is listening to reactive streams (e.g. Flutter `StreamBuilder`, Android Room `LiveData`/`Flow`), your mobile app UI will update live on the phone screen immediately!

---

## 🗑️ Deleting Rows

1. Locate the row you want to delete in the DataGrid.
2. Click the **Trash Can icon (🗑️)** at the right side of the row (or select the row and press `Delete` / `Backspace`).
3. Confirm the deletion prompt.
4. VetroLog removes the record locally and issues a safe parameterized delete:
   ```sql
   DELETE FROM users WHERE id = 42;
   ```

---

## 🔒 Safety Guards & Rollbacks

{% hint style="warning" %}
**Primary Key Requirement**:
To prevent accidental bulk updates or deletions, VetroLog strictly requires tables to have a Primary Key (`PK`) or `rowid` before allowing single-row in-place edits and deletions.
{% endhint %}

If a table lacks an explicit primary key, you can still execute precise queries using the **[SQL Playground](../sql-playground/overview.md)** or test modifications safely using the **[Safe Dry-Run Simulator](../sql-playground/profiler-and-dryrun.md)**.
