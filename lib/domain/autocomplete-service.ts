// ==============================================================================
// GESTÃO DE APOSTILAS - MICROLINS POTIRENDABA
// Domain Service: lib/domain/autocomplete-service.ts
// Gerenciamento e persistência da Base de Referência de Autopreenchimento
// ==============================================================================

import { cleanSubject, normalizeText } from './sanitizer';
import { ProcessedStudentItem } from '../../types';

export const AUTOCOMPLETE_STORAGE_KEY = 'microlins_autocomplete_base';
export const AUTOCOMPLETE_EVENT_NAME = 'microlins_autocomplete_updated';

export interface AutocompleteStudent {
  name: string;
  nameNormalized: string;
  course?: string;
  lastSubject?: string;
  educator?: string;
  contract?: string;
}

export interface AutocompleteReferenceBase {
  fileName: string;
  updatedAt: string; // Data ISO
  totalRecords: number;
  students: AutocompleteStudent[];
  subjects: string[]; // Lista única de matérias limpas e ordenadas
  courses: string[]; // Lista única de cursos/formações
}

/**
 * Constrói a Base de Referência de Autopreenchimento a partir das linhas brutas
 * do relatório de Entrega de Apostila e dos itens enriquecidos (se disponíveis).
 */
export function buildAutocompleteBase(
  fileName: string,
  rawRows: Record<string, unknown>[],
  enrichedItems?: ProcessedStudentItem[]
): AutocompleteReferenceBase {
  const studentMap = new Map<string, AutocompleteStudent>();
  const subjectSet = new Set<string>();
  const courseSet = new Set<string>();

  // Cria mapa rápido de itens enriquecidos por aluno (para vincular educador e horários se existirem)
  const enrichedMap = new Map<string, ProcessedStudentItem>();
  if (enrichedItems && enrichedItems.length > 0) {
    enrichedItems.forEach((item) => {
      if (item.studentNameNormalized && !enrichedMap.has(item.studentNameNormalized)) {
        enrichedMap.set(item.studentNameNormalized, item);
      }
    });
  }

  // Função auxiliar para obter valor de chave normalizada
  const getVal = (row: Record<string, unknown>, keyName: string): string => {
    const found = Object.keys(row).find((k) => normalizeText(k) === normalizeText(keyName));
    return found ? String(row[found] ?? '').trim() : '';
  };

  rawRows.forEach((row) => {
    const alunoRaw = getVal(row, 'Aluno');
    if (!alunoRaw || alunoRaw.length < 2) return;

    // Remove espaços extras preservando a capitalização original
    const aluno = alunoRaw.replace(/\s+/g, ' ').trim();
    const alunoNorm = normalizeText(aluno);

    const materiaRaw = getVal(row, 'Matéria') || getVal(row, 'Materia');
    const materiaLimpa = cleanSubject(materiaRaw);
    if (materiaLimpa) {
      subjectSet.add(materiaLimpa);
    }

    const formacaoRaw = getVal(row, 'Formação') || getVal(row, 'Formacao') || getVal(row, 'Contrato Curso');
    const formacao = formacaoRaw.replace(/\s+/g, ' ').trim();
    if (formacao) {
      courseSet.add(formacao);
    }

    const contrato = getVal(row, 'Contrato');

    const enrichedMatch = enrichedMap.get(alunoNorm);
    const educator = enrichedMatch?.educatorName || '';

    if (!studentMap.has(alunoNorm)) {
      studentMap.set(alunoNorm, {
        name: aluno,
        nameNormalized: alunoNorm,
        course: formacao || undefined,
        lastSubject: materiaLimpa || undefined,
        educator: educator || undefined,
        contract: contrato || undefined,
      });
    } else {
      // Atualiza com dados mais completos caso faltassem
      const existing = studentMap.get(alunoNorm)!;
      if (!existing.course && formacao) existing.course = formacao;
      if (!existing.lastSubject && materiaLimpa) existing.lastSubject = materiaLimpa;
      if (!existing.educator && educator) existing.educator = educator;
      if (!existing.contract && contrato) existing.contract = contrato;
    }
  });

  // Também inclui matérias e cursos dos itens enriquecidos (ex: próxima matéria do controle pedagógico)
  if (enrichedItems) {
    enrichedItems.forEach((item) => {
      if (item.subjectName) subjectSet.add(item.subjectName);
      if (item.nextSubject) subjectSet.add(cleanSubject(item.nextSubject));
      if (item.courseName) courseSet.add(item.courseName);
    });
  }

  // Ordena alunos em ordem alfabética
  const students = Array.from(studentMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name, 'pt-BR')
  );

  // Ordena matérias alfabeticamente
  const subjects = Array.from(subjectSet).sort((a, b) =>
    a.localeCompare(b, 'pt-BR')
  );

  // Ordena cursos alfabeticamente
  const courses = Array.from(courseSet).sort((a, b) =>
    a.localeCompare(b, 'pt-BR')
  );

  return {
    fileName: fileName || 'Relatório de Entrega de Apostila',
    updatedAt: new Date().toISOString(),
    totalRecords: rawRows.length,
    students,
    subjects,
    courses,
  };
}

/**
 * Salva a Base de Referência no localStorage e notifica os componentes ativos via CustomEvent.
 */
export function saveAutocompleteBase(base: AutocompleteReferenceBase): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(AUTOCOMPLETE_STORAGE_KEY, JSON.stringify(base));
    window.dispatchEvent(
      new CustomEvent(AUTOCOMPLETE_EVENT_NAME, { detail: base })
    );
  } catch (err) {
    console.warn('Erro ao salvar base de autocompletar no localStorage:', err);
  }
}

/**
 * Carrega a Base de Referência do localStorage de forma segura.
 */
export function loadAutocompleteBase(): AutocompleteReferenceBase | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(AUTOCOMPLETE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.students)) return null;
    return parsed as AutocompleteReferenceBase;
  } catch (err) {
    console.warn('Erro ao carregar base de autocompletar:', err);
    return null;
  }
}

/**
 * Limpa a Base de Referência salva.
 */
export function clearAutocompleteBase(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(AUTOCOMPLETE_STORAGE_KEY);
    window.dispatchEvent(
      new CustomEvent(AUTOCOMPLETE_EVENT_NAME, { detail: null })
    );
  } catch (err) {
    console.warn('Erro ao limpar base de autocompletar:', err);
  }
}

/**
 * Busca inteligente de alunos para autocompletar:
 * 1. Prefixo exato do nome (começa com o termo digitado)
 * 2. Início de qualquer palavra/sobrenome no nome
 * 3. Substring em qualquer posição
 */
export function searchStudents(
  query: string,
  base: AutocompleteReferenceBase | null,
  limit = 7
): AutocompleteStudent[] {
  if (!base || !base.students || base.students.length === 0) return [];
  const q = normalizeText(query);
  if (!q) return [];

  const startsWithList: AutocompleteStudent[] = [];
  const wordStartList: AutocompleteStudent[] = [];
  const containsList: AutocompleteStudent[] = [];

  for (const student of base.students) {
    const norm = student.nameNormalized;
    if (norm.startsWith(q)) {
      startsWithList.push(student);
      if (startsWithList.length >= limit) break;
    } else if (norm.includes(' ' + q)) {
      wordStartList.push(student);
    } else if (norm.includes(q)) {
      containsList.push(student);
    }
  }

  const combined = [...startsWithList, ...wordStartList, ...containsList];
  return combined.slice(0, limit);
}

/**
 * Busca matérias para autocompletar:
 * Prioriza matérias que casam com a busca e, opcionalmente, destaca a matéria do aluno.
 */
export function searchSubjects(
  query: string,
  base: AutocompleteReferenceBase | null,
  studentContext?: AutocompleteStudent | null,
  limit = 7
): string[] {
  if (!base || !base.subjects || base.subjects.length === 0) return [];
  const q = normalizeText(query);

  const results: string[] = [];
  const seen = new Set<string>();

  // Se o aluno tiver uma última matéria conhecida e não houver query ou ela casar
  if (studentContext?.lastSubject) {
    const lastNorm = normalizeText(studentContext.lastSubject);
    if (!q || lastNorm.includes(q)) {
      results.push(studentContext.lastSubject);
      seen.add(lastNorm);
    }
  }

  // Se não digitou nada, retorna as principais matérias (com a do aluno no topo)
  if (!q) {
    for (const sub of base.subjects) {
      const subNorm = normalizeText(sub);
      if (!seen.has(subNorm)) {
        results.push(sub);
        seen.add(subNorm);
        if (results.length >= limit) break;
      }
    }
    return results;
  }

  const startsWithList: string[] = [];
  const containsList: string[] = [];

  for (const sub of base.subjects) {
    const subNorm = normalizeText(sub);
    if (seen.has(subNorm)) continue;

    if (subNorm.startsWith(q)) {
      startsWithList.push(sub);
    } else if (subNorm.includes(q)) {
      containsList.push(sub);
    }
  }

  const combined = [...results, ...startsWithList, ...containsList];
  return combined.slice(0, limit);
}
