import React, { useState } from 'react';
import { Sparkles, ArrowRight, Settings, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { usePlaygroundStore } from '@/stores/usePlaygroundStore';
import { parseNaturalLanguageToSql } from '../services/offlineNlParser';
import { generateSqlWithAI } from '../services/aiService';

export function NaturalLanguageBar() {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; isError?: boolean } | null>(null);

  const extendedSchema = usePlaygroundStore((s) => s.extendedSchema);
  const setQuery = usePlaygroundStore((s) => s.setQuery);
  const runExecute = usePlaygroundStore((s) => s.runExecute);
  const aiConfig = usePlaygroundStore((s) => s.aiConfig);
  const setIsAiSettingsOpen = usePlaygroundStore((s) => s.setIsAiSettingsOpen);

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setFeedback(null);

    const tables = extendedSchema?.tables || [];

    try {
      if (aiConfig.provider === 'offline') {
        const result = parseNaturalLanguageToSql(prompt, tables);
        setQuery(result.sql);
        setFeedback({ message: `Offline engine: ${result.explanation}` });
      } else {
        const result = await generateSqlWithAI(prompt, tables, aiConfig);
        if (result.error) {
          setFeedback({ message: result.error, isError: true });
        } else if (result.sql) {
          setQuery(result.sql);
          setFeedback({ message: `AI Generated: ${result.sql}` });
        }
      }
    } catch (err: any) {
      setFeedback({ message: err.message || 'Failed to parse natural language', isError: true });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="p-2 border-b border-border/60 bg-muted/10 flex flex-col gap-1.5 select-none">
      <form onSubmit={handleGenerate} className="flex items-center gap-2">
        <div className="relative flex-1">
          <Sparkles className="absolute left-2.5 top-2.5 size-3.5 text-primary shrink-0" />
          <Input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask in plain English: (e.g. 'Show top 10 users created this week who haven't logged in')"
            className="pl-8 pr-20 h-8 text-xs bg-card/60 border-border/60 focus:bg-background"
          />
          <Badge
            variant="outline"
            className="absolute right-2 top-1.5 text-[9px] px-1 py-0 capitalize text-muted-foreground border-border/60"
          >
            {aiConfig.provider === 'offline' ? 'Offline Rule Engine' : `${aiConfig.provider} AI`}
          </Badge>
        </div>

        <Button
          type="submit"
          size="sm"
          disabled={!prompt.trim() || isGenerating}
          className="h-8 text-xs gap-1.5 shrink-0 bg-primary/90 hover:bg-primary font-medium"
        >
          <span>{isGenerating ? 'Thinking...' : 'Generate SQL'}</span>
          <ArrowRight className="size-3" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setIsAiSettingsOpen(true)}
          title="Configure AI Provider (Gemini / OpenAI / Ollama)"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
        >
          <Settings className="size-3.5" />
        </Button>
      </form>

      {/* Result & Feedback Banner */}
      {feedback && (
        <div
          className={`flex items-center justify-between text-[11px] px-2.5 py-1 rounded-md border font-mono animate-in fade-in duration-150 ${
            feedback.isError
              ? 'bg-destructive/10 border-destructive/30 text-red-400'
              : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
          }`}
        >
          <div className="flex items-center gap-2 truncate">
            {feedback.isError ? (
              <AlertCircle className="size-3.5 shrink-0" />
            ) : (
              <CheckCircle2 className="size-3.5 shrink-0 text-emerald-400" />
            )}
            <span className="truncate">{feedback.message}</span>
          </div>

          {!feedback.isError && (
            <button
              type="button"
              onClick={() => runExecute()}
              className="text-[10px] font-sans font-medium px-2 py-0.5 rounded bg-emerald-600 text-white hover:bg-emerald-500 ml-2 shrink-0 transition-colors"
            >
              Run Now
            </button>
          )}
        </div>
      )}
    </div>
  );
}
