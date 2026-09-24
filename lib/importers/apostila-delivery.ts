// ==============================================================================
// GESTÃO DE APOSTILAS - MICROLINS POTIRENDABA
// Importers: lib/importers/apostila-delivery.ts
// Adaptador para o "Relatório de Entrega de Apostila"
// ==============================================================================

import { ImportAdapter, ImportOptions, ImportParseResult } from './types';
import { ProcessedStudentItem } from '../../types';
import { cleanSubject, normalizeText } from '../domain/sanitizer';
import { isEligibleContract, isEducatorIgnored, isSubjectIgnored, isLessonInRange } from '../domain/filters';
import { createDuplicateFingerprint } from '../domain/duplicates';

export class ApostilaDeliveryImportAdapter implements ImportAdapter {
  canHandle(headers: string[]): boolean {
    const normalized = headers.map(h => normalizeText(h));
    const hasAluno = normalized.includes('aluno');
    const hasStatusContrato = normalized.includes('status contrato');
    const hasMateria = normalized.some(h => h.includes('materia'));
    const hasAulaAtual = normalized.some(h => h.includes('aula atual'));
    return hasAluno && hasStatusContrato && hasMateria && hasAulaAtual;
  }

  parse(rawRows: Record<string, unknown>[], options: ImportOptions): ImportParseResult {
    const eligibleItems: ProcessedStudentItem[] = [];
    let filteredEducators = 0;
    let filteredSubjects = 0;
    let filteredContracts = 0;
    let filteredLessons = 0;

    const minLesson = options.lessonMin ?? 4;
    const maxLesson = options.lessonMax ?? 6;
    const allLessons = options.allLessons ?? false;

    rawRows.forEach((row, index) => {
      // Busca flexível de propriedades por chave normalizada
      const getVal = (keyName: string): string => {
        const found = Object.keys(row).find(k => normalizeText(k) === normalizeText(keyName));
        return found ? String(row[found] ?? '').trim() : '';
      };

      const aluno = getVal('Aluno');
      const materiaBruta = getVal('Matéria') || getVal('Materia');
      const formacao = getVal('Formação') || getVal('Formacao') || getVal('Contrato Curso');
      const statusContrato = getVal('Status Contrato');
      const inadimplente = getVal('Inadimplente');
      const entregaFisica = getVal('Entrega Física') || getVal('Entrega Fisica');
      const tipoContrato = getVal('Tipo Contrato');
      const aulaStr = getVal('Aula Atual');
      const aulaNum = parseFloat(aulaStr) || 0;
      const educador = getVal('Responsável Entrega') || getVal('Responsavel Entrega') || '';
      const contrato = getVal('Contrato');

      if (!aluno || !materiaBruta) return;

      // 1. Filtro de Contrato
      const isContractValid = isEligibleContract({
        statusContrato,
        inadimplente,
        entregaFisica,
        tipoContrato,
      });

      if (!isContractValid) {
        filteredContracts++;
        return;
      }

      // 2. Filtro de Aula
      if (!isLessonInRange(aulaNum, minLesson, maxLesson, allLessons)) {
        filteredLessons++;
        return;
      }

      // 3. Filtro de Educador
      if (isEducatorIgnored(aluno, options.ignoredEducators)) {
        filteredEducators++;
        return;
      }

      // 4. Filtro de Matéria Ignorada (ex: Digitação)
      if (isSubjectIgnored(materiaBruta, formacao, options.ignoredSubjects)) {
        filteredSubjects++;
        return;
      }

      // Sanitiza matéria
      const materiaLimpa = cleanSubject(materiaBruta);
      const studentNormalized = normalizeText(aluno);
      const subjectNormalized = normalizeText(materiaLimpa);
      const fingerprint = createDuplicateFingerprint(aluno, materiaLimpa);

      eligibleItems.push({
        id: `temp_${index + 1}`,
        studentName: aluno,
        studentNameNormalized: studentNormalized,
        subjectName: materiaLimpa,
        subjectNameNormalized: subjectNormalized,
        rawSubjectName: materiaBruta,
        courseName: formacao,
        educatorName: educador,
        contractNumber: contrato,
        currentLesson: aulaNum,
        duplicateFingerprint: fingerprint,
        isInternalDuplicate: false,
        isHistoricalDuplicate: false,
        isExcluded: false,
        sourceRowNumber: index + 2, // Considerando cabeçalho na linha 1
      });
    });

    return {
      reportType: 'entrega_apostila',
      totalRows: rawRows.length,
      eligibleItems,
      filteredOutEducatorsCount: filteredEducators,
      filteredOutSubjectsCount: filteredSubjects,
      filteredOutContractsCount: filteredContracts,
      filteredOutLessonsCount: filteredLessons,
    };
  }
}
