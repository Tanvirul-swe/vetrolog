import { useEffect, useCallback } from 'react';
import { SplitLayout } from './components/layout/SplitLayout';
import { useWailsEvent } from './hooks/useWailsEvent';
import { EVENTS } from './constants/events';
import { useConnectionStore } from './stores/useConnectionStore';
import { useDatabaseStore } from './stores/useDatabaseStore';
import { useAdbStore } from './stores/useAdbStore';
import { useConnectionManagerStore } from './stores/useConnectionManagerStore';
import { useStagedChangesStore } from './stores/useStagedChangesStore';
import * as AppBindings from '../wailsjs/go/app/App';

export function App() {
  const setConnectionState = useConnectionStore((s) => s.setConnectionState);
  const setDeviceConnected = useConnectionStore((s) => s.setDeviceConnected);
  const setDeviceDisconnected = useConnectionStore((s) => s.setDeviceDisconnected);

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
    if (list && list.length > 0 && list[0].tables && list[0].tables.length > 0) {
      try {
        if (
          typeof window !== 'undefined' &&
          // @ts-expect-error window.go may be undefined
          window?.go?.app?.App?.RequestTableData
        ) {
          AppBindings.RequestTableData(list[0].id, list[0].tables[0].name, 1, pageSize);
        }
      } catch {
        // Safe fallback
      }
    }
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
  const handleRequestTableData = useCallback((targetPage = page) => {
    if (!selectedTableName) return;

    if (useConnectionManagerStore.getState().workspaceMode === 'remote') {
      const activeSession = useConnectionManagerStore.getState().activeSession;
      if (activeSession) {
        useConnectionManagerStore.getState().loadTableData(selectedTableName, targetPage, pageSize);
      }
      return;
    }

    if (useAdbStore.getState().isAdbMode) {
      useAdbStore.getState().loadTableData(selectedTableName, targetPage, pageSize);
      return;
    }

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
  }, [page, pageSize, selectedDbId, selectedTableName]);

  useEffect(() => {
    if (selectedTableName) {
      handleRequestTableData(1);
    }
  }, [selectedDbId, selectedTableName, handleRequestTableData]);

  // 5. Query execution trigger
  const handleExecuteQuery = (query: string) => {
    if (useConnectionManagerStore.getState().workspaceMode === 'remote') {
      useConnectionManagerStore.getState().executeRemoteQuery(query);
      return;
    }

    if (useAdbStore.getState().isAdbMode) {
      useAdbStore.getState().executeQuery(query);
      return;
    }

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
  };

  // 6. Data Editing / Mutation from Desktop
  const handleUpdateRow = (pkField: string, pkValue: unknown, newValues: Record<string, unknown>) => {
    if (!selectedTableName) return;

    if (useConnectionManagerStore.getState().workspaceMode === 'remote') {
      const selectedSchema = useConnectionManagerStore.getState().selectedSchema || 'public';
      const rows = useDatabaseStore.getState().rows;
      const currentRow = rows.find((r) => r[pkField] === pkValue);
      Object.entries(newValues).forEach(([col, newVal]) => {
        const oldVal = currentRow ? currentRow[col] : undefined;
        useStagedChangesStore.getState().stageCellUpdate(
          selectedSchema,
          selectedTableName,
          pkField,
          pkValue,
          col,
          oldVal,
          newVal
        );
      });
      updateRowLocally(pkField, pkValue, newValues);
      return;
    }

    if (useAdbStore.getState().isAdbMode) {
      useAdbStore.getState().updateRow(selectedTableName, { [pkField]: pkValue }, newValues);
      return;
    }

    if (!selectedDbId) return;

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
    if (!selectedTableName) return;

    if (useConnectionManagerStore.getState().workspaceMode === 'remote') {
      const selectedSchema = useConnectionManagerStore.getState().selectedSchema || 'public';
      const rows = useDatabaseStore.getState().rows;
      const currentRow = rows.find((r) => r[pkField] === pkValue);
      useStagedChangesStore.getState().stageRowDelete(
        selectedSchema,
        selectedTableName,
        pkField,
        pkValue,
        currentRow
      );
      deleteRowLocally(pkField, pkValue);
      return;
    }

    if (useAdbStore.getState().isAdbMode) {
      useAdbStore.getState().deleteRow(selectedTableName, { [pkField]: pkValue });
      return;
    }

    if (!selectedDbId) return;

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
