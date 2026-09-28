// ==============================================================================
// GESTÃO DE APOSTILAS - MICROLINS POTIRENDABA
// Importers: lib/importers/controle-pedagogico-complementar.ts
// Mapeamento e enriquecimento de Próxima Matéria, Turma e Horário via Controle Pedagógico
// ==============================================================================

import * as XLSX from 'xlsx';
import { cleanSubject, normalizeText } from '../domain/sanitizer';
import { ProcessedStudentItem } from '../../types';

export interface PedagogicalScheduleEntry {
  studentName: string;
  studentNameNormalized: string;
  contractNumber?: string;
  classSchedule?: string;
  scheduledDay?: string;
  scheduledTime?: string;
  nextSubject?: string;
  phone?: string;
}

export interface PedagogicalScheduleAnalysis {
  entries: PedagogicalScheduleEntry[];
  byName: Map<string, PedagogicalScheduleEntry>;
  byContract: Map<string, PedagogicalScheduleEntry>;
  totalRows: number;
}

/**
 * Faz o parse da planilha de Controle Pedagógico (.xls, .xlsx, .csv) para extração de horários e próxima matéria
 */
export function parseControlePedagogicoBuffer(buffer: ArrayBuffer): PedagogicalScheduleAnalysis {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('A planilha de Controle Pedagógico não contém abas.');
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  return buildPedagogicalScheduleAnalysis(rawRows);
}

/**
 * Constrói o índice do Controle Pedagógico a partir de linhas brutas
 */
export function buildPedagogicalScheduleAnalysis(rawRows: Record<string, unknown>[]): PedagogicalScheduleAnalysis {
  const entries: PedagogicalScheduleEntry[] = [];
  const byName = new Map<string, PedagogicalScheduleEntry>();
  const byContract = new Map<string, PedagogicalScheduleEntry>();

  rawRows.forEach((row) => {
    const getVal = (candidates: string[]): string => {
      const found = Object.keys(row).find((k) => {
        const normKey = normalizeText(k);
        return candidates.some((cand) => normKey === normalizeText(cand));
      });
      return found ? String(row[found] ?? '').trim() : '';
    };

    const aluno = getVal(['Aluno', 'Nome', 'Nome do Aluno', 'Nome Aluno', 'studentName']);
    if (!aluno) return;

    const contrato = getVal(['Contrato', 'Nº Contrato', 'Numero Contrato', 'Contrato Aluno', 'contractNumber']);
    const proximaMateriaBruta = getVal([
      'Próxima Matéria',
      'Proxima Materia',
      'Próxima Matéria/Módulo',
      'Proxima Materia/Modulo',
      'Previsão Próxima Matéria',
      'Previsao Proxima Materia',
      'Próxima Disciplina',
      'nextSubject',
    ]);
    const diaAgendamento = getVal(['Dias Agendamento', 'Dia Agendamento', 'Dias de Agendamento', 'Dia da Semana', 'Dia', 'Dias', 'scheduledDay']);
    const horaAgendamento = getVal(['Horas Agendamento', 'Hora Agendamento', 'Horário', 'Horario', 'Hora', 'Horas', 'scheduledTime']);
    const turma = getVal(['Turma', 'Turmas', 'Código Turma', 'Cod Turma', 'classSchedule']);
    const telefone = getVal([
      'Telefone Aluno',
      'Telefone Celular Responsável Financeiro',
      'Telefone Celular',
      'Celular',
      'Telefone',
      'Fone',
      'phone',
    ]);

    const proximaMateriaLimpa = proximaMateriaBruta ? cleanSubject(proximaMateriaBruta) : '';
    let classSchedule: string | undefined = undefined;

    if (diaAgendamento && diaAgendamento !== 'Indefinido') {
      classSchedule = horaAgendamento ? `${diaAgendamento} (${horaAgendamento})` : diaAgendamento;
    } else if (turma) {
      classSchedule = turma;
    } else if (horaAgendamento) {
      classSchedule = horaAgendamento;
    }

    const normName = normalizeText(aluno);

    const entry: PedagogicalScheduleEntry = {
      studentName: aluno,
      studentNameNormalized: normName,
      contractNumber: contrato || undefined,
      classSchedule,
      scheduledDay: diaAgendamento && diaAgendamento !== 'Indefinido' ? diaAgendamento : undefined,
      scheduledTime: horaAgendamento || undefined,
      nextSubject: proximaMateriaLimpa || undefined,
      phone: telefone || undefined,
    };

    entries.push(entry);

    if (normName && !byName.has(normName)) {
      byName.set(normName, entry);
    }

    if (contrato && !byContract.has(contrato)) {
      byContract.set(contrato, entry);
    }
  });

  return {
    entries,
    byName,
    byContract,
    totalRows: entries.length,
  };
}

/**
 * Busca agendamento e próxima matéria do aluno na análise do Controle Pedagógico
 */
export function lookupPedagogicalSchedule(
  studentName: string,
  contractNumber?: string,
  analysis?: PedagogicalScheduleAnalysis | null
): PedagogicalScheduleEntry | null {
  if (!analysis) return null;

  if (contractNumber && analysis.byContract.has(contractNumber.trim())) {
    return analysis.byContract.get(contractNumber.trim())!;
  }

  const normName = normalizeText(studentName);
  if (analysis.byName.has(normName)) {
    return analysis.byName.get(normName)!;
  }

  return null;
}

/**
 * Enriquece uma lista de itens elegíveis com os horários e próxima matéria do Controle Pedagógico
 */
export function enrichItemsWithPedagogicalSchedule(
  items: ProcessedStudentItem[],
  analysis?: PedagogicalScheduleAnalysis | null
): { items: ProcessedStudentItem[]; matchedCount: number } {
  if (!analysis) return { items, matchedCount: 0 };

  let matchedCount = 0;
  const enriched = items.map((item) => {
    const match = lookupPedagogicalSchedule(item.studentName, item.contractNumber, analysis);
    if (match) {
      matchedCount++;
      return {
        ...item,
        nextSubject: match.nextSubject || item.nextSubject,
        classSchedule: match.classSchedule || item.classSchedule,
        scheduledDay: match.scheduledDay || item.scheduledDay,
        scheduledTime: match.scheduledTime || item.scheduledTime,
        phone: match.phone || item.phone,
      };
    }
    return item;
  });

  return { items: enriched, matchedCount };
}
