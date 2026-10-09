// ==============================================================================
// GESTÃO DE APOSTILAS - MICROLINS POTIRENDABA
// Motor de Regras: lib/domain/forecast-engine.ts
// Motor de Cálculo de Previsão de Apostilas & Cronograma de Compras
// ==============================================================================

import {
  CourseDurationConfig,
  StudentFrequencyConfig,
  ForecastStudentItem,
  ForecastMonthlySummary,
  DataIssueItem,
  ProcessedStudentItem,
} from '../../types';
import { cleanSubject, normalizeText } from './sanitizer';

/**
 * Cursos comportamentais e extracurriculares válidos mesmo sem prefixo numérico
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
 * Exceções conhecidas de total de aulas por matéria da Microlins
 */
export const DEFAULT_COURSE_EXCEPTIONS: Record<string, number> = {
  'Robótica 1': 24,
  'Robotica 1': 24,
  'Robótica 2': 24,
  'Robotica 2': 24,
  'Desenvolvimento de Games 2D': 24,
  'Desenvolvimento de Games 3D - Módulo I': 24,
  'Desenvolvimento de Games 3D - Modulo I': 24,
  'Desenvolvimento de Games 3D - Módulo II': 16,
  'Desenvolvimento de Games 3D - Modulo II': 16,
  'Lógica de Programação': 12,
  'Logica de Programacao': 12,
  'Google Adwords': 8,
  'Google Ads': 8,
  'Redes - Cabeamento e Infraestrutura': 13,
  'Redes - Lógica e Estruturação': 12,
  'Redes - Logica e Estruturacao': 12,
  'Redes - Tecnologia Wireless': 8,
};

/**
 * Duração padrão aplicada para qualquer matéria sem regra específica
 */
export const DEFAULT_LESSONS_PER_COURSE = 16;

/**
 * Retorna as configurações iniciais de duração de cursos do sistema
 */
export function getDefaultCourseDurations(): CourseDurationConfig[] {
  const baseList: { name: string; totalLessons: number }[] = [
    { name: 'Word 2021', totalLessons: 16 },
    { name: 'Excel 2021', totalLessons: 16 },
    { name: 'PowerPoint 2021', totalLessons: 16 },
    { name: 'Windows 11', totalLessons: 16 },
    { name: 'Internet e Redes Sociais', totalLessons: 16 },
    { name: 'Robótica 1', totalLessons: 24 },
    { name: 'Robótica 2', totalLessons: 24 },
    { name: 'Desenvolvimento de Games 2D', totalLessons: 24 },
    { name: 'Desenvolvimento de Games 3D - Módulo I', totalLessons: 24 },
    { name: 'Desenvolvimento de Games 3D - Módulo II', totalLessons: 16 },
    { name: 'Lógica de Programação', totalLessons: 12 },
    { name: 'Google Adwords', totalLessons: 8 },
    { name: 'Redes - Cabeamento e Infraestrutura', totalLessons: 13 },
    { name: 'Redes - Lógica e Estruturação', totalLessons: 12 },
    { name: 'Redes - Tecnologia Wireless', totalLessons: 8 },
    { name: 'Photoshop', totalLessons: 16 },
    { name: 'CorelDraw', totalLessons: 16 },
    { name: 'Ilustração Digital', totalLessons: 16 },
    { name: 'Design Gráfico', totalLessons: 16 },
    { name: 'Edição de Vídeo', totalLessons: 16 },
    { name: 'Operador de Caixa', totalLessons: 16 },
    { name: 'Auxiliar Administrativo', totalLessons: 16 },
    { name: 'Gestão de Pessoas', totalLessons: 16 },
    { name: 'Marketing Digital', totalLessons: 16 },
    { name: 'Inteligência Emocional', totalLessons: 16 },
    { name: 'Marketing Pessoal', totalLessons: 16 },
    { name: 'Comunicação e Oratória', totalLessons: 16 },
    { name: 'Educação Financeira', totalLessons: 16 },
    { name: 'Inovação e Criatividade', totalLessons: 16 },
    { name: 'Negociação, Objeções e Influência', totalLessons: 16 },
    { name: 'Produtividade e Gestão do Tempo', totalLessons: 16 },
  ];

  return baseList.map((c, i) => ({
    id: `course_${i + 1}`,
    name: c.name,
    totalLessons: c.totalLessons,
    active: true,
  }));
}

/**
 * Valida e higieniza a matéria conforme regras de negócio da Microlins
 */
export function isValidForecastSubject(rawSubject: string): {
  valid: boolean;
  cleanName: string;
  reason?: string;
} {
  if (!rawSubject || !rawSubject.trim()) {
    return { valid: false, cleanName: '', reason: 'Nome da matéria vazio' };
  }

  const trimmed = rawSubject.trim();

  // Verifica se é matéria ignorada (ex: Digitação, Inglês)
  for (const ignored of IGNORED_FORECAST_SUBJECTS) {
    if (normalizeText(trimmed).includes(normalizeText(ignored))) {
      return { valid: false, cleanName: trimmed, reason: 'Matéria excluída (Inglês/Digitação)' };
    }
  }

  // Verifica se está na lista de exceções válidas sem número
  for (const allowed of ALLOWED_SPECIAL_SUBJECTS) {
    if (normalizeText(trimmed).includes(normalizeText(allowed))) {
      return { valid: true, cleanName: allowed };
    }
  }

  // Se tiver código numérico no início (ex: 161869_Windows 11)
  const hasPrefix = /^\d+_\s*/.test(trimmed);
  if (hasPrefix) {
    return { valid: true, cleanName: cleanSubject(trimmed) };
  }

  // Cursos descontinuados sem prefixo (ex: Youtuber) são ignorados
  return {
    valid: false,
    cleanName: trimmed,
    reason: 'Curso descontinuado (sem código identificador)',
  };
}

/**
 * Busca a duração total de uma matéria baseando-se no catálogo configurado
 */
export function resolveCourseTotalLessons(
  subjectName: string,
  coursesConfig: CourseDurationConfig[]
): { totalLessons: number; active: boolean } {
  const normTarget = normalizeText(subjectName);

  // Procura no catálogo configurado pelo operador
  const found = coursesConfig.find((c) => normalizeText(c.name) === normTarget);
  if (found) {
    return { totalLessons: found.totalLessons, active: found.active };
  }

  // Procura nas exceções padrão
  for (const [key, val] of Object.entries(DEFAULT_COURSE_EXCEPTIONS)) {
    if (normalizeText(key) === normTarget) {
      return { totalLessons: val, active: true };
    }
  }

  // Duração padrão
  return { totalLessons: DEFAULT_LESSONS_PER_COURSE, active: true };
}

/**
 * Nomes dos meses futuros a partir da data de referência
 */
export function getUpcomingMonthLabels(
  referenceDate: Date = new Date(),
  totalMonths: number = 4
): { index: number; label: string; yearMonth: string }[] {
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

  const result: { index: number; label: string; yearMonth: string }[] = [];
  const currentMonth = referenceDate.getMonth(); // 0..11
  const currentYear = referenceDate.getFullYear();

  for (let i = 0; i < totalMonths; i++) {
    const targetDate = new Date(currentYear, currentMonth + i, 1);
    const mIdx = targetDate.getMonth();
    const yr = targetDate.getFullYear();
    result.push({
      index: i + 1,
      label: `${monthsBR[mIdx]} / ${yr}`,
      yearMonth: `${yr}-${String(mIdx + 1).padStart(2, '0')}`,
    });
  }

  return result;
}

/**
 * Calcula a projeção cronológica de solicitações de apostila para os alunos
 */
export function computeStudentsForecast(params: {
  rawOrProcessedItems: (ProcessedStudentItem | Record<string, unknown>)[];
  coursesConfig: CourseDurationConfig[];
  frequencyConfigs: Record<string, number>; // aluno -> aulas por semana
  triggerLesson?: number; // padrão 4
  horizonMonths?: number; // 1 a 4 meses
  referenceDate?: Date;
}): {
  forecastItems: ForecastStudentItem[];
  monthlySummaries: ForecastMonthlySummary[];
  issues: DataIssueItem[];
} {
  const {
    rawOrProcessedItems,
    coursesConfig,
    frequencyConfigs,
    triggerLesson = 4,
    horizonMonths = 4,
    referenceDate = new Date(),
  } = params;

  const monthLabels = getUpcomingMonthLabels(referenceDate, horizonMonths);
  const forecastItems: ForecastStudentItem[] = [];
  const issues: DataIssueItem[] = [];

  const monthlyCounts: Record<number, { label: string; count: number; subjects: Record<string, number> }> = {};
  monthLabels.forEach((m) => {
    monthlyCounts[m.index] = { label: m.label, count: 0, subjects: {} };
  });

  const processedStudentsSet = new Set<string>();

  rawOrProcessedItems.forEach((row, idx) => {
    const studentName = String(
      (row as any).studentName || (row as any)['Aluno'] || (row as any)['Nome'] || ''
    ).trim();
    const rawSubject = String(
      (row as any).rawSubjectName ||
        (row as any).subjectName ||
        (row as any)['Matéria'] ||
        (row as any)['Materia'] ||
        (row as any)['Curso'] ||
        ''
    ).trim();
    const educatorName = String(
      (row as any).educatorName || (row as any)['Educador'] || ''
    ).trim();
    const currentLessonRaw =
      (row as any).currentLesson ??
      (row as any)['Aula'] ??
      (row as any)['Aulas Realizadas'] ??
      (row as any)['Aulas'] ??
      1;

    if (!studentName) {
      return; // Linha sem aluno
    }

    // Evita duplicatas se mesmo aluno vier listado repetido no relatório
    const studentKey = `${normalizeText(studentName)}__${normalizeText(rawSubject)}`;
    if (processedStudentsSet.has(studentKey)) {
      return;
    }
    processedStudentsSet.add(studentKey);

    const currentLesson = typeof currentLessonRaw === 'number' ? currentLessonRaw : parseInt(String(currentLessonRaw), 10) || 1;

    // 1. Validação da matéria
    const subjectValidation = isValidForecastSubject(rawSubject);
    if (!subjectValidation.valid) {
      if (rawSubject && !IGNORED_FORECAST_SUBJECTS.some((i) => normalizeText(rawSubject).includes(normalizeText(i)))) {
        issues.push({
          id: `issue_${idx}_subj`,
          studentName,
          subjectName: rawSubject,
          issueType: 'missing_subject',
          description: subjectValidation.reason || 'Matéria inválida ou descontinuada',
          solutionTip: 'Verifique se a matéria possui código ou se foi desativada no cadastro.',
        });
      }
      return;
    }

    const cleanSubj = subjectValidation.cleanName;

    // 2. Busca duração do curso
    const courseDuration = resolveCourseTotalLessons(cleanSubj, coursesConfig);
    if (!courseDuration.active) {
      // Curso desativado na lixeira do Cadastro de Cursos
      return;
    }

    const totalLessons = courseDuration.totalLessons;

    // Detecta pendência de aula inconsistente
    if (currentLesson > totalLessons) {
      issues.push({
        id: `issue_${idx}_lesson`,
        studentName,
        subjectName: cleanSubj,
        issueType: 'missing_lesson',
        description: `Aula atual (${currentLesson}) é maior que a duração total da matéria (${totalLessons} aulas)`,
        solutionTip: 'Ajuste a duração total da matéria no Cadastro de Cursos.',
      });
    }

    // 3. Frequência semanal (aulas por semana)
    const configuredFreq = frequencyConfigs[normalizeText(studentName)];
    const lessonsPerWeek = configuredFreq && configuredFreq >= 1 && configuredFreq <= 4 ? configuredFreq : 2;
    const isSpecial = lessonsPerWeek > 2;

    // 4. Matérias restantes (do Controle Pedagógico se disponível)
    const remainingSubjectsRaw =
      (row as any).remainingSubjectsCount ??
      (row as any)['Matérias Restantes'] ??
      (row as any)['Materias Restantes'] ??
      (row as any)['Qtd Materias Restantes'] ??
      1;
    const remainingSubjectsCount = typeof remainingSubjectsRaw === 'number'
      ? remainingSubjectsRaw
      : parseInt(String(remainingSubjectsRaw), 10) || 1;

    // 5. Cálculo da solicitação
    const hasPhysicalDelivery =
      (row as any).physicalDelivery === 'Sim' ||
      (row as any)['Entrega Física'] === 'Sim' ||
      (row as any).hasPhysicalDelivery === true;

    let weeksUntilNextOrder = 0;
    let estimatedMonthIndex = 1; // Padrão Mês 1
    let status: 'imediato' | 'projetado' | 'sem_demanda' = 'projetado';

    const remainingLessonsInSubject = Math.max(0, totalLessons - currentLesson);

    if (!hasPhysicalDelivery && currentLesson >= triggerLesson) {
      // Aluno já está na aula do gatilho ou superior e ainda não tem apostila -> Pedido Imediato no Mês 1
      status = 'imediato';
      weeksUntilNextOrder = 0;
      estimatedMonthIndex = 1;
    } else if (!hasPhysicalDelivery && currentLesson < triggerLesson) {
      // Precisa da apostila da matéria atual ao atingir o gatilho
      const lessonsUntilTrigger = triggerLesson - currentLesson;
      weeksUntilNextOrder = Math.max(1, Math.ceil(lessonsUntilTrigger / lessonsPerWeek));
      // Cada mês possui aproximadamente 4 semanas
      estimatedMonthIndex = Math.min(horizonMonths, Math.max(1, Math.ceil(weeksUntilNextOrder / 4)));
      status = 'projetado';
    } else {
      // Já possui a apostila da matéria atual -> solicitação será para a PRÓXIMA matéria
      if (remainingSubjectsCount <= 0) {
        status = 'sem_demanda';
        estimatedMonthIndex = 0;
      } else {
        // Aulas até terminar atual + atingir gatilho da próxima
        const lessonsUntilNextSubjectTrigger = remainingLessonsInSubject + triggerLesson;
        weeksUntilNextOrder = Math.max(1, Math.ceil(lessonsUntilNextSubjectTrigger / lessonsPerWeek));
        estimatedMonthIndex = Math.ceil(weeksUntilNextOrder / 4);

        if (estimatedMonthIndex > horizonMonths) {
          status = 'sem_demanda';
          estimatedMonthIndex = 0;
        } else {
          status = 'projetado';
        }
      }
    }

    const estimatedMonthObj = monthLabels.find((m) => m.index === estimatedMonthIndex);
    const estimatedMonthLabel = estimatedMonthObj ? estimatedMonthObj.label : 'Fora do Período';

    // Contabiliza nos resumos mensais se estiver dentro do horizonte
    if (estimatedMonthIndex >= 1 && estimatedMonthIndex <= horizonMonths) {
      const monthSlot = monthlyCounts[estimatedMonthIndex];
      if (monthSlot) {
        monthSlot.count++;
        monthSlot.subjects[cleanSubj] = (monthSlot.subjects[cleanSubj] || 0) + 1;
      }
    }

    forecastItems.push({
      id: `fc_${idx}_${normalizeText(studentName).replace(/\s+/g, '_')}`,
      studentName,
      subjectName: cleanSubj,
      courseName: (row as any).courseName || '',
      educatorName,
      currentLesson,
      totalLessons,
      remainingLessonsInSubject,
      remainingSubjectsCount,
      lessonsPerWeek,
      isSpecial,
      triggerLesson,
      weeksUntilNextOrder,
      estimatedMonthLabel,
      estimatedMonthIndex,
      status,
      nextSubjectName: (row as any).nextSubject || '',
      hasPhysicalDelivery,
    });
  });

  // Constrói o resumo mensal consolidado
  const monthlySummaries: ForecastMonthlySummary[] = monthLabels.map((m) => {
    const slot = monthlyCounts[m.index];
    const subjectsBreakdown = Object.entries(slot.subjects)
      .map(([subject, count]) => ({ subject, count }))
      .sort((a, b) => b.count - a.count);

    return {
      monthIndex: m.index,
      monthLabel: m.label,
      totalWorkbooks: slot.count,
      subjectsBreakdown,
    };
  });

  return {
    forecastItems,
    monthlySummaries,
    issues,
  };
}
