import { useEffect } from 'react';
import { SplitLayout } from './components/layout/SplitLayout';
import { useWailsEvent } from './hooks/useWailsEvent';
import { EVENTS } from './constants/events';
import { useConnectionStore } from './stores/useConnectionStore';
import { useDatabaseStore } from './stores/useDatabaseStore';
import * as AppBindings from '../wailsjs/go/app/App';
import { DatabaseInfo } from './types/database';

// Sample mock data for when no mobile client is connected yet
const SAMPLE_DATABASES: DatabaseInfo[] = [
  {
    id: 'db_main_sqlite',
    name: 'ecommerce.db',
    type: 'sqlite',
    path: '/data/user/0/com.app.vetrolog/databases/ecommerce.db',
    sizeBytes: 1048576 * 2.4, // 2.4MB
    updatedAt: Date.now(),
    tables: [
      {
        name: 'users',
        type: 'table',
        rowCount: 1240,
        columns: [
          { name: 'id', type: 'INTEGER', isPrimaryKey: true, isNullable: false },
          { name: 'email', type: 'TEXT', isPrimaryKey: false, isNullable: false },
          { name: 'name', type: 'TEXT', isPrimaryKey: false, isNullable: false },
          { name: 'is_active', type: 'BOOLEAN', isPrimaryKey: false, isNullable: false },
          { name: 'preferences', type: 'JSON', isPrimaryKey: false, isNullable: true },
          { name: 'created_at', type: 'DATETIME', isPrimaryKey: false, isNullable: false },
        ],
      },
      {
        name: 'orders',
        type: 'table',
        rowCount: 8520,
        columns: [
          { name: 'order_id', type: 'INTEGER', isPrimaryKey: true, isNullable: false },
          { name: 'user_id', type: 'INTEGER', isPrimaryKey: false, isNullable: false },
          { name: 'total_amount', type: 'REAL', isPrimaryKey: false, isNullable: false },
          { name: 'status', type: 'TEXT', isPrimaryKey: false, isNullable: false },
          { name: 'metadata', type: 'JSON', isPrimaryKey: false, isNullable: true },
        ],
      },
      {
        name: 'v_active_customers',
        type: 'view',
        rowCount: 320,
        columns: [
          { name: 'customer_id', type: 'INTEGER', isPrimaryKey: true, isNullable: false },
          { name: 'email', type: 'TEXT', isPrimaryKey: false, isNullable: false },
          { name: 'order_count', type: 'INTEGER', isPrimaryKey: false, isNullable: false },
        ],
      },
    ],
  },
  {
    id: 'hive_user_box',
    name: 'user_session.hive',
    type: 'hive',
    path: '/data/user/0/com.app.vetrolog/app_flutter/user_session.hive',
    sizeBytes: 420000,
    updatedAt: Date.now(),
    tables: [
      {
        name: 'session_cache',
        type: 'box',
        rowCount: 15,
        columns: [
          { name: 'key', type: 'STRING', isPrimaryKey: true, isNullable: false },
          { name: 'value', type: 'OBJECT', isPrimaryKey: false, isNullable: true },
          { name: 'ttl', type: 'INTEGER', isPrimaryKey: false, isNullable: true },
        ],
      },
      {
        name: 'offline_queue',
        type: 'box',
        rowCount: 4,
        columns: [
          { name: 'sync_id', type: 'STRING', isPrimaryKey: true, isNullable: false },
          { name: 'payload', type: 'JSON', isPrimaryKey: false, isNullable: false },
          { name: 'attempts', type: 'INTEGER', isPrimaryKey: false, isNullable: false },
        ],
      },
    ],
  },
  {
    id: 'prefs_default',
    name: 'shared_preferences.xml',
    type: 'shared_preferences',
    path: '/data/user/0/com.app.vetrolog/shared_prefs/com.app.vetrolog_preferences.xml',
    sizeBytes: 8192,
    updatedAt: Date.now(),
    tables: [
      {
        name: 'default_preferences',
        type: 'box',
        rowCount: 8,
        columns: [
          { name: 'key', type: 'STRING', isPrimaryKey: true, isNullable: false },
          { name: 'value', type: 'ANY', isPrimaryKey: false, isNullable: true },
          { name: 'type', type: 'STRING', isPrimaryKey: false, isNullable: false },
        ],
      },
    ],
  },
];

const SAMPLE_USERS_ROWS = [
  {
    id: 1,
    email: 'developer@example.com',
    name: 'Alex Rivera',
    is_active: true,
    preferences: { theme: 'dark', telemetry: true, notifications: { push: true, email: false } },
    created_at: '2026-03-12 10:24:00',
  },
  {
    id: 2,
    email: 'sarah.connor@cyber.io',
    name: 'Sarah Connor',
    is_active: true,
    preferences: { theme: 'system', telemetry: false },
    created_at: '2026-03-14 14:15:22',
  },
  {
    id: 3,
    email: 'marcus.vance@tech.co',
    name: 'Marcus Vance',
    is_active: false,
    preferences: { theme: 'dark', locale: 'en-US' },
    created_at: '2026-03-15 08:30:11',
  },
  {
    id: 4,
    email: 'elena.rostova@quantum.ai',
    name: 'Elena Rostova',
    is_active: true,
    preferences: { beta_features: true, max_concurrency: 8 },
    created_at: '2026-03-16 19:42:50',
  },
  {
    id: 5,
    email: 'tanvir@vetrolog.dev',
    name: 'Tanvir Islam',
    is_active: true,
    preferences: { role: 'admin', workspace: 'mobile_telemetry' },
    created_at: '2026-03-18 11:05:00',
  },
];

export function App() {
  const isConnected = useConnectionStore((s) => s.isConnected);
  const setConnectionState = useConnectionStore((s) => s.setConnectionState);
  const setDeviceConnected = useConnectionStore((s) => s.setDeviceConnected);
  const setDeviceDisconnected = useConnectionStore((s) => s.setDeviceDisconnected);

  const databases = useDatabaseStore((s) => s.databases);
  const setDatabases = useDatabaseStore((s) => s.setDatabases);
  const selectedDbId = useDatabaseStore((s) => s.selectedDatabaseId);
  const selectedTableName = useDatabaseStore((s) => s.selectedTableName);
  const setTableData = useDatabaseStore((s) => s.setTableData);
  const addMutation = useDatabaseStore((s) => s.addMutation);
  const addMutationsBatch = useDatabaseStore((s) => s.addMutationsBatch);
  const addQueryLog = useDatabaseStore((s) => s.addQueryLog);
  const setLatestQueryResult = useDatabaseStore((s) => s.setLatestQueryResult);
  const updateRowLocally = useDatabaseStore((s) => s.updateRowLocally);
  const deleteRowLocally = useDatabaseStore((s) => s.deleteRowLocally);
  const rows = useDatabaseStore((s) => s.rows);
  const columns = useDatabaseStore((s) => s.columns);
  const page = useDatabaseStore((s) => s.page);
  const pageSize = useDatabaseStore((s) => s.pageSize);

  // 1. Fetch initial connection state from Go backend
  useEffect(() => {
    try {
      if (
        typeof window !== 'undefined' &&
        // @ts-expect-error window.go may be undefined during dev/browser
        window?.go?.app?.App?.GetConnectionState
      ) {
        AppBindings.GetConnectionState().then((state) => {
          if (state) setConnectionState(state);
        });
      }
    } catch {
      // Running in browser preview
    }
  }, [setConnectionState]);

  // 2. Load demo data if no mobile device is connected yet
  useEffect(() => {
    if (databases.length === 0 && !isConnected) {
      setDatabases(SAMPLE_DATABASES);
      setTableData({
        databaseId: 'db_main_sqlite',
        tableName: 'users',
        totalRows: SAMPLE_USERS_ROWS.length,
        page: 1,
        pageSize: 50,
        columns: SAMPLE_DATABASES[0].tables[0].columns,
        rows: SAMPLE_USERS_ROWS,
      });

      // Sample initial query log and mutation
      addQueryLog({
        id: 'q_init_1',
        databaseId: 'db_main_sqlite',
        query: 'SELECT * FROM users ORDER BY created_at DESC LIMIT 5;',
        durationMs: 1.4,
        timestamp: Date.now() - 3000,
        success: true,
      });

      addMutation({
        id: 'mut_init_1',
        databaseId: 'db_main_sqlite',
        tableName: 'users',
        type: 'INSERT',
        timestamp: Date.now() - 1500,
        query: "INSERT INTO users (email, name, is_active) VALUES ('tanvir@vetrolog.dev', 'Tanvir Islam', 1);",
        durationMs: 2.1,
        newValues: { id: 5, email: 'tanvir@vetrolog.dev', name: 'Tanvir Islam', is_active: true },
        affected: 1,
      });
    }
  }, [databases.length, isConnected, setDatabases, setTableData, addQueryLog, addMutation]);

  // 3. Wails IPC Event Listeners
  useWailsEvent(EVENTS.DEVICE_CONNECTED, (device) => {
    setDeviceConnected(device);
  });

  useWailsEvent(EVENTS.DEVICE_DISCONNECTED, () => {
    setDeviceDisconnected();
  });

  useWailsEvent(EVENTS.CONNECTION_STATE, (state) => {
    setConnectionState(state);
  });

  useWailsEvent(EVENTS.DATABASE_LIST, (list) => {
    setDatabases(list);
  });

  useWailsEvent(EVENTS.TABLE_DATA, (payload) => {
    setTableData(payload);
  });

  useWailsEvent(EVENTS.LIVE_MUTATION, (mutation) => {
    addMutation(mutation);
  });

  useWailsEvent(EVENTS.BATCH_MUTATIONS, (batch) => {
    addMutationsBatch(batch);
  });

  useWailsEvent(EVENTS.QUERY_LOG, (log) => {
    addQueryLog(log);
  });

  useWailsEvent(EVENTS.QUERY_RESULT, (result) => {
    setLatestQueryResult(result);
  });

  // 4. Request table data on selection or page change
  const handleRequestTableData = (targetPage = page) => {
    if (selectedDbId && selectedTableName) {
      try {
        if (
          typeof window !== 'undefined' &&
          // @ts-expect-error window.go may be undefined
          window?.go?.app?.App?.RequestTableData
        ) {
          AppBindings.RequestTableData(selectedDbId, selectedTableName, targetPage, pageSize);
        }
      } catch {
        // Safe fallback
      }
    }
  };

  useEffect(() => {
    if (isConnected && selectedDbId && selectedTableName) {
      handleRequestTableData(1);
    }
  }, [selectedDbId, selectedTableName, isConnected]);

  // 5. Query execution trigger
  const handleExecuteQuery = (query: string) => {
    if (!selectedDbId) return;

    try {
      if (
        typeof window !== 'undefined' &&
        // @ts-expect-error window.go may be undefined
        window?.go?.app?.App?.ExecuteQuery
      ) {
        AppBindings.ExecuteQuery(selectedDbId, query);
      }
    } catch {
      // Safe fallback
    }

    // If in demo mode (no device connected), execute an interactive simulation response
    if (!isConnected) {
      const startTime = performance.now();
      const qLower = query.toLowerCase();

      let resultRows = [...rows];
      let affected = 0;

      if (qLower.includes('where') || qLower.includes('like')) {
        resultRows = rows.slice(0, 2);
      } else if (qLower.startsWith('insert') || qLower.startsWith('update') || qLower.startsWith('delete')) {
        resultRows = [];
        affected = 1;
      } else if (qLower.includes('limit')) {
        resultRows = rows.slice(0, 3);
      }

      const elapsed = Math.max(0.8, Number((performance.now() - startTime + Math.random() * 2).toFixed(2)));

      const queryRes = {
        requestId: `q_${Date.now()}`,
        databaseId: selectedDbId,
        query,
        columns: columns,
        rows: resultRows,
        affected,
        durationMs: elapsed,
        success: true,
      };

      setLatestQueryResult(queryRes);
      addQueryLog({
        id: queryRes.requestId,
        databaseId: selectedDbId,
        query,
        durationMs: elapsed,
        timestamp: Date.now(),
        success: true,
      });
    }
  };

  // 6. Data Editing / Mutation from Desktop
  const handleUpdateRow = (pkField: string, pkValue: unknown, newValues: Record<string, unknown>) => {
    if (!selectedDbId || !selectedTableName) return;

    try {
      if (
        typeof window !== 'undefined' &&
        // @ts-expect-error window.go may be undefined
        window?.go?.app?.App?.UpdateRow
      ) {
        AppBindings.UpdateRow(
          selectedDbId,
          selectedTableName,
          JSON.stringify({ [pkField]: pkValue }),
          JSON.stringify(newValues)
        );
      }
    } catch {
      // Safe fallback
    }

    // Optimistically update local store
    updateRowLocally(pkField, pkValue, newValues);

    // Record mutation event
    addMutation({
      id: `mut_edit_${Date.now()}`,
      databaseId: selectedDbId,
      tableName: selectedTableName,
      type: 'UPDATE',
      timestamp: Date.now(),
      query: `UPDATE ${selectedTableName} SET ${Object.keys(newValues)
        .map((k) => `${k} = ?`)
        .join(', ')} WHERE ${pkField} = ${JSON.stringify(pkValue)};`,
      durationMs: 1.2,
      newValues,
      affected: 1,
    });
  };

  // 7. Delete Row from Desktop
  const handleDeleteRow = (pkField: string, pkValue: unknown) => {
    if (!selectedDbId || !selectedTableName) return;

    try {
      if (
        typeof window !== 'undefined' &&
        // @ts-expect-error window.go may be undefined
        window?.go?.app?.App?.DeleteRow
      ) {
        AppBindings.DeleteRow(selectedDbId, selectedTableName, JSON.stringify({ [pkField]: pkValue }));
      }
    } catch {
      // Safe fallback
    }

    // Optimistically remove row locally
    deleteRowLocally(pkField, pkValue);

    // Record mutation event
    addMutation({
      id: `mut_del_${Date.now()}`,
      databaseId: selectedDbId,
      tableName: selectedTableName,
      type: 'DELETE',
      timestamp: Date.now(),
      query: `DELETE FROM ${selectedTableName} WHERE ${pkField} = ${JSON.stringify(pkValue)};`,
      durationMs: 0.9,
      affected: 1,
    });
  };

  return (
    <SplitLayout
      onRefresh={() => handleRequestTableData(page)}
      onRequestPage={(p) => handleRequestTableData(p)}
      onExecuteQuery={handleExecuteQuery}
      onUpdateRow={handleUpdateRow}
      onDeleteRow={handleDeleteRow}
    />
  );
}

export default App;
