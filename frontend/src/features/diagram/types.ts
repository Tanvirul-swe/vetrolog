import { ColumnInfo } from '@/types/database';

export interface DiagramNode {
  id: string; // tableName
  name: string;
  schema?: string;
  type: string; // 'table' | 'view' | 'box'
  rowCount: number;
  columns: ColumnInfo[];
  primaryKeys: string[];
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DiagramEdge {
  id: string;
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  isInferred: boolean; // true if detected via heuristic/naming convention, false if explicit FK
  constraintName?: string;
  onUpdate?: string;
  onDelete?: string;
}

export interface ViewportTransform {
  x: number;
  y: number;
  zoom: number;
}
