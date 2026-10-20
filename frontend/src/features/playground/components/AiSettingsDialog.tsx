import React, { useState } from 'react';
import { Settings, X, Check, Sparkles, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AIProvider } from '@/types/database';
import { usePlaygroundStore } from '@/stores/usePlaygroundStore';
import { fetchAvailableGeminiModels } from '../services/aiService';

export function AiSettingsDialog() {
  const isOpen = usePlaygroundStore((s) => s.isAiSettingsOpen);
  const setIsOpen = usePlaygroundStore((s) => s.setIsAiSettingsOpen);
  const aiConfig = usePlaygroundStore((s) => s.aiConfig);
  const setAiConfig = usePlaygroundStore((s) => s.setAiConfig);

  const initialModel =
    aiConfig.modelName === 'gemini-1.5-flash' || !aiConfig.modelName
      ? 'gemini-2.5-flash'
      : aiConfig.modelName;

  const [provider, setProvider] = useState<AIProvider>(aiConfig.provider);
  const [geminiKey, setGeminiKey] = useState(aiConfig.geminiApiKey || '');
  const [openaiKey, setOpenaiKey] = useState(aiConfig.openaiApiKey || '');
  const [ollamaUrl, setOllamaUrl] = useState(aiConfig.ollamaBaseUrl || 'http://localhost:11434');
  const [modelName, setModelName] = useState(initialModel);
  const [saved, setSaved] = useState(false);

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [detectedGeminiModels, setDetectedGeminiModels] = useState<string[]>([]);

  if (!isOpen) return null;

  const handleTestGeminiKey = async () => {
    if (!geminiKey.trim()) return;
    setIsTesting(true);
    setTestResult(null);

    try {
      const models = await fetchAvailableGeminiModels(geminiKey.trim());
      setDetectedGeminiModels(models);

      const priority = [
        'gemini-2.5-flash',
        'gemini-2.0-flash',
        'gemini-2.0-flash-001',
        'gemini-1.5-flash-latest',
        'gemini-1.5-flash-8b',
        'gemini-2.5-pro',
      ];
      const recommended = priority.find((p) => models.includes(p)) || models[0] || 'gemini-2.5-flash';
      setModelName(recommended);
      setTestResult({
        success: true,
        message: `Connected! ${models.length} generation models available. Selected ${recommended}.`,
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Failed to connect with provided Gemini API key.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setAiConfig({
      provider,
      geminiApiKey: geminiKey.trim(),
      openaiApiKey: openaiKey.trim(),
      ollamaBaseUrl: ollamaUrl.trim(),
      modelName: modelName.trim(),
    });
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setIsOpen(false);
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 select-none animate-in fade-in">
      <div className="w-full max-w-lg bg-card border border-border/80 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="h-12 px-4 border-b border-border flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2">
            <Settings className="size-4 text-primary" />
            <h3 className="font-semibold text-sm text-foreground">Natural Language AI Settings</h3>
          </div>
          <Button size="icon-sm" variant="ghost" onClick={() => setIsOpen(false)} className="size-7">
            <X className="size-3.5" />
          </Button>
        </div>

        {/* Content */}
        <form onSubmit={handleSave} className="p-4 space-y-4">
          {/* Provider Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Query Translation Engine</label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setProvider('offline');
                  setModelName('');
                }}
                className={`p-2.5 rounded-lg border text-left flex flex-col gap-1 transition-colors ${
                  provider === 'offline'
                    ? 'border-primary bg-primary/10 text-foreground font-medium'
                    : 'border-border/60 hover:bg-muted/40 text-muted-foreground'
                }`}
              >
                <span className="font-semibold text-foreground">Offline Heuristics</span>
                <span className="text-[10px] text-muted-foreground">100% Private, zero setup</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setProvider('gemini');
                  setModelName('gemini-2.5-flash');
                  setTestResult(null);
                }}
                className={`p-2.5 rounded-lg border text-left flex flex-col gap-1 transition-colors ${
                  provider === 'gemini'
                    ? 'border-primary bg-primary/10 text-foreground font-medium'
                    : 'border-border/60 hover:bg-muted/40 text-muted-foreground'
                }`}
              >
                <span className="font-semibold text-foreground">Google Gemini</span>
                <span className="text-[10px] text-muted-foreground">Free API key supported</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setProvider('openai');
                  setModelName('gpt-4o-mini');
                }}
                className={`p-2.5 rounded-lg border text-left flex flex-col gap-1 transition-colors ${
                  provider === 'openai'
                    ? 'border-primary bg-primary/10 text-foreground font-medium'
                    : 'border-border/60 hover:bg-muted/40 text-muted-foreground'
                }`}
              >
                <span className="font-semibold text-foreground">OpenAI</span>
                <span className="text-[10px] text-muted-foreground">GPT-4o-mini / GPT-4</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setProvider('ollama');
                  setModelName('codellama');
                }}
                className={`p-2.5 rounded-lg border text-left flex flex-col gap-1 transition-colors ${
                  provider === 'ollama'
                    ? 'border-primary bg-primary/10 text-foreground font-medium'
                    : 'border-border/60 hover:bg-muted/40 text-muted-foreground'
                }`}
              >
                <span className="font-semibold text-foreground">Local Ollama</span>
                <span className="text-[10px] text-muted-foreground">Self-hosted local model</span>
              </button>
            </div>
          </div>

          {/* Conditional Credentials Input */}
          {provider === 'gemini' && (
            <div className="space-y-3 pt-2 border-t border-border/40 text-xs">
              <div className="space-y-1">
                <label className="text-xs font-sans font-medium text-foreground">Gemini API Key</label>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    value={geminiKey}
                    onChange={(e) => {
                      setGeminiKey(e.target.value);
                      setTestResult(null);
                    }}
                    placeholder="AIzaSy..."
                    className="h-8 text-xs font-mono flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleTestGeminiKey}
                    disabled={!geminiKey.trim() || isTesting}
                    className="h-8 text-[11px] gap-1.5 px-3 shrink-0"
                  >
                    {isTesting ? (
                      <Loader2 className="size-3 animate-spin text-primary" />
                    ) : (
                      <Sparkles className="size-3 text-primary" />
                    )}
                    <span>{isTesting ? 'Testing...' : 'Test & Detect'}</span>
                  </Button>
                </div>
                <p className="text-[11px] font-sans text-muted-foreground">
                  Get a free Gemini API key from{' '}
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    aistudio.google.com
                  </a>
                  . Stored locally in your browser.
                </p>
              </div>

              {/* Live Test Feedback Banner */}
              {testResult && (
                <div
                  className={`flex items-start gap-2 p-2 rounded-md border text-[11px] font-sans animate-in fade-in ${
                    testResult.success
                      ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                      : 'bg-destructive/10 border-destructive/30 text-red-400'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="size-3.5 mt-0.5 shrink-0 text-emerald-400" />
                  ) : (
                    <AlertCircle className="size-3.5 mt-0.5 shrink-0 text-red-400" />
                  )}
                  <span className="leading-tight">{testResult.message}</span>
                </div>
              )}

              {/* Model Dropdown Selection */}
              <div className="space-y-1">
                <label className="text-xs font-sans font-medium text-foreground">Gemini Model</label>
                <select
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  className="w-full h-8 px-2.5 text-xs bg-background border border-input rounded-md focus:outline-hidden focus:ring-1 focus:ring-ring text-foreground font-mono"
                >
                  <option value="gemini-2.5-flash">gemini-2.5-flash (Recommended — Fast & Smart)</option>
                  <option value="gemini-2.0-flash">gemini-2.0-flash (High speed multimodal)</option>
                  <option value="gemini-2.5-pro">gemini-2.5-pro (Complex reasoning & queries)</option>
                  <option value="gemini-1.5-flash-latest">gemini-1.5-flash-latest (Latest 1.5 build)</option>
                  <option value="gemini-1.5-flash-8b">gemini-1.5-flash-8b (Ultra-lightweight)</option>
                  {detectedGeminiModels
                    .filter(
                      (m) =>
                        ![
                          'gemini-2.5-flash',
                          'gemini-2.0-flash',
                          'gemini-2.5-pro',
                          'gemini-1.5-flash-latest',
                          'gemini-1.5-flash-8b',
                        ].includes(m)
                    )
                    .map((m) => (
                      <option key={m} value={m}>
                        {m} (Detected on your account)
                      </option>
                    ))}
                </select>
                <p className="text-[10px] text-muted-foreground">
                  Google deprecated older v1beta aliases. VetroLog uses active Gemini 2.5/2.0 models by default.
                </p>
              </div>
            </div>
          )}

          {provider === 'openai' && (
            <div className="space-y-3 pt-2 border-t border-border/40 text-xs">
              <div className="space-y-1">
                <label className="text-xs font-sans font-medium text-foreground">OpenAI API Key</label>
                <Input
                  type="password"
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  placeholder="sk-..."
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-sans font-medium text-foreground">Model Name</label>
                <select
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  className="w-full h-8 px-2.5 text-xs bg-background border border-input rounded-md focus:outline-hidden focus:ring-1 focus:ring-ring text-foreground font-mono"
                >
                  <option value="gpt-4o-mini">gpt-4o-mini (Recommended — Fast & Cost-effective)</option>
                  <option value="gpt-4o">gpt-4o (High capability)</option>
                  <option value="gpt-4-turbo">gpt-4-turbo</option>
                </select>
              </div>
            </div>
          )}

          {provider === 'ollama' && (
            <div className="space-y-2 pt-2 border-t border-border/40 font-mono text-xs">
              <label className="text-xs font-sans font-medium text-foreground">Ollama Server URL</label>
              <Input
                value={ollamaUrl}
                onChange={(e) => setOllamaUrl(e.target.value)}
                placeholder="http://localhost:11434"
                className="h-8 text-xs font-mono"
              />
              <label className="text-xs font-sans font-medium text-foreground">Model Name</label>
              <Input
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder="codellama or llama3"
                className="h-8 text-xs font-mono"
              />
            </div>
          )}

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-border flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
              className="h-8 text-xs"
            >
              Cancel
            </Button>

            <Button type="submit" size="sm" className="h-8 text-xs gap-1.5 font-medium">
              {saved ? <Check className="size-3 text-emerald-400" /> : null}
              <span>{saved ? 'Saved!' : 'Save Configuration'}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
