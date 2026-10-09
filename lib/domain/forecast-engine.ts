// ==============================================================================
// GESTÃO DE APOSTILAS - MICROLINS POTIRENDABA
// Motor de Regras: lib/domain/forecast-engine.ts
// Motor de Cálculo de Previsão de Apostilas & Cronograma de Compras Multi-Meses
// ==============================================================================

import {
  CourseDurationConfig,
  ForecastStudentItem,
  ForecastMonthlySummary,
  DataIssueItem,
  ProcessedStudentItem,
} from '../../types';
import { cleanSubject, normalizeText } from './sanitizer';
import {
  CURSOS_OFICIAIS_SISTEMA_FICHAS,
  getCursosOficiaisSistemaFichas,
} from './cursos-oficiais';

/**
 * Matérias ignoradas por padrão (sem apostila física padrão)
 */
export const IGNORED_FORECAST_SUBJECTS = [
  'Digitação',
  'Digitacao',
  'Inglês',
  'Ingles',
  'English',
];

/**
 * Cursos comportamentais válidos
 */
export const ALLOWED_SPECIAL_SUBJECTS = [
  'Inteligência Emocional',
  'Inteligencia Emocional',
  'Marketing Pessoal',
  'Comunicação e Oratória',
  'Comunicacao e Oratoria',
  'Educação Financeira',
  'Educacao Financeira',
  'Inovação e Criatividade',
  'Inovacao e Criatividade',
  'Negociação, Objeções e Influência',
  'Negociacao, Objeções e Influencia',
  'Produtividade e Gestão do Tempo',
  'Produtividade e Gestao do Tempo',
];

/**
 * Duração padrão aplicada para qualquer matéria sem regra específica
 */
export const DEFAULT_LESSONS_PER_COURSE = 16;

/**
 * Retorna as configurações oficiais de cursos extraídas de D:\Malone\CriaFichas\sistema_fichas.db
 */
export function getDefaultCourseDurations(): CourseDurationConfig[] {
  return getCursosOficiaisSistemaFichas();
}

/**
 * Limpa o nome da matéria removendo prefixo numérico (ex: 161870_) e marcadores de turma
 */
export function sanitizeRawSubject(raw: string): string {
  if (!raw) return '';
  let cleaned = String(raw).trim();
  // Remove prefixos como 161870_ ou 26748_
  cleaned = cleaned.replace(/^\d+_\s*/, '');
  // Remove sufixos como [DINÂMICA] ou - Enter
  cleaned = cleaned.replace(/\s*\[.*?\]\s*/g, '');
  return cleaned.trim();
}

/**
 * Valida e cruza a matéria contra os 101 cursos oficiais do sistema_fichas.db
 */
export function isValidForecastSubject(
  rawSubject: string,
  catalog: CourseDurationConfig[] = CURSOS_OFICIAIS_SISTEMA_FICHAS
): {
  valid: boolean;
  cleanName: string;
  reason?: string;
} {
  if (!rawSubject || !rawSubject.trim()) {
    return { valid: false, cleanName: '', reason: 'Nome da matéria vazio' };
  }

  const raw = rawSubject.trim();
  const normRaw = normalizeText(raw);

  // Ignora Digitação e Inglês
  for (const ignored of IGNORED_FORECAST_SUBJECTS) {
    if (normRaw.includes(normalizeText(ignored))) {
      return { valid: false, cleanName: raw, reason: 'Matéria excluída (Inglês/Digitação)' };
    }
  }

  const cleaned = sanitizeRawSubject(raw);
  const normCleaned = normalizeText(cleaned);

  // 1. Busca exata ou por similaridade no catálogo oficial dos 101 cursos
  const exactMatch = catalog.find((c) => normalizeText(c.name) === normCleaned);
  if (exactMatch) {
    return { valid: true, cleanName: exactMatch.name };
  }

  // 2. Busca por contenção (substring) nos cursos oficiais
  const partialMatch = catalog.find((c) => {
    const cNorm = normalizeText(c.name);
    return normCleaned === cNorm || normCleaned.includes(cNorm) || cNorm.includes(normCleaned);
  });
  if (partialMatch) {
    return { valid: true, cleanName: partialMatch.name };
  }

  // 3. Exceções comportamentais
  for (const allowed of ALLOWED_SPECIAL_SUBJECTS) {
    if (normCleaned.includes(normalizeText(allowed))) {
      return { valid: true, cleanName: allowed };
    }
  }

  // 4. Se tinha prefixo numérico (ex: 161869_Windows 11) mas nome ligeiramente diferente
  const hasPrefix = /^\d+_\s*/.test(raw);
  if (hasPrefix && cleaned.length >= 3) {
    return { valid: true, cleanName: cleaned };
  }

  return {
    valid: false,
    cleanName: cleaned,
    reason: 'Curso descontinuado ou não encontrado no catálogo oficial',
  };
}

/**
 * Busca a duração total de uma matéria baseando-se no catálogo oficial configurado
 */
export function resolveCourseTotalLessons(
  subjectName: string,
  coursesConfig: CourseDurationConfig[] = CURSOS_OFICIAIS_SISTEMA_FICHAS
): { totalLessons: number; active: boolean } {
  const normTarget = normalizeText(subjectName);

  // 1. Busca EXATA primeiro
  const exact = coursesConfig.find((c) => normalizeText(c.name) === normTarget);
  if (exact) {
    return { totalLessons: exact.totalLessons, active: exact.active };
  }

  // 2. Tenta mapear numerais romanos exatos (ex: Robótica 1 -> Robótica - Módulo I)
  const romanVariant = normTarget
    .replace(/\b1\b/g, 'modulo i')
    .replace(/\b2\b/g, 'modulo ii')
    .replace(/\b3\b/g, 'modulo iii')
    .replace(/\b4\b/g, 'modulo iv');

  const exactRoman = coursesConfig.find((c) => normalizeText(c.name) === romanVariant);
  if (exactRoman) {
    return { totalLessons: exactRoman.totalLessons, active: exactRoman.active };
  }

  // 3. Busca por contenção ordenando pelo maior nome para evitar falso positivo com prefixos curtos
  const matches = coursesConfig.filter((c) => {
    const norm = normalizeText(c.name);
    return (
      normTarget.includes(norm) ||
      norm.includes(normTarget) ||
      romanVariant.includes(norm) ||
      norm.includes(romanVariant)
    );
  });

  if (matches.length > 0) {
    matches.sort((a, b) => b.name.length - a.name.length);
    return { totalLessons: matches[0].totalLessons, active: matches[0].active };
  }

  return { totalLessons: DEFAULT_LESSONS_PER_COURSE, active: true };
}

/**
 * Tenta resolver a próxima matéria sequencial lógica no catálogo oficial de cursos.
 * Ex: "Assistente Administrativo - Módulo I" -> "Assistente Administrativo - Módulo II"
 * Ex: "Adobe Photoshop - Creative Cloud - Módulo I" -> "Adobe Photoshop - Creative Cloud - Módulo II"
 * Ex: "Adobe Photoshop - Creative Cloud - Módulo II" -> "Adobe Photoshop - Creative Cloud - Módulo III"
 * Ex: "Programação C# - Módulo I" -> "Programação C# - Módulo II"
 */
export function resolveNextSequentialSubject(
  currentSubject: string,
  catalog: CourseDurationConfig[] = CURSOS_OFICIAIS_SISTEMA_FICHAS
): string | null {
  if (!currentSubject) return null;
  const current = currentSubject.trim();

  // Módulo I -> Módulo II
  if (/m[oó]dulo\s+i\b/i.test(current) && !/m[oó]dulo\s+ii\b/i.test(current) && !/m[oó]dulo\s+iii\b/i.test(current) && !/m[oó]dulo\s+iv\b/i.test(current)) {
    const nextCandidate = current.replace(/m[oó]dulo\s+i\b/i, 'Módulo II');
    const normCand = normalizeText(nextCandidate);
    const found = catalog.find((c) => normalizeText(c.name) === normCand);
    if (found) return found.name;
  }

  // Módulo II -> Módulo III
  if (/m[oó]dulo\s+ii\b/i.test(current) && !/m[oó]dulo\s+iii\b/i.test(current)) {
    const nextCandidate = current.replace(/m[oó]dulo\s+ii\b/i, 'Módulo III');
    const normCand = normalizeText(nextCandidate);
    const found = catalog.find((c) => normalizeText(c.name) === normCand);
    if (found) return found.name;
  }

  // Módulo III -> Módulo IV
  if (/m[oó]dulo\s+iii\b/i.test(current) && !/m[oó]dulo\s+iv\b/i.test(current)) {
    const nextCandidate = current.replace(/m[oó]dulo\s+iii\b/i, 'Módulo IV');
    const normCand = normalizeText(nextCandidate);
    const found = catalog.find((c) => normalizeText(c.name) === normCand);
    if (found) return found.name;
  }

  return null;
}

/**
 * Nomes dos meses futuros com rótulos relativos amigáveis
 */
export function getUpcomingMonthLabels(
  referenceDate: Date = new Date(),
  totalMonths: number = 4
): { index: number; label: string; relativeLabel: string; yearMonth: string }[] {
  const monthsBR = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ];

  const relativeNames = [
    'Mês Atual',
    'Daqui a 1 mês',
    'Daqui a 2 meses',
    'Daqui a 3 meses',
  ];

  const result: { index: number; label: string; relativeLabel: string; yearMonth: string }[] = [];
  const currentMonth = referenceDate.getMonth();
  const currentYear = referenceDate.getFullYear();

  for (let i = 0; i < totalMonths; i++) {
    const targetDate = new Date(currentYear, currentMonth + i, 1);
    const mIdx = targetDate.getMonth();
    const yr = targetDate.getFullYear();
    result.push({
      index: i + 1,
      label: `${monthsBR[mIdx]} / ${yr}`,
      relativeLabel: relativeNames[i] || `Mês ${i + 1}`,
      yearMonth: `${yr}-${String(mIdx + 1).padStart(2, '0')}`,
    });
  }

  return result;
}

/**
 * Motor de Projeção Multi-Meses & Multi-Ciclos
 * Calcula com fidelidade matemática a progressão de todos os alunos ativos da escola
 */
export function computeStudentsForecast(params: {
  rawOrProcessedItems: (ProcessedStudentItem | Record<string, unknown>)[];
  coursesConfig: CourseDurationConfig[];
  frequencyConfigs: Record<string, number>; // aluno -> aulas por semana (1 a 4)
  triggerLesson?: number; // padrão 4
  horizonMonths?: number; // 1 a 4 meses
  referenceDate?: Date;
}): {
  forecastItems: ForecastStudentItem[];
  monthlySummaries: ForecastMonthlySummary[];
  uniqueStudentsCount: number;
  totalWorkbooksCount: number;
  issues: DataIssueItem[];
} {
  const {
    rawOrProcessedItems,
    coursesConfig = CURSOS_OFICIAIS_SISTEMA_FICHAS,
    frequencyConfigs,
    triggerLesson = 4,
    horizonMonths = 4,
    referenceDate = new Date(),
  } = params;

  const monthLabels = getUpcomingMonthLabels(referenceDate, horizonMonths);
  const forecastItems: ForecastStudentItem[] = [];
  const issues: DataIssueItem[] = [];

  const monthlyCounts: Record<
    number,
    {
      label: string;
      relativeLabel: string;
      count: number;
      students: Set<string>;
      subjects: Record<string, number>;
    }
  > = {};

  monthLabels.forEach((m) => {
    monthlyCounts[m.index] = {
      label: m.label,
      relativeLabel: m.relativeLabel,
      count: 0,
      students: new Set<string>(),
      subjects: {},
    };
  });

  const uniqueStudentsGlobal = new Set<string>();

  // 1. Agrupa os registros por aluno para isolar a grade curricular e evitar falsos positivos
  const studentRowsMap = new Map<
    string,
    {
      studentName: string;
      educatorName: string;
      courseName: string;
      rows: any[];
    }
  >();

  rawOrProcessedItems.forEach((row) => {
    const studentName = String(
      (row as any).studentName ||
        (row as any)['Aluno'] ||
        (row as any)['Nome'] ||
        (row as any)['student_name'] ||
        ''
    ).trim();

    if (!studentName) return;

    // Filtros de status de contrato e inadimplência
    const statusContrato = String((row as any).contractStatus || (row as any)['Status Contrato'] || 'Ativo').trim();
    if (statusContrato.toLowerCase() === 'cancelado' || statusContrato.toLowerCase() === 'inativo') {
      return;
    }

    const inadimplente = String((row as any).delinquent || (row as any)['Inadimplente'] || 'Não').trim();
    if (inadimplente.toLowerCase() === 'sim') {
      return;
    }

    const tipoContrato = String((row as any).contractType || (row as any)['Tipo Contrato'] || '').trim();
    if (tipoContrato.toLowerCase() === 'bolsista') {
      return;
    }

    // Status da matéria (matérias concluídas ou canceladas não geram demanda de apostila)
    const statusMateria = String(
      (row as any).subjectStatus ||
        (row as any)['Status Matéria'] ||
        (row as any)['Status Materia'] ||
        'Ativo'
    ).trim();
    if (
      statusMateria.toLowerCase() === 'concluído' ||
      statusMateria.toLowerCase() === 'concluido' ||
      statusMateria.toLowerCase() === 'cancelado'
    ) {
      return;
    }

    const educatorName = String((row as any).educatorName || (row as any)['Educador'] || '').trim();
    const courseName = String((row as any).courseName || (row as any)['Formação'] || (row as any)['Formacao'] || '').trim();

    const studentKey = normalizeText(studentName);
    const existing = studentRowsMap.get(studentKey);
    if (existing) {
      existing.rows.push(row);
      if (!existing.educatorName && educatorName) existing.educatorName = educatorName;
      if (!existing.courseName && courseName) existing.courseName = courseName;
    } else {
      studentRowsMap.set(studentKey, {
        studentName,
        educatorName,
        courseName,
        rows: [row],
      });
    }
  });

  // 2. Itera sobre cada aluno único identificando sua matéria em andamento real
  let studentIdx = 0;
  studentRowsMap.forEach(({ studentName, educatorName, courseName, rows }) => {
    studentIdx++;

    // Extrai propriedades das linhas do aluno
    const parsedRows = rows
      .map((r, rIdx) => {
        const rawSubject = String(
          r.rawSubjectName ||
            r.subjectName ||
            r['Matéria'] ||
            r['Materia'] ||
            r['Curso'] ||
            ''
        ).trim();

        const currentLessonRaw =
          r.currentLesson ??
          r['Aula Atual'] ??
          r['Aula'] ??
          r['Aulas Realizadas'] ??
          1;
        const currentLesson =
          typeof currentLessonRaw === 'number'
            ? currentLessonRaw
            : parseInt(String(currentLessonRaw), 10) || 1;

        const dtInicioRaw = String(
          r.startDate ||
            r['Data Início Matéria'] ||
            r['Data Inicio Materia'] ||
            r['Data Início'] ||
            r['Data Inicio'] ||
            ''
        ).trim();
        const hasDate = Boolean(dtInicioRaw && dtInicioRaw !== 'nan' && dtInicioRaw !== '-');

        const hasPhysicalDelivery =
          r.physicalDelivery === 'Sim' ||
          r['Entrega Física'] === 'Sim' ||
          r.hasPhysicalDelivery === true;

        const nextSubjectRaw = String(
          r.nextSubject ||
            r['Próxima Matéria'] ||
            r['Proxima Materia'] ||
            ''
        ).trim();

        const remainingRaw = r.remainingSubjectsCount ?? r['Matérias Restantes'] ?? r['Materias Restantes'];
        const explicitRemaining = typeof remainingRaw === 'number' ? remainingRaw : undefined;

        return {
          originalRow: r,
          rawSubject,
          currentLesson,
          hasDate,
          dtInicioRaw,
          hasPhysicalDelivery,
          nextSubjectRaw,
          explicitRemaining,
          rIdx,
        };
      })
      .filter(
        (r) =>
          r.rawSubject &&
          !IGNORED_FORECAST_SUBJECTS.some((i) => normalizeText(r.rawSubject).includes(normalizeText(i)))
      );

    if (parsedRows.length === 0) return;

    // Classifica matérias iniciadas (com data de início ou aula > 1) vs não iniciadas na grade
    const startedRows = parsedRows.filter((r) => r.hasDate || r.currentLesson > 1);
    let unstartedRows = parsedRows.filter((r) => !r.hasDate && r.currentLesson <= 1);

    let activeRows: typeof parsedRows = [];

    if (startedRows.length > 0) {
      activeRows = startedRows;
    } else {
      // Aluno novo (todas as matérias em aula 1 sem data ainda):
      // Apenas a 1ª matéria da grade é a matéria em andamento atual
      activeRows = [unstartedRows[0]];
      unstartedRows = unstartedRows.slice(1);
    }

    // Frequência semanal configurada para o aluno
    const configuredFreq = frequencyConfigs[normalizeText(studentName)];
    const lessonsPerWeek = configuredFreq && configuredFreq >= 1 && configuredFreq <= 4 ? configuredFreq : 2;
    const isSpecial = lessonsPerWeek > 2;

    const remainingCount = unstartedRows.length > 0 ? unstartedRows.length : (activeRows[0]?.explicitRemaining ?? 0);

    // Helper interno para agendar uma demanda
    const scheduleDemand = (
      subjName: string,
      targetMonthIndex: number,
      weeksWait: number,
      demandStatus: 'imediato' | 'projetado',
      stage: 'atual' | 'proxima',
      subjCurrentLesson: number,
      subjTotalLessons: number,
      hasDelivery: boolean
    ) => {
      if (targetMonthIndex < 1 || targetMonthIndex > horizonMonths) return;

      const mSlot = monthlyCounts[targetMonthIndex];
      if (!mSlot) return;

      mSlot.count++;
      mSlot.students.add(studentName);
      mSlot.subjects[subjName] = (mSlot.subjects[subjName] || 0) + 1;
      uniqueStudentsGlobal.add(studentName);

      forecastItems.push({
        id: `fc_${studentIdx}_${normalizeText(studentName).replace(/\s+/g, '_')}_m${targetMonthIndex}_${stage}_${normalizeText(subjName).slice(0, 10)}`,
        studentName,
        subjectName: subjName,
        courseName,
        educatorName,
        currentLesson: subjCurrentLesson,
        totalLessons: subjTotalLessons,
        remainingLessonsInSubject: Math.max(0, subjTotalLessons - subjCurrentLesson),
        remainingSubjectsCount: remainingCount,
        lessonsPerWeek,
        isSpecial,
        triggerLesson,
        weeksUntilNextOrder: weeksWait,
        estimatedMonthLabel: `${mSlot.label} (${mSlot.relativeLabel})`,
        estimatedMonthIndex: targetMonthIndex,
        status: demandStatus,
        nextSubjectName: unstartedRows[0]?.rawSubject || '',
        hasPhysicalDelivery: hasDelivery,
        stage,
      });
    };

    // Para cada matéria em andamento real do aluno:
    activeRows.forEach((actRow) => {
      const subjectValidation = isValidForecastSubject(actRow.rawSubject, coursesConfig);
      if (!subjectValidation.valid) {
        issues.push({
          id: `issue_${studentIdx}_${actRow.rIdx}`,
          studentName,
          subjectName: actRow.rawSubject,
          issueType: 'missing_subject',
          description: subjectValidation.reason || 'Matéria não reconhecida no catálogo oficial',
          solutionTip: 'Verifique no Cadastro de Cursos se a matéria está ativa.',
        });
        return;
      }

      const cleanSubj = subjectValidation.cleanName;
      const courseInfo = resolveCourseTotalLessons(cleanSubj, coursesConfig);
      if (!courseInfo.active) return;

      const totalLessons = courseInfo.totalLessons;
      const remainingLessonsInSubject = Math.max(0, totalLessons - actRow.currentLesson);

      // =========================================================================
      // CICLO 1: APOSTILA DA MATÉRIA ATUAL (Se ainda não entregue fisicamente)
      // =========================================================================
      if (!actRow.hasPhysicalDelivery) {
        if (actRow.currentLesson >= triggerLesson) {
          // Já está na aula do gatilho ou acima e não tem apostila -> Demanda Imediata Mês 1
          scheduleDemand(
            cleanSubj,
            1,
            0,
            'imediato',
            'atual',
            actRow.currentLesson,
            totalLessons,
            actRow.hasPhysicalDelivery
          );
        } else {
          // Está antes do gatilho (ex: aula 1 a 3) -> atinge gatilho em algumas semanas
          const lessonsToTrigger = triggerLesson - actRow.currentLesson;
          const weeksToTrigger = Math.max(1, Math.ceil(lessonsToTrigger / lessonsPerWeek));
          const monthOfTrigger = Math.min(horizonMonths, Math.max(1, Math.ceil(weeksToTrigger / 4)));
          scheduleDemand(
            cleanSubj,
            monthOfTrigger,
            weeksToTrigger,
            'projetado',
            'atual',
            actRow.currentLesson,
            totalLessons,
            actRow.hasPhysicalDelivery
          );
        }
      }

      // =========================================================================
      // CICLO 2: APOSTILA DA PRÓXIMA MATÉRIA
      // O aluno conclui a matéria atual e atinge a aula gatilho (4) da próxima
      // =========================================================================
      const hasUpcomingSubjects = unstartedRows.length > 0 || actRow.nextSubjectRaw || remainingCount > 0;
      if (hasUpcomingSubjects) {
        const weeksToFinishCurrent = Math.max(0, Math.ceil(remainingLessonsInSubject / lessonsPerWeek));
        const weeksToTriggerNext = weeksToFinishCurrent + Math.max(1, Math.ceil(triggerLesson / lessonsPerWeek));
        const monthOfNext = Math.ceil(weeksToTriggerNext / 4);

        if (monthOfNext >= 1 && monthOfNext <= horizonMonths) {
          let nextSubjName = '';

          // 1. Tenta a próxima matéria informada explicitamente
          if (actRow.nextSubjectRaw) {
            const nextVal = isValidForecastSubject(actRow.nextSubjectRaw, coursesConfig);
            nextSubjName = nextVal.valid ? nextVal.cleanName : sanitizeRawSubject(actRow.nextSubjectRaw);
          }

          // 2. Tenta a 1ª matéria não iniciada da grade curricular do contrato
          if (!nextSubjName && unstartedRows.length > 0) {
            const unstartedCandidate = unstartedRows[0].rawSubject;
            const nextVal = isValidForecastSubject(unstartedCandidate, coursesConfig);
            nextSubjName = nextVal.valid ? nextVal.cleanName : sanitizeRawSubject(unstartedCandidate);
          }

          // 3. Tenta resolução sequencial lógica (ex: Módulo I -> Módulo II)
          if (!nextSubjName || nextSubjName === cleanSubj) {
            const sequential = resolveNextSequentialSubject(cleanSubj, coursesConfig);
            if (sequential) {
              nextSubjName = sequential;
            } else {
              nextSubjName = `Próx. Matéria pós ${cleanSubj}`;
            }
          }

          const nextCourseInfo = resolveCourseTotalLessons(nextSubjName, coursesConfig);

          scheduleDemand(
            nextSubjName,
            monthOfNext,
            weeksToTriggerNext,
            'projetado',
            'proxima',
            1,
            nextCourseInfo.totalLessons,
            false
          );
        }
      }
    });
  });

  // Constrói resumos mensais com totais e contagem de alunos únicos por mês
  let grandTotalWorkbooks = 0;
  const monthlySummaries: ForecastMonthlySummary[] = monthLabels.map((m) => {
    const slot = monthlyCounts[m.index];
    grandTotalWorkbooks += slot.count;

    const subjectsBreakdown = Object.entries(slot.subjects)
      .map(([subject, count]) => ({ subject, count }))
      .sort((a, b) => b.count - a.count);

    return {
      monthIndex: m.index,
      monthLabel: `${m.label} (${m.relativeLabel})`,
      totalWorkbooks: slot.count,
      uniqueStudentsCount: slot.students.size,
      subjectsBreakdown,
    };
  });

  return {
    forecastItems,
    monthlySummaries,
    uniqueStudentsCount: uniqueStudentsGlobal.size,
    totalWorkbooksCount: grandTotalWorkbooks,
    issues,
  };
}
