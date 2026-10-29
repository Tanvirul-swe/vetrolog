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

function getTableKeyVariants(tableName: string): string[] {
  const lower = tableName.toLowerCase();
  const variants = new Set<string>();

  // Base names
  variants.add(lower);

  // Plural -> Singular transformations
  if (lower.endsWith('ies')) {
    variants.add(lower.slice(0, -3) + 'y'); // categories -> category
  } else if (lower.endsWith('es')) {
    variants.add(lower.slice(0, -2)); // statuses -> status, branches -> branch
  } else if (lower.endsWith('s') && !lower.endsWith('ss')) {
    variants.add(lower.slice(0, -1)); // users -> user, orders -> order
  }

  const result: string[] = [];
  variants.forEach((v) => {
    // snake_case
    result.push(`${v}_id`);
    // camelCase
    result.push(`${v}id`);
    // uuid variants
    result.push(`${v}_uuid`);
    result.push(`${v}uuid`);
  });

  return result;
}

function findTargetPrimaryKey(target: ExtendedTableSchema): string {
  // 1. Explicit primary key
  const pkCol = (target.columns || []).find((c) => c.isPrimaryKey);
  if (pkCol) return pkCol.name;

  // 2. Column named 'id' (case-insensitive)
  const idCol = (target.columns || []).find((c) => c.name.toLowerCase() === 'id');
  if (idCol) return idCol.name;

  // 3. Column named '<table_singular>_id' or '<table_singular>id'
  const variants = getTableKeyVariants(target.name);
  const selfFkCol = (target.columns || []).find((c) => variants.includes(c.name.toLowerCase()));
  if (selfFkCol) return selfFkCol.name;

  // 4. Fallback to first column
  return target.columns?.[0]?.name || 'id';
}

/**
 * Predicts join conditions between tables using foreign keys and naming conventions.
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
    const toTable = (fk.toTable || fk.refTable || '').toLowerCase();
    const fromCol = fk.fromCol || fk.column || '';
    const toCol = fk.toCol || fk.refColumn || 'id';

    if (toTable && toTable === target.name.toLowerCase() && fromCol) {
      const fromColFmt = formatSqlIdentifier(fromCol);
      const toColFmt = formatSqlIdentifier(toCol);
      predictions.push({
        targetTable: target.name,
        sourceTable: current.name,
        sourceCol: fromCol,
        targetCol: toCol,
        onClause: `${curT}.${fromColFmt} = ${tgtT}.${toColFmt}`,
        joinStatement: `JOIN ${tgtT} ON ${curT}.${fromColFmt} = ${tgtT}.${toColFmt}`,
        isForeignKey: true,
        confidence: 1.0,
      });
    }
  }

  // 2. Reverse Foreign Key: targetTable -> currentTable
  for (const fk of target.foreignKeys || []) {
    const toTable = (fk.toTable || fk.refTable || '').toLowerCase();
    const fromCol = fk.fromCol || fk.column || '';
    const toCol = fk.toCol || fk.refColumn || 'id';

    if (toTable && toTable === current.name.toLowerCase() && fromCol) {
      const fromColFmt = formatSqlIdentifier(fromCol);
      const toColFmt = formatSqlIdentifier(toCol);
      predictions.push({
        targetTable: target.name,
        sourceTable: current.name,
        sourceCol: toCol,
        targetCol: fromCol,
        onClause: `${curT}.${toColFmt} = ${tgtT}.${fromColFmt}`,
        joinStatement: `JOIN ${tgtT} ON ${curT}.${toColFmt} = ${tgtT}.${fromColFmt}`,
        isForeignKey: true,
        confidence: 0.95,
      });
    }
  }

  // 3. Naming Convention: target key variants in currentTable
  const targetVariants = getTableKeyVariants(target.name);
  const matchingFromCol = (current.columns || []).find((c) =>
    targetVariants.includes(c.name.toLowerCase())
  );

  if (matchingFromCol) {
    const targetPk = findTargetPrimaryKey(target);
    const fromColFmt = formatSqlIdentifier(matchingFromCol.name);
    const toColFmt = formatSqlIdentifier(targetPk);
    predictions.push({
      targetTable: target.name,
      sourceTable: current.name,
      sourceCol: matchingFromCol.name,
      targetCol: targetPk,
      onClause: `${curT}.${fromColFmt} = ${tgtT}.${toColFmt}`,
      joinStatement: `JOIN ${tgtT} ON ${curT}.${fromColFmt} = ${tgtT}.${toColFmt}`,
      isForeignKey: false,
      confidence: 0.85,
    });
  }

  // 4. Reverse Naming Convention: current key variants in targetTable
  const currentVariants = getTableKeyVariants(current.name);
  const matchingToCol = (target.columns || []).find((c) =>
    currentVariants.includes(c.name.toLowerCase())
  );

  if (matchingToCol) {
    const currentPk = findTargetPrimaryKey(current);
    const fromColFmt = formatSqlIdentifier(currentPk);
    const toColFmt = formatSqlIdentifier(matchingToCol.name);
    predictions.push({
      targetTable: target.name,
      sourceTable: current.name,
      sourceCol: currentPk,
      targetCol: matchingToCol.name,
      onClause: `${curT}.${fromColFmt} = ${tgtT}.${toColFmt}`,
      joinStatement: `JOIN ${tgtT} ON ${curT}.${fromColFmt} = ${tgtT}.${toColFmt}`,
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
