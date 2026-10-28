import { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Trash2,
  RefreshCw,
  Clock,
  Save,
  Check,
  Copy,
  Loader2,
  Database,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useConnectionManagerStore } from '@/stores/useConnectionManagerStore';

const TYPE_COLORS: Record<string, string> = {
  string: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  hash: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  list: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  set: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  zset: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
};

export function RedisKeyViewer() {
  const redisScanResult = useConnectionManagerStore((s) => s.redisScanResult);
  const selectedRedisKey = useConnectionManagerStore((s) => s.selectedRedisKey);
  const redisKeyValue = useConnectionManagerStore((s) => s.redisKeyValue);
  const isLoadingRedis = useConnectionManagerStore((s) => s.isLoadingRedis);

  const scanRedisKeys = useConnectionManagerStore((s) => s.scanRedisKeys);
  const inspectRedisKey = useConnectionManagerStore((s) => s.inspectRedisKey);
  const deleteRedisKey = useConnectionManagerStore((s) => s.deleteRedisKey);
  const setRedisKey = useConnectionManagerStore((s) => s.setRedisKey);

  const [patternInput, setPatternInput] = useState('*');
  const [keyFilter, setKeyFilter] = useState('');
  const [editedValue, setEditedValue] = useState('');
  const [editedTtl, setEditedTtl] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isAddKeyOpen, setIsAddKeyOpen] = useState(false);

  // New key form
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyType, setNewKeyType] = useState('string');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [newKeyTtl, setNewKeyTtl] = useState(0);

  useEffect(() => {
    if (redisKeyValue) {
      if (typeof redisKeyValue.value === 'object' && redisKeyValue.value !== null) {
        setEditedValue(JSON.stringify(redisKeyValue.value, null, 2));
      } else {
        setEditedValue(String(redisKeyValue.value ?? ''));
      }
      setEditedTtl(redisKeyValue.ttlSec || 0);
    }
  }, [redisKeyValue]);

  const handleSearch = () => {
    scanRedisKeys(patternInput);
  };

  const handleSelectKey = (key: string) => {
    inspectRedisKey(key);
  };

  const handleDeleteKey = async (key: string) => {
    if (confirm(`Are you sure you want to delete Redis key "${key}"?`)) {
      await deleteRedisKey(key);
    }
  };

  const handleSaveValue = async () => {
    if (!selectedRedisKey || !redisKeyValue) return;
    setIsSaving(true);
    try {
      await setRedisKey(selectedRedisKey, redisKeyValue.type, editedValue, editedTtl);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return;
    setIsSaving(true);
    try {
      await setRedisKey(newKeyName.trim(), newKeyType, newKeyValue, newKeyTtl);
      setIsAddKeyOpen(false);
      setNewKeyName('');
      setNewKeyValue('');
      setNewKeyTtl(0);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyValue = () => {
    navigator.clipboard.writeText(editedValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const keys = (redisScanResult?.keys || []).filter((k) =>
    k.key.toLowerCase().includes(keyFilter.toLowerCase())
  );

  return (
    <div className="flex-1 flex overflow-hidden bg-background">
      {/* Left Pane: Keys List */}
      <div className="w-80 border-r border-border/80 flex flex-col bg-card/30">
        {/* Top Pattern Search Bar */}
        <div className="p-3 border-b border-border/70 space-y-2">
          <div className="flex gap-2">
            <Input
              value={patternInput}
              onChange={(e) => setPatternInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="SCAN pattern (e.g. * or user:*)"
              className="h-8 text-xs font-mono bg-background/70"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleSearch}
              className="h-8 text-xs px-2.5 shrink-0"
              title="Execute SCAN with pattern"
            >
              <RefreshCw className={`size-3.5 ${isLoadingRedis ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2 size-3 text-muted-foreground" />
              <Input
                value={keyFilter}
                onChange={(e) => setKeyFilter(e.target.value)}
                placeholder="Filter loaded keys..."
                className="pl-7 h-7 text-xs bg-muted/30"
              />
            </div>
            <Button
              variant="default"
              size="sm"
              onClick={() => setIsAddKeyOpen(true)}
              className="h-7 text-xs px-2.5 gap-1 bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
              title="Add new Redis key"
            >
              <Plus className="size-3" />
              <span>Add</span>
            </Button>
          </div>
        </div>

        {/* Keys List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {keys.length === 0 ? (
            <div className="text-center py-10 text-xs text-muted-foreground px-4">
              {isLoadingRedis ? 'Scanning Redis keys...' : 'No Redis keys match the current pattern.'}
            </div>
          ) : (
            keys.map((k) => {
              const isSelected = selectedRedisKey === k.key;
              const typeColor = TYPE_COLORS[k.type] || 'bg-muted text-muted-foreground border-border';
              const ttlLabel = k.ttlSec <= 0 ? 'no ttl' : `${k.ttlSec}s`;

              return (
                <div
                  key={k.key}
                  onClick={() => handleSelectKey(k.key)}
                  className={`group flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/10 shadow-xs'
                      : 'border-transparent hover:border-border/60 hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className={`text-[9px] uppercase font-mono px-1.5 py-0.2 rounded border ${typeColor}`}>
                      {k.type}
                    </span>
                    <span className="font-mono text-xs truncate text-foreground">{k.key}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-muted-foreground font-mono">{ttlLabel}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteKey(k.key);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 rounded transition-opacity"
                      title="Delete key"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Status Bottom */}
        <div className="h-9 border-t border-border/70 px-3 flex items-center justify-between text-[11px] text-muted-foreground bg-muted/20">
          <span>{keys.length} keys loaded</span>
          {redisScanResult?.durationMs !== undefined && (
            <span className="font-mono">{redisScanResult.durationMs}ms</span>
          )}
        </div>
      </div>

      {/* Right Pane: Key & Value Editor */}
      <div className="flex-1 flex flex-col overflow-hidden bg-card">
        {selectedRedisKey && redisKeyValue ? (
          <>
            {/* Value Top Bar */}
            <div className="h-12 border-b border-border/80 px-4 flex items-center justify-between bg-muted/30 shrink-0">
              <div className="flex items-center gap-3">
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase ${TYPE_COLORS[redisKeyValue.type] || ''}`}>
                  {redisKeyValue.type}
                </span>
                <span className="font-mono text-xs font-semibold text-foreground truncate max-w-md">
                  {selectedRedisKey}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="size-3.5 text-amber-400" />
                  <span>TTL:</span>
                  <Input
                    type="number"
                    value={editedTtl}
                    onChange={(e) => setEditedTtl(Number(e.target.value))}
                    className="w-20 h-7 text-xs font-mono"
                    title="Time To Live in seconds (-1 for no expiry)"
                  />
                  <span>sec</span>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyValue}
                  className="h-7 text-xs gap-1.5"
                >
                  {copied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </Button>

                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSaveValue}
                  disabled={isSaving}
                  className="h-7 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  {isSaving ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
                  <span>Save</span>
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteKey(selectedRedisKey)}
                  className="h-7 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 gap-1.5"
                >
                  <Trash2 className="size-3" />
                  <span>Delete</span>
                </Button>
              </div>
            </div>

            {/* Value Textarea Editor */}
            <div className="flex-1 p-4 overflow-hidden flex flex-col">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Value Content</span>
                <span className="text-[10px] lowercase font-normal opacity-70">
                  {editedValue.length} characters
                </span>
              </label>
              <textarea
                value={editedValue}
                onChange={(e) => setEditedValue(e.target.value)}
                className="flex-1 w-full p-3 font-mono text-xs rounded-lg border border-border/80 bg-muted/20 text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed"
                placeholder="Redis value payload..."
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <Database className="size-10 text-muted-foreground/30 mb-3" />
            <h3 className="text-sm font-semibold text-foreground mb-1">No Redis Key Selected</h3>
            <p className="text-xs max-w-sm text-muted-foreground">
              Select a key from the list on the left to inspect its type, TTL, and payload, or click "Add" to set a new key.
            </p>
          </div>
        )}
      </div>

      {/* Add Key Modal */}
      {isAddKeyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-card border border-border/80 rounded-xl shadow-2xl overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <Plus className="size-4 text-primary" />
                <h3 className="text-sm font-semibold">Add New Redis Key</h3>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setIsAddKeyOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </Button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-xs font-medium mb-1">Key Name</label>
                <Input
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="e.g. app:session:token_123"
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Type</label>
                  <select
                    value={newKeyType}
                    onChange={(e) => setNewKeyType(e.target.value)}
                    className="w-full h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground"
                  >
                    <option value="string">STRING</option>
                    <option value="hash">HASH (JSON)</option>
                    <option value="list">LIST</option>
                    <option value="set">SET</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">TTL (Seconds, 0 = infinite)</label>
                  <Input
                    type="number"
                    value={newKeyTtl}
                    onChange={(e) => setNewKeyTtl(Number(e.target.value))}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Initial Value</label>
                <textarea
                  value={newKeyValue}
                  onChange={(e) => setNewKeyValue(e.target.value)}
                  placeholder="Payload..."
                  className="w-full h-28 p-2 text-xs font-mono rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddKeyOpen(false)}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleCreateKey}
                disabled={isSaving || !newKeyName.trim()}
                className="h-8 text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                <span>Set Key</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
