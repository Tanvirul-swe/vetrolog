import React, { useState, useMemo } from 'react';
import { Code2, Copy, Check, X, Smartphone, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePlaygroundStore } from '@/stores/usePlaygroundStore';

type TargetPlatform = 'flutter' | 'kotlin' | 'swift' | 'go';

export function CodeGeneratorModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const query = usePlaygroundStore((s) => s.query);
  const [platform, setPlatform] = useState<TargetPlatform>('flutter');
  const [copied, setCopied] = useState(false);

  const cleanQuery = query.trim().replace(/;+$/, '');

  const generatedSnippet = useMemo(() => {
    switch (platform) {
      case 'flutter':
        return `// Flutter / Dart (sqflite or Drift)
import 'package:sqflite/sqflite.dart';

Future<List<Map<String, dynamic>>> fetchQueryResult(Database db) async {
  final List<Map<String, dynamic>> results = await db.rawQuery(
    '''
    ${cleanQuery};
    ''',
  );
  return results;
}`;

      case 'kotlin':
        return `// Android / Kotlin (Android Room DAO)
import androidx.room.Dao
import androidx.room.Query

@Dao
interface AppDatabaseDao {
    @Query(
        """
        ${cleanQuery}
        """
    )
    suspend fun executeQuery(): List<Map<String, Any>>
}`;

      case 'swift':
        return `// iOS / Swift (GRDB.swift)
import GRDB

func executeQuery(db: Database) throws -> [Row] {
    let sql = """
    ${cleanQuery};
    """
    let rows = try Row.fetchAll(db, sql: sql)
    return rows
}`;

      case 'go':
        return `// Go (database/sql)
package main

import (
	"context"
	"database/sql"
)

func ExecuteQuery(ctx context.Context, db *sql.DB) (*sql.Rows, error) {
	query := \`${cleanQuery};\`
	return db.QueryContext(ctx, query)
}`;
    }
  }, [platform, cleanQuery]);

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 select-none animate-in fade-in">
      <div className="w-full max-w-2xl bg-card border border-border/80 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="h-12 px-4 border-b border-border flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2">
            <Code2 className="size-4 text-primary" />
            <h3 className="font-semibold text-sm text-foreground">Mobile Query Code Generator</h3>
            <Badge variant="outline" className="text-[10px] font-mono">
              Auto-Typed
            </Badge>
          </div>
          <Button size="icon-sm" variant="ghost" onClick={onClose} className="size-7">
            <X className="size-3.5" />
          </Button>
        </div>

        {/* Platform Selector Tabs */}
        <div className="p-3 border-b border-border/40 bg-muted/10 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant={platform === 'flutter' ? 'secondary' : 'ghost'}
              onClick={() => setPlatform('flutter')}
              className="h-7 text-xs gap-1.5"
            >
              <Smartphone className="size-3.5 text-sky-400" />
              <span>Flutter (Dart)</span>
            </Button>
            <Button
              size="sm"
              variant={platform === 'kotlin' ? 'secondary' : 'ghost'}
              onClick={() => setPlatform('kotlin')}
              className="h-7 text-xs gap-1.5"
            >
              <Smartphone className="size-3.5 text-indigo-400" />
              <span>Android (Room)</span>
            </Button>
            <Button
              size="sm"
              variant={platform === 'swift' ? 'secondary' : 'ghost'}
              onClick={() => setPlatform('swift')}
              className="h-7 text-xs gap-1.5"
            >
              <Smartphone className="size-3.5 text-orange-400" />
              <span>iOS (GRDB)</span>
            </Button>
            <Button
              size="sm"
              variant={platform === 'go' ? 'secondary' : 'ghost'}
              onClick={() => setPlatform('go')}
              className="h-7 text-xs gap-1.5"
            >
              <Terminal className="size-3.5 text-cyan-400" />
              <span>Go</span>
            </Button>
          </div>

          <Button size="sm" onClick={handleCopy} className="h-7 text-xs gap-1.5 font-medium">
            {copied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
            <span>{copied ? 'Copied' : 'Copy Snippet'}</span>
          </Button>
        </div>

        {/* Code Viewport */}
        <div className="h-72 p-3 overflow-auto bg-black/50 font-mono text-xs select-text leading-5">
          <pre className="text-foreground whitespace-pre-wrap">{generatedSnippet}</pre>
        </div>
      </div>
    </div>
  );
}
