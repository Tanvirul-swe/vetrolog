import { useState, useEffect, useCallback } from 'react';
import {
  Database,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  Loader2,
  Server,
  FolderOpen,
  Shield,
  X,
  Search,
  Eye,
  EyeOff,
  Terminal,
  Link2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ConnectionConfig,
  ConnectionSummary,
  EngineType,
  EnvironmentType,
  ColorTag,
} from '@/types/database';
import { useConnectionManagerStore } from '@/stores/useConnectionManagerStore';

interface ConnectionManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_PORTS: Record<EngineType, number> = {
  postgres: 5432,
  mysql: 3306,
  mariadb: 3306,
  redis: 6379,
  sqlite: 0,
  mssql: 1433,
};

const DEFAULT_CONFIG: ConnectionConfig = {
  name: 'New Connection',
  engine: 'postgres',
  host: '127.0.0.1',
  port: 5432,
  user: 'postgres',
  password: '',
  database: 'postgres',
  schema: 'public',
  sslMode: 'disable',
  colorTag: 'blue',
  environment: 'development',
  safeMode: false,
};

const COLOR_MAP: Record<ColorTag, string> = {
  blue: 'bg-blue-500',
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-rose-500',
  purple: 'bg-purple-500',
};

const ENV_BADGES: Record<EnvironmentType, { label: string; className: string }> = {
  production: { label: 'PROD', className: 'bg-rose-500/15 text-rose-400 border-rose-500/30' },
  staging: { label: 'STAGE', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  development: { label: 'DEV', className: 'bg-sky-500/15 text-sky-400 border-sky-500/30' },
  local: { label: 'LOCAL', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
};

export function ConnectionManagerModal({ isOpen, onClose }: ConnectionManagerModalProps) {
  const savedConnections = useConnectionManagerStore((s) => s.savedConnections);
  const loadSavedConnections = useConnectionManagerStore((s) => s.loadSavedConnections);
  const getSavedConnection = useConnectionManagerStore((s) => s.getSavedConnection);
  const activeSession = useConnectionManagerStore((s) => s.activeSession);
  const saveConnection = useConnectionManagerStore((s) => s.saveConnection);
  const deleteConnection = useConnectionManagerStore((s) => s.deleteConnection);
  const testConnection = useConnectionManagerStore((s) => s.testConnection);
  const connect = useConnectionManagerStore((s) => s.connect);
  const openLocalFile = useConnectionManagerStore((s) => s.openLocalFile);
  const selectLocalFileDialog = useConnectionManagerStore((s) => s.selectLocalFileDialog);

  const [searchFilter, setSearchFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formConfig, setFormConfig] = useState<ConnectionConfig>(DEFAULT_CONFIG);
  const [showPassword, setShowPassword] = useState(false);
  const [showSshPassword, setShowSshPassword] = useState(false);

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    tested: boolean;
    success: boolean;
    latencyMs?: number;
    message?: string;
    error?: string;
  }>({ tested: false, success: false });

  const [isSaving, setIsSaving] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const handleSelectSaved = useCallback(async (conn: ConnectionSummary) => {
    setSelectedId(conn.id);
    setTestResult({ tested: false, success: false });
    setFormConfig((prev) => ({
      ...prev,
      id: conn.id,
      name: conn.name,
      engine: conn.engine,
      host: conn.host,
      port: conn.port,
      database: conn.database,
      colorTag: conn.colorTag,
      environment: conn.environment,
      safeMode: conn.safeMode,
      filePath: conn.filePath,
    }));

    // Fetch full decrypted credentials including user, password, ssh
    const full = await getSavedConnection(conn.id);
    if (full) {
      setFormConfig(full);
    }
  }, [getSavedConnection]);

  useEffect(() => {
    if (isOpen) {
      loadSavedConnections().then(async () => {
        const list = useConnectionManagerStore.getState().savedConnections;
        if (list.length > 0) {
          const lastId = localStorage.getItem('vetrolog_last_connection_id') || activeSession?.config.id || list[0].id;
          const found = list.find((c) => c.id === lastId) || list[0];
          setSelectedId(found.id);
          const full = await getSavedConnection(found.id);
          if (full) {
            setFormConfig(full);
          } else {
            handleSelectSaved(found);
          }
        }
      });
    }
  }, [isOpen, loadSavedConnections, activeSession?.config.id, getSavedConnection, handleSelectSaved]);

  const handleDirectConnect = async (conn: ConnectionSummary) => {
    setIsConnecting(true);
    try {
      if (conn.engine === 'sqlite' && conn.filePath) {
        localStorage.setItem('vetrolog_last_connection_id', conn.id);
        const ok = await openLocalFile(conn.filePath);
        if (ok) onClose();
      } else {
        localStorage.setItem('vetrolog_last_connection_id', conn.id);
        const ok = await connect(conn.id);
        if (ok) onClose();
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleNewConnection = () => {
    setSelectedId(null);
    setTestResult({ tested: false, success: false });
    setFormConfig(DEFAULT_CONFIG);
  };

  const handleEngineChange = (engine: EngineType) => {
    setFormConfig((prev) => ({
      ...prev,
      engine,
      port: DEFAULT_PORTS[engine] || prev.port,
      user: engine === 'mssql' ? 'sa' : engine === 'postgres' ? 'postgres' : engine === 'mysql' ? 'root' : prev.user,
      database: engine === 'postgres' ? 'postgres' : engine === 'mysql' ? 'mysql' : engine === 'mssql' ? 'master' : engine === 'redis' ? '0' : '',
      schema: engine === 'mssql' ? 'dbo' : engine === 'postgres' ? 'public' : '',
    }));
  };

  const [isImportUrlOpen, setIsImportUrlOpen] = useState(false);
  const [importUrlInput, setImportUrlInput] = useState('');
  const [importUrlError, setImportUrlError] = useState<string | null>(null);

  const handleImportUrl = () => {
    setImportUrlError(null);
    let trimmed = importUrlInput.trim();
    // Support DATABASE_URL='...' or DATABASE_URL="..." or raw URI
    trimmed = trimmed.replace(/^DATABASE_URL=['"]?/, '').replace(/['"]$/, '').trim();
    if (!trimmed) return;

    try {
      const parsed = new URL(trimmed);
      let engine: EngineType = 'postgres';
      if (parsed.protocol.startsWith('postgres')) engine = 'postgres';
      else if (parsed.protocol.startsWith('mysql')) engine = 'mysql';
      else if (parsed.protocol.startsWith('mariadb')) engine = 'mariadb';
      else if (parsed.protocol.startsWith('redis')) engine = 'redis';
      else {
        setImportUrlError('Unsupported database scheme: ' + parsed.protocol);
        return;
      }

      const dbName = parsed.pathname.replace(/^\//, '') || (engine === 'postgres' ? 'postgres' : engine === 'redis' ? '0' : 'mysql');
      const sslMode = parsed.searchParams.get('sslmode') || (parsed.searchParams.get('ssl') === 'true' ? 'require' : 'disable');
      const port = parsed.port ? parseInt(parsed.port, 10) : (DEFAULT_PORTS[engine] || 5432);

      setSelectedId(null);
      setTestResult({ tested: false, success: false });
      setFormConfig({
        name: `${parsed.hostname.split('.')[0]} (${dbName})`,
        engine,
        host: parsed.hostname,
        port,
        user: decodeURIComponent(parsed.username || ''),
        password: decodeURIComponent(parsed.password || ''),
        database: decodeURIComponent(dbName),
        sslMode,
        colorTag: 'green',
        environment: 'development',
        safeMode: false,
      });

      setIsImportUrlOpen(false);
      setImportUrlInput('');
    } catch (err) {
      setImportUrlError('Invalid connection URL: ' + String(err));
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult({ tested: false, success: false });
    try {
      const res = await testConnection(formConfig);
      setTestResult({
        tested: true,
        success: res.success,
        latencyMs: res.latencyMs,
        message: res.success
          ? `${res.message || 'Connected successfully'} (credentials saved)`
          : res.message,
        error: res.error,
      });

      // Auto-save credentials when test connection succeeds!
      if (res.success) {
        const saved = await saveConnection(formConfig);
        if (saved) {
          setSelectedId(saved.id);
          setFormConfig((prev) => ({ ...prev, id: saved.id }));
          localStorage.setItem('vetrolog_last_connection_id', saved.id);
        }
      }
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const saved = await saveConnection(formConfig);
      if (saved) {
        setSelectedId(saved.id);
        setFormConfig((prev) => ({ ...prev, id: saved.id }));
        localStorage.setItem('vetrolog_last_connection_id', saved.id);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      if (formConfig.engine === 'sqlite' && formConfig.filePath) {
        const saved = await saveConnection(formConfig);
        if (saved) {
          setSelectedId(saved.id);
          localStorage.setItem('vetrolog_last_connection_id', saved.id);
        }
        const ok = await openLocalFile(formConfig.filePath);
        if (ok) onClose();
      } else {
        // Auto-save credentials on connect so user doesn't need to re-enter
        const saved = await saveConnection(formConfig);
        if (saved) {
          setSelectedId(saved.id);
          setFormConfig((prev) => ({ ...prev, id: saved.id }));
          localStorage.setItem('vetrolog_last_connection_id', saved.id);
          const ok = await connect(saved.id);
          if (ok) onClose();
        }
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    if (confirm('Are you sure you want to delete this connection profile?')) {
      await deleteConnection(selectedId);
      handleNewConnection();
    }
  };

  const handleBrowseSQLite = async () => {
    const path = await selectLocalFileDialog();
    if (path) {
      setFormConfig((prev) => ({
        ...prev,
        engine: 'sqlite',
        name: path.split('/').pop() || 'SQLite Database',
        filePath: path,
      }));
    }
  };

  const filteredConnections = savedConnections.filter(
    (c) =>
      c.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      c.database.toLowerCase().includes(searchFilter.toLowerCase()) ||
      c.host.toLowerCase().includes(searchFilter.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-4xl h-[650px] bg-card border border-border/80 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Top Header */}
        <div className="h-12 border-b border-border/70 px-4 flex items-center justify-between bg-muted/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <Server className="size-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Connection Manager</h2>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* Main Content: 2 Columns */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Saved Connections List */}
          <div className="w-72 border-r border-border/70 flex flex-col bg-muted/20">
            {/* Top Toolbar */}
            <div className="p-3 border-b border-border/70 space-y-2">
              <Button
                variant="default"
                size="sm"
                onClick={handleNewConnection}
                className="w-full h-8 text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
              >
                <Plus className="size-3.5" />
                <span>New Connection</span>
              </Button>

              <div className="grid grid-cols-2 gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsImportUrlOpen(true)}
                  className="h-8 text-[11px] px-2 gap-1 border-border/80 hover:bg-muted"
                  title="Import from Connection URL (DATABASE_URL)"
                >
                  <Link2 className="size-3 text-sky-400" />
                  <span>Import URL</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBrowseSQLite}
                  className="h-8 text-[11px] px-2 gap-1 border-dashed border-border/80 hover:bg-muted"
                  title="Open local .sqlite / .db file"
                >
                  <FolderOpen className="size-3 text-amber-400" />
                  <span>Open .db</span>
                </Button>
              </div>

              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                <Input
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Filter connections..."
                  className="pl-8 h-8 text-xs bg-background/60"
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredConnections.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground px-4">
                  No connections saved yet. Click "New Connection" or "Open Local SQLite File".
                </div>
              ) : (
                filteredConnections.map((conn) => {
                  const isSelected = selectedId === conn.id;
                  const env = ENV_BADGES[conn.environment] || ENV_BADGES.local;

                  return (
                    <button
                      key={conn.id}
                      type="button"
                      onClick={() => handleSelectSaved(conn)}
                      onDoubleClick={() => handleDirectConnect(conn)}
                      title="Click to edit credentials, double-click to connect immediately"
                      className={`group w-full text-left p-2.5 rounded-lg border transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/10 shadow-xs'
                          : 'border-transparent hover:border-border hover:bg-muted/40'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5 font-medium text-xs text-foreground truncate">
                          <span className={`size-2 rounded-full ${COLOR_MAP[conn.colorTag] || 'bg-blue-500'}`} />
                          <span className="truncate">{conn.name}</span>
                        </div>
                        <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${env.className}`}>
                          {env.label}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                        <span className="truncate">
                          {conn.engine === 'sqlite' ? conn.filePath || conn.database : `${conn.host}:${conn.port}`}
                        </span>
                        <span className="text-[10px] text-primary opacity-0 group-hover:opacity-100 transition-opacity font-sans font-medium">
                          Connect →
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Connection Form */}
          <div className="flex-1 flex flex-col bg-card overflow-y-auto p-5">
            {/* Engine Picker Cards */}
            <div className="mb-5">
              <label className="text-xs font-semibold text-muted-foreground block mb-2">
                DATABASE ENGINE
              </label>
              <div className="grid grid-cols-5 gap-2">
                {[
                  { engine: 'postgres', label: 'PostgreSQL', port: 5432, desc: 'Pure Go pgx' },
                  { engine: 'mysql', label: 'MySQL / MariaDB', port: 3306, desc: 'Pure Go MySQL' },
                  { engine: 'mssql', label: 'SQL Server', port: 1433, desc: 'MSSQL / Azure' },
                  { engine: 'redis', label: 'Redis Studio', port: 6379, desc: 'Key-Value Engine' },
                  { engine: 'sqlite', label: 'Local SQLite', port: 0, desc: 'Desktop .db file' },
                ].map((item) => {
                  const isSelected = formConfig.engine === item.engine;
                  return (
                    <button
                      key={item.engine}
                      type="button"
                      onClick={() => handleEngineChange(item.engine as EngineType)}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary/40 shadow-xs'
                          : 'border-border/70 hover:border-border bg-muted/20 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <div className="font-semibold text-xs text-foreground">{item.label}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{item.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Connection Identity & Environment */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="col-span-2">
                <label className="text-xs font-medium text-foreground block mb-1">Connection Name</label>
                <Input
                  value={formConfig.name}
                  onChange={(e) => setFormConfig({ ...formConfig, name: e.target.value })}
                  placeholder="Production PostgreSQL"
                  className="h-8 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">Environment</label>
                <select
                  value={formConfig.environment}
                  onChange={(e) => setFormConfig({ ...formConfig, environment: e.target.value as EnvironmentType })}
                  className="w-full h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="production">Production (Alerts)</option>
                  <option value="staging">Staging</option>
                  <option value="development">Development</option>
                  <option value="local">Local</option>
                </select>
              </div>
            </div>

            {/* Local SQLite Mode Form */}
            {formConfig.engine === 'sqlite' ? (
              <div className="p-4 rounded-lg border border-border/80 bg-muted/20 space-y-3 mb-4">
                <label className="text-xs font-medium text-foreground block">Local SQLite File Path</label>
                <div className="flex gap-2">
                  <Input
                    value={formConfig.filePath || ''}
                    onChange={(e) => setFormConfig({ ...formConfig, filePath: e.target.value })}
                    placeholder="/path/to/database.db or .sqlite"
                    className="h-8 text-xs font-mono"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBrowseSQLite}
                    className="h-8 text-xs gap-1.5 shrink-0"
                  >
                    <FolderOpen className="size-3.5" />
                    <span>Browse</span>
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Directly inspects, modifies, and commits to any SQLite database file on your Mac/PC with zero ADB setup.
                </p>
              </div>
            ) : (
              /* Remote Server Form */
              <>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-foreground block mb-1">Host / IP</label>
                    <Input
                      value={formConfig.host}
                      onChange={(e) => setFormConfig({ ...formConfig, host: e.target.value })}
                      placeholder="127.0.0.1 or db.internal.net"
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">Port</label>
                    <Input
                      type="number"
                      value={formConfig.port}
                      onChange={(e) => setFormConfig({ ...formConfig, port: Number(e.target.value) })}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">User</label>
                    <Input
                      value={formConfig.user}
                      onChange={(e) => setFormConfig({ ...formConfig, user: e.target.value })}
                      placeholder="postgres / root"
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">Password</label>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={formConfig.password || ''}
                        onChange={(e) => setFormConfig({ ...formConfig, password: e.target.value })}
                        placeholder="••••••••"
                        className="h-8 text-xs font-mono pr-8"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">
                      {formConfig.engine === 'redis' ? 'Database Index' : 'Database Name'}
                    </label>
                    <Input
                      value={formConfig.database}
                      onChange={(e) => setFormConfig({ ...formConfig, database: e.target.value })}
                      placeholder={formConfig.engine === 'redis' ? '0' : 'app_db'}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">SSL Mode</label>
                    <select
                      value={formConfig.sslMode}
                      onChange={(e) => setFormConfig({ ...formConfig, sslMode: e.target.value })}
                      className="w-full h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="disable">Disable</option>
                      <option value="require">Require (SSL)</option>
                      <option value="verify-ca">Verify CA</option>
                      <option value="verify-full">Verify Full</option>
                    </select>
                  </div>
                </div>

                {/* SSH Bastion Tunnel Options */}
                <div className="border border-border/70 rounded-lg p-3 bg-muted/20 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <Shield className="size-3.5 text-primary" />
                      <span>SSH Bastion Tunnel</span>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={formConfig.ssh?.enabled || false}
                        onChange={(e) =>
                          setFormConfig({
                            ...formConfig,
                            ssh: {
                              enabled: e.target.checked,
                              host: formConfig.ssh?.host || '',
                              port: formConfig.ssh?.port || 22,
                              user: formConfig.ssh?.user || '',
                              authMethod: formConfig.ssh?.authMethod || 'password',
                              password: formConfig.ssh?.password || '',
                            },
                          })
                        }
                        className="rounded border-border text-primary focus:ring-0"
                      />
                      <span className="text-muted-foreground">Enable Tunnel</span>
                    </label>
                  </div>

                  {formConfig.ssh?.enabled && (
                    <div className="grid grid-cols-3 gap-2.5 pt-2 border-t border-border/60">
                      <div className="col-span-2">
                        <label className="text-[11px] text-muted-foreground block mb-1">SSH Host</label>
                        <Input
                          value={formConfig.ssh.host}
                          onChange={(e) =>
                            setFormConfig({
                              ...formConfig,
                              ssh: { ...formConfig.ssh!, host: e.target.value },
                            })
                          }
                          placeholder="bastion.example.com"
                          className="h-7 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-muted-foreground block mb-1">SSH Port</label>
                        <Input
                          type="number"
                          value={formConfig.ssh.port}
                          onChange={(e) =>
                            setFormConfig({
                              ...formConfig,
                              ssh: { ...formConfig.ssh!, port: Number(e.target.value) },
                            })
                          }
                          className="h-7 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-muted-foreground block mb-1">SSH User</label>
                        <Input
                          value={formConfig.ssh.user}
                          onChange={(e) =>
                            setFormConfig({
                              ...formConfig,
                              ssh: { ...formConfig.ssh!, user: e.target.value },
                            })
                          }
                          placeholder="ubuntu"
                          className="h-7 text-xs font-mono"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[11px] text-muted-foreground block mb-1">SSH Password</label>
                        <div className="relative">
                          <Input
                            type={showSshPassword ? 'text' : 'password'}
                            value={formConfig.ssh.password || ''}
                            onChange={(e) =>
                              setFormConfig({
                                ...formConfig,
                                ssh: { ...formConfig.ssh!, password: e.target.value },
                              })
                            }
                            placeholder="SSH Password"
                            className="h-7 text-xs font-mono pr-8"
                          />
                          <button
                            type="button"
                            onClick={() => setShowSshPassword(!showSshPassword)}
                            className="absolute right-2 top-1.5 text-muted-foreground hover:text-foreground"
                          >
                            {showSshPassword ? <EyeOff className="size-3 text-muted-foreground" /> : <Eye className="size-3 text-muted-foreground" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Test Connection Result Box */}
            {testResult.tested && (
              <div
                className={`p-3 rounded-lg border text-xs flex items-center justify-between mb-4 ${
                  testResult.success
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                }`}
              >
                <div className="flex items-center gap-2">
                  {testResult.success ? <Check className="size-4" /> : <AlertCircle className="size-4" />}
                  <span>
                    {testResult.success
                      ? `Connection successful (${testResult.latencyMs}ms)`
                      : testResult.error || 'Connection failed'}
                  </span>
                </div>
                {testResult.success && (
                  <span className="font-mono text-[10px] opacity-80">TLS/Ready</span>
                )}
              </div>
            )}

            {/* Bottom Actions */}
            <div className="mt-auto pt-4 border-t border-border/70 flex items-center justify-between">
              <div>
                {selectedId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDelete}
                    className="h-8 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 gap-1.5"
                  >
                    <Trash2 className="size-3.5" />
                    <span>Delete</span>
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTest}
                  disabled={isTesting || isConnecting}
                  className="h-8 text-xs gap-1.5"
                >
                  {isTesting ? <Loader2 className="size-3.5 animate-spin" /> : <Terminal className="size-3.5" />}
                  <span>Test Connection</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving || isConnecting}
                  className="h-8 text-xs gap-1.5"
                >
                  {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                  <span>Save</span>
                </Button>

                <Button
                  variant="default"
                  size="sm"
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className="h-8 text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                >
                  {isConnecting ? <Loader2 className="size-3.5 animate-spin" /> : <Database className="size-3.5" />}
                  <span>Connect</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Import URL Modal */}
      {isImportUrlOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-card border border-border/80 rounded-xl shadow-2xl overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <Link2 className="size-4 text-sky-400" />
                <h3 className="text-sm font-semibold text-foreground">Import Connection URL</h3>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  setIsImportUrlOpen(false);
                  setImportUrlError(null);
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </Button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Paste your database connection string or <code className="text-foreground font-mono bg-muted px-1.5 py-0.5 rounded text-[11px]">DATABASE_URL</code> (PostgreSQL, MySQL, Redis):
              </p>
              <textarea
                value={importUrlInput}
                onChange={(e) => setImportUrlInput(e.target.value)}
                placeholder="postgresql://user:password@ep-sample.neon.tech/neondb?sslmode=require"
                rows={4}
                className="w-full p-2.5 text-xs font-mono rounded-lg border border-border bg-muted/20 text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed"
              />
              {importUrlError && (
                <div className="text-xs text-rose-400 flex items-center gap-1.5">
                  <AlertCircle className="size-3.5 shrink-0" />
                  <span>{importUrlError}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsImportUrlOpen(false);
                  setImportUrlError(null);
                }}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleImportUrl}
                disabled={!importUrlInput.trim()}
                className="h-8 text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
              >
                <Check className="size-3.5" />
                <span>Parse & Populate Form</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
