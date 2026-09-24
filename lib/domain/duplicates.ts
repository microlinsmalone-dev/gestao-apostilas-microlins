// ==============================================================================
// GESTÃO DE APOSTILAS - MICROLINS POTIRENDABA
// Domain Service: lib/domain/duplicates.ts
// Geração de fingerprints e detecção robusta de duplicidades internas e históricas
// ==============================================================================

import { normalizeText } from './sanitizer';
import { ProcessedStudentItem, DuplicateAnalysisResult } from '../../types';

/**
 * Cria fingerprint determinístico para a combinação Aluno + Matéria
 * Ex: normalize("João da Silva") + "|||" + normalize("Windows 11")
 */
export function createDuplicateFingerprint(studentName: string, subjectName: string): string {
  const normStudent = normalizeText(studentName);
  const normSubject = normalizeText(subjectName);
  return `${normStudent}|||${normSubject}`;
}

/**
 * Detecta duplicidades em lote:
 * 1. Duplicidade interna (repetições dentro do próprio pedido em análise)
 * 2. Duplicidade histórica (repetições contra fingerprint acumulado no banco de pedidos anteriores)
 */
export function analyzeDuplicates(
  items: ProcessedStudentItem[],
  historicalMap: Map<string, string> = new Map() // fingerprint -> historicalOrderTitle
): DuplicateAnalysisResult {
  const seenInternal = new Set<string>();
  let internalCount = 0;
  let historicalCount = 0;

  const analyzedItems = items.map((item) => {
    const fp = item.duplicateFingerprint || createDuplicateFingerprint(item.studentName, item.subjectName);
    let isInternal = false;
    let isHistorical = false;
    let historicalMatchTitle: string | undefined = undefined;

    // Checa duplicidade interna
    if (seenInternal.has(fp)) {
      isInternal = true;
      internalCount++;
    } else {
      seenInternal.add(fp);
    }

    // Checa duplicidade histórica
    if (historicalMap.has(fp)) {
      isHistorical = true;
      historicalMatchTitle = historicalMap.get(fp);
      historicalCount++;
    }

    return {
      ...item,
      duplicateFingerprint: fp,
      isInternalDuplicate: isInternal,
      isHistoricalDuplicate: isHistorical,
      historicalMatchOrderTitle: historicalMatchTitle,
    };
  });

  return {
    internalDuplicatesCount: internalCount,
    historicalDuplicatesCount: historicalCount,
    items: analyzedItems,
  };
}
