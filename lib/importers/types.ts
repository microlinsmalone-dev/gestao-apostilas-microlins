// ==============================================================================
// GESTÃO DE APOSTILAS - MICROLINS POTIRENDABA
// Importers: lib/importers/types.ts
// Interfaces e contratos dos adaptadores de importação de arquivos
// ==============================================================================

import { RawImportRow, ProcessedStudentItem } from '../../types';

export type ReportType = 'entrega_apostila' | 'controle_pedagogico' | 'desconhecido';

export interface ImportOptions {
  ignoredEducators: string[];
  ignoredSubjects?: string[];
  lessonMin?: number;
  lessonMax?: number;
  allLessons?: boolean;
}

export interface ImportParseResult {
  reportType: ReportType;
  totalRows: number;
  eligibleItems: ProcessedStudentItem[];
  filteredOutEducatorsCount: number;
  filteredOutSubjectsCount: number;
  filteredOutContractsCount: number;
  filteredOutLessonsCount: number;
}

export interface ImportAdapter {
  canHandle(headers: string[]): boolean;
  parse(rawRows: Record<string, unknown>[], options: ImportOptions): ImportParseResult;
}
