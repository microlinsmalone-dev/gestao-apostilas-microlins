// ==============================================================================
// GESTÃO DE APOSTILAS - MICROLINS POTIRENDABA
// Importers: lib/importers/pedagogical-control.ts
// Adaptador para o relatório de "Controle Pedagógico"
// ==============================================================================

import { ImportAdapter, ImportOptions, ImportParseResult } from './types';
import { ProcessedStudentItem } from '../../types';
import { cleanSubject, normalizeText } from '../domain/sanitizer';
import { isEligibleContract, isEducatorIgnored, isSubjectIgnored, isLessonInRange } from '../domain/filters';
import { createDuplicateFingerprint } from '../domain/duplicates';

export class PedagogicalControlImportAdapter implements ImportAdapter {
  canHandle(headers: string[]): boolean {
    const normalized = headers.map(h => normalizeText(h));
    const hasAluno = normalized.includes('aluno');
    const hasTelefone = normalized.some(h => h.includes('telefone aluno'));
    const hasDiasAgendamento = normalized.some(h => h.includes('dias agendamento'));
    return hasAluno && (hasTelefone || hasDiasAgendamento);
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
      const getVal = (keyName: string): string => {
        const found = Object.keys(row).find(k => normalizeText(k) === normalizeText(keyName));
        return found ? String(row[found] ?? '').trim() : '';
      };

      const aluno = getVal('Aluno');
      const materiaBruta = getVal('Matéria') || getVal('Materia');
      const statusContrato = getVal('Status');
      const entregaFisica = getVal('Entrega Física') || getVal('Entrega Fisica');
      const tipoContrato = getVal('Tipo Contrato');
      const aulasConcluidasStr = getVal('Aulas Concluídas') || getVal('Aulas Concluidas') || getVal('Aulas');
      const aulaNum = parseFloat(aulasConcluidasStr) || 0;
      const contrato = getVal('Contrato');
      const telefone = getVal('Telefone Aluno') || getVal('Telefone Celular Responsável Financeiro');
      const diaAgendamento = getVal('Dias Agendamento');
      const horaAgendamento = getVal('Horas Agendamento');
      const proximaMateriaBruta = getVal('Próxima Matéria') || getVal('Proxima Materia');

      if (!aluno || !materiaBruta) return;

      // 1. Filtro de Contrato
      const isContractValid = isEligibleContract({
        statusContrato,
        inadimplente: 'Não',
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

      // 4. Filtro de Matéria Ignorada
      if (isSubjectIgnored(materiaBruta, undefined, options.ignoredSubjects)) {
        filteredSubjects++;
        return;
      }

      const materiaLimpa = cleanSubject(materiaBruta);
      const proximaMateriaLimpa = cleanSubject(proximaMateriaBruta);
      const studentNormalized = normalizeText(aluno);
      const subjectNormalized = normalizeText(materiaLimpa);
      const fingerprint = createDuplicateFingerprint(aluno, materiaLimpa);

      let classSchedule: string | undefined = undefined;
      if (diaAgendamento && diaAgendamento !== 'Indefinido') {
        classSchedule = horaAgendamento ? `${diaAgendamento} (${horaAgendamento})` : diaAgendamento;
      }

      eligibleItems.push({
        id: `temp_${index + 1}`,
        studentName: aluno,
        studentNameNormalized: studentNormalized,
        subjectName: materiaLimpa,
        subjectNameNormalized: subjectNormalized,
        rawSubjectName: materiaBruta,
        educatorName: '',
        contractNumber: contrato,
        currentLesson: aulaNum,
        scheduledDay: diaAgendamento,
        scheduledTime: horaAgendamento,
        classSchedule,
        nextSubject: proximaMateriaLimpa || undefined,
        phone: telefone || undefined,
        duplicateFingerprint: fingerprint,
        isInternalDuplicate: false,
        isHistoricalDuplicate: false,
        isExcluded: false,
        sourceRowNumber: index + 2,
      });
    });

    return {
      reportType: 'controle_pedagogico',
      totalRows: rawRows.length,
      eligibleItems,
      filteredOutEducatorsCount: filteredEducators,
      filteredOutSubjectsCount: filteredSubjects,
      filteredOutContractsCount: filteredContracts,
      filteredOutLessonsCount: filteredLessons,
    };
  }
}
