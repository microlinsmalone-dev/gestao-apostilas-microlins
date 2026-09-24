// ==============================================================================
// GESTÃO DE APOSTILAS - MICROLINS POTIRENDABA
// Types: types/index.ts
// Tipos de Domínio, Importação, Auditoria e Regras de Negócio
// ==============================================================================

import { Database } from './database';

export * from './database';

export type Unit = Database['public']['Tables']['units']['Row'];
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type UnitSettings = Database['public']['Tables']['unit_settings']['Row'];
export type Educator = Database['public']['Tables']['educators']['Row'];
export type Order = Database['public']['Tables']['orders']['Row'];
export type OrderItem = Database['public']['Tables']['order_items']['Row'];
export type ImportFile = Database['public']['Tables']['import_files']['Row'];
export type AuditLog = Database['public']['Tables']['audit_logs']['Row'];

/**
 * Representa um registro extraído de arquivo Excel antes do processamento
 */
export interface RawImportRow {
  studentName?: string;
  subjectName?: string;
  courseName?: string;
  educatorName?: string;
  contractStatus?: string;
  contractType?: string;
  delinquent?: string;
  physicalDelivery?: string;
  currentLesson?: number | string;
  scheduledDay?: string;
  scheduledTime?: string;
  nextSubject?: string;
  phone?: string;
  contractNumber?: string;
  sourceRowNumber: number;
  [key: string]: unknown;
}

/**
 * Item higienizado, enriquecido e validado pelas regras de negócio
 */
export interface ProcessedStudentItem {
  id: string; // Temporário no frontend ou UUID persistido
  studentName: string;
  studentNameNormalized: string;
  subjectName: string;
  subjectNameNormalized: string;
  rawSubjectName: string;
  courseName?: string;
  educatorName?: string;
  contractNumber?: string;
  currentLesson: number;
  scheduledDay?: string;
  scheduledTime?: string;
  classSchedule?: string; // Ex: 'Segunda-Feira (15:30)'
  nextSubject?: string;
  phone?: string;
  duplicateFingerprint: string;
  isInternalDuplicate: boolean;
  isHistoricalDuplicate: boolean;
  historicalMatchOrderTitle?: string;
  excludedReason?: string;
  isExcluded: boolean;
  sourceRowNumber: number;
}

/**
 * Parâmetros de filtragem dinâmica
 */
export interface FilterCriteria {
  lessonMin: number;
  lessonMax: number;
  allLessons: boolean;
  searchQuery?: string;
}

/**
 * Resultado da análise de duplicidades
 */
export interface DuplicateAnalysisResult {
  internalDuplicatesCount: number;
  historicalDuplicatesCount: number;
  items: ProcessedStudentItem[];
}

/**
 * Resumo do Dashboard
 */
export interface DashboardSummary {
  totalOrdersArchived: number;
  totalWorkbooksDelivered: number;
  ordersThisMonth: number;
  systemStatus: 'Livre' | 'Em Aberto' | 'Em Edição';
  recentOrders: Order[];
}
