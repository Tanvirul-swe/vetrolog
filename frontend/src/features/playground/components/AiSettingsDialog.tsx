import React, { useState } from 'react';
import { Settings, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AIProvider } from '@/types/database';
import { usePlaygroundStore } from '@/stores/usePlaygroundStore';

export function AiSettingsDialog() {
  const isOpen = usePlaygroundStore((s) => s.isAiSettingsOpen);
  const setIsOpen = usePlaygroundStore((s) => s.setIsAiSettingsOpen);
  const aiConfig = usePlaygroundStore((s) => s.aiConfig);
  const setAiConfig = usePlaygroundStore((s) => s.setAiConfig);

  const [provider, setProvider] = useState<AIProvider>(aiConfig.provider);
  const [geminiKey, setGeminiKey] = useState(aiConfig.geminiApiKey || '');
  const [openaiKey, setOpenaiKey] = useState(aiConfig.openaiApiKey || '');
  const [ollamaUrl, setOllamaUrl] = useState(aiConfig.ollamaBaseUrl || 'http://localhost:11434');
  const [modelName, setModelName] = useState(aiConfig.modelName || 'gemini-1.5-flash');
  const [saved, setSaved] = useState(false);

  if (!isOpen) return null;

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
                  setModelName('gemini-1.5-flash');
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
            <div className="space-y-2 pt-2 border-t border-border/40 font-mono text-xs">
              <label className="text-xs font-sans font-medium text-foreground">Gemini API Key</label>
              <Input
                type="password"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="h-8 text-xs font-mono"
              />
              <p className="text-[11px] font-sans text-muted-foreground">
                Keys are stored strictly in your local browser storage. Get a free key at aistudio.google.com.
              </p>
            </div>
          )}

          {provider === 'openai' && (
            <div className="space-y-2 pt-2 border-t border-border/40 font-mono text-xs">
              <label className="text-xs font-sans font-medium text-foreground">OpenAI API Key</label>
              <Input
                type="password"
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder="sk-..."
                className="h-8 text-xs font-mono"
              />
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
