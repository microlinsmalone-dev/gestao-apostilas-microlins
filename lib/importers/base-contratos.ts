// ==============================================================================
// GESTÃO DE APOSTILAS - MICROLINS POTIRENDABA
// Importers: lib/importers/base-contratos.ts
// Mapeamento e cruzamento de Aluno x Educador via "Análise Base de Contratos"
// ==============================================================================

import * as XLSX from 'xlsx';
import { normalizeText } from '../domain/sanitizer';

export interface ContractBaseEntry {
  contractNumber: string;
  studentName: string;
  studentNameNormalized: string;
  educatorName: string;
  courseName?: string;
  contractType?: string;
  status?: string;
}

export interface ContractBaseAnalysis {
  entries: ContractBaseEntry[];
  contractMap: Map<string, ContractBaseEntry>;
  nameMap: Map<string, ContractBaseEntry[]>;
  educators: string[];
  totalRows: number;
}

/**
 * Faz o parse da planilha "Análise Base de Contratos" (.xls, .xlsx)
 */
export function parseBaseContratosBuffer(buffer: ArrayBuffer): ContractBaseAnalysis {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('A planilha de Base de Contratos não contém abas.');
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

  return buildContractBaseAnalysis(rawRows);
}

/**
 * Constrói a estrutura indexada a partir de registros brutos (JSON ou planilha)
 */
export function buildContractBaseAnalysis(rawRows: Record<string, unknown>[]): ContractBaseAnalysis {
  const entries: ContractBaseEntry[] = [];
  const contractMap = new Map<string, ContractBaseEntry>();
  const nameMap = new Map<string, ContractBaseEntry[]>();
  const educatorSet = new Set<string>();

  rawRows.forEach((row) => {
    const getVal = (candidates: string[]): string => {
      const found = Object.keys(row).find((k) => {
        const normKey = normalizeText(k);
        return candidates.some((cand) => normKey === normalizeText(cand));
      });
      return found ? String(row[found] ?? '').trim() : '';
    };

    const studentName = getVal(['Nome', 'Aluno', 'Nome Aluno', 'Estudante']);
    const educatorName = getVal(['Educador', 'Professor', 'Instrutor', 'Responsável Pedagógico']);
    const contractNumber = getVal(['Contrato', 'Nº Contrato', 'Numero Contrato', 'Cod Contrato']);
    const courseName = getVal(['Formações', 'Formacoes', 'Curso', 'Formação', 'Formacao', 'Contrato Curso']);
    const contractType = getVal(['Tipo Contrato', 'Tipo']);
    const status = getVal(['Status', 'Situação']);

    if (!studentName || !educatorName) return;

    const studentNameNormalized = normalizeText(studentName);
    const entry: ContractBaseEntry = {
      contractNumber: contractNumber ? String(contractNumber).trim() : '',
      studentName,
      studentNameNormalized,
      educatorName,
      courseName: courseName || undefined,
      contractType: contractType || undefined,
      status: status || undefined,
    };

    entries.push(entry);
    educatorSet.add(educatorName);

    // Indexa por contrato (busca exata)
    if (entry.contractNumber) {
      contractMap.set(entry.contractNumber, entry);
    }

    // Indexa por nome normalizado (busca por aluno)
    if (studentNameNormalized) {
      if (!nameMap.has(studentNameNormalized)) {
        nameMap.set(studentNameNormalized, []);
      }
      nameMap.get(studentNameNormalized)!.push(entry);
    }
  });

  const educators = Array.from(educatorSet).sort((a, b) => a.localeCompare(b));

  return {
    entries,
    contractMap,
    nameMap,
    educators,
    totalRows: rawRows.length,
  };
}

/**
 * Cruza um aluno com a base de contratos para descobrir o educador responsável.
 * Prioridade:
 * 1. Número de Contrato (garante 100% de precisão para alunos com múltiplos contratos/cursos)
 * 2. Nome do Aluno (com desempate pelo nome do curso se houver múltiplos contratos)
 */
export function lookupEducatorInBase(
  student: {
    studentName: string;
    contractNumber?: string | null;
    courseName?: string | null;
    rawSubjectName?: string | null;
  },
  base: ContractBaseAnalysis
): string | null {
  // 1. Busca pelo número de contrato (se disponível)
  if (student.contractNumber) {
    const cleanContract = String(student.contractNumber).trim();
    const byContract = base.contractMap.get(cleanContract);
    if (byContract && byContract.educatorName) {
      return byContract.educatorName;
    }
  }

  // 2. Busca pelo nome do aluno normalizado
  if (student.studentName) {
    const normName = normalizeText(student.studentName);
    const candidates = base.nameMap.get(normName);
    if (candidates && candidates.length > 0) {
      if (candidates.length === 1) {
        return candidates[0].educatorName;
      }

      // Se houver mais de um educador para o mesmo aluno (múltiplos cursos/contratos):
      // Tenta desempatar pelo nome do curso/formação
      if (student.courseName) {
        const normCourse = normalizeText(student.courseName);
        const match = candidates.find((c) => {
          if (!c.courseName) return false;
          const candNormCourse = normalizeText(c.courseName);
          return candNormCourse.includes(normCourse) || normCourse.includes(candNormCourse);
        });
        if (match) return match.educatorName;
      }

      // Se não desempatou pelo curso, retorna o primeiro candidato
      return candidates[0].educatorName;
    }
  }

  return null;
}
