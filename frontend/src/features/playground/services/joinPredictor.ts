import { ExtendedTableSchema } from '@/types/database';
import { formatSqlIdentifier } from './sqlIdentifier';

export interface JoinPrediction {
  targetTable: string;
  sourceTable: string;
  sourceCol: string;
  targetCol: string;
  onClause: string;
  joinStatement: string;
  isForeignKey: boolean;
  confidence: number;
}

/**
 * Predicts join conditions between tables using SQLite foreign keys and naming conventions.
 */
export function predictJoins(
  currentTable: string,
  targetTable: string,
  schemaList: ExtendedTableSchema[]
): JoinPrediction[] {
  const current = schemaList.find((t) => t.name.toLowerCase() === currentTable.toLowerCase());
  const target = schemaList.find((t) => t.name.toLowerCase() === targetTable.toLowerCase());

  if (!current || !target) return [];

  const curT = formatSqlIdentifier(current.name);
  const tgtT = formatSqlIdentifier(target.name);

  const predictions: JoinPrediction[] = [];

  // 1. Direct Foreign Key: currentTable -> targetTable
  for (const fk of current.foreignKeys || []) {
    if (fk.toTable.toLowerCase() === target.name.toLowerCase()) {
      const fromCol = formatSqlIdentifier(fk.fromCol);
      const toCol = formatSqlIdentifier(fk.toCol || 'id');
      predictions.push({
        targetTable: target.name,
        sourceTable: current.name,
        sourceCol: fk.fromCol,
        targetCol: fk.toCol || 'id',
        onClause: `${curT}.${fromCol} = ${tgtT}.${toCol}`,
        joinStatement: `JOIN ${tgtT} ON ${curT}.${fromCol} = ${tgtT}.${toCol}`,
        isForeignKey: true,
        confidence: 1.0,
      });
    }
  }

  // 2. Reverse Foreign Key: targetTable -> currentTable
  for (const fk of target.foreignKeys || []) {
    if (fk.toTable.toLowerCase() === current.name.toLowerCase()) {
      const fromCol = formatSqlIdentifier(fk.fromCol);
      const toCol = formatSqlIdentifier(fk.toCol || 'id');
      predictions.push({
        targetTable: target.name,
        sourceTable: current.name,
        sourceCol: fk.toCol || 'id',
        targetCol: fk.fromCol,
        onClause: `${curT}.${toCol} = ${tgtT}.${fromCol}`,
        joinStatement: `JOIN ${tgtT} ON ${curT}.${toCol} = ${tgtT}.${fromCol}`,
        isForeignKey: true,
        confidence: 0.95,
      });
    }
  }

  // 3. Naming Convention: <target_singular>_id in currentTable
  const targetSingular = target.name.endsWith('s') ? target.name.slice(0, -1) : target.name;
  const targetIdPattern = `${targetSingular.toLowerCase()}_id`;
  const matchingFromCol = current.columns.find((c) => c.name.toLowerCase() === targetIdPattern);

  if (matchingFromCol) {
    const targetPk = target.columns.find((c) => c.isPrimaryKey)?.name || 'id';
    const fromCol = formatSqlIdentifier(matchingFromCol.name);
    const toCol = formatSqlIdentifier(targetPk);
    predictions.push({
      targetTable: target.name,
      sourceTable: current.name,
      sourceCol: matchingFromCol.name,
      targetCol: targetPk,
      onClause: `${curT}.${fromCol} = ${tgtT}.${toCol}`,
      joinStatement: `JOIN ${tgtT} ON ${curT}.${fromCol} = ${tgtT}.${toCol}`,
      isForeignKey: false,
      confidence: 0.85,
    });
  }

  // 4. Reverse Naming Convention: <current_singular>_id in targetTable
  const currentSingular = current.name.endsWith('s') ? current.name.slice(0, -1) : current.name;
  const currentIdPattern = `${currentSingular.toLowerCase()}_id`;
  const matchingToCol = target.columns.find((c) => c.name.toLowerCase() === currentIdPattern);

  if (matchingToCol) {
    const currentPk = current.columns.find((c) => c.isPrimaryKey)?.name || 'id';
    const fromCol = formatSqlIdentifier(currentPk);
    const toCol = formatSqlIdentifier(matchingToCol.name);
    predictions.push({
      targetTable: target.name,
      sourceTable: current.name,
      sourceCol: currentPk,
      targetCol: matchingToCol.name,
      onClause: `${curT}.${fromCol} = ${tgtT}.${toCol}`,
      joinStatement: `JOIN ${tgtT} ON ${curT}.${fromCol} = ${tgtT}.${toCol}`,
      isForeignKey: false,
      confidence: 0.8,
    });
  }

  // Deduplicate predictions
  const seen = new Set<string>();
  return predictions.filter((p) => {
    if (seen.has(p.onClause)) return false;
    seen.add(p.onClause);
    return true;
  });
}
