'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  CalendarClock,
  TrendingUp,
  Users,
  BookOpen,
  AlertTriangle,
  FileSpreadsheet,
  Save,
  Search,
  Plus,
  Trash2,
  RefreshCw,
  Upload,
  CheckCircle2,
  Filter,
  Layers,
  ChevronDown,
  ChevronRight,
  Target,
  Sparkles,
  RotateCcw,
  X,
  Info,
  ShieldCheck,
  Clock,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import {
  CourseDurationConfig,
  ForecastMonthlySummary,
  ForecastStudentItem,
  DataIssueItem,
  ProcessedStudentItem,
} from '../../types';
import {
  getDefaultCourseDurations,
  computeStudentsForecast,
  getUpcomingMonthLabels,
} from '../../lib/domain/forecast-engine';
import { normalizeText } from '../../lib/domain/sanitizer';
import { exportForecastToExcel } from '../../lib/export/excel-forecast-export';
import { useDialog } from '../ui/dialog';
import { supabase } from '../../lib/supabase/client';
import { parseSpreadsheetBuffer } from '../../lib/importers';

interface ForecastTabProps {
  currentOrderItems: ProcessedStudentItem[];
  rawRows?: Record<string, unknown>[];
  unitId?: string;
  ignoredSubjects?: string[];
  historicalMap?: Map<string, string>;
}

export function ForecastTab({
  currentOrderItems,
  rawRows = [],
  unitId,
  ignoredSubjects = [],
  historicalMap,
}: ForecastTabProps) {
  const { showAlert, showConfirm, showToast } = useDialog();

  // Sub-abas internas da Previsão
  const [activeSubTab, setActiveSubTab] = useState<'cronograma' | 'frequencia' | 'cursos' | 'pendencias'>('cronograma');

  // Modo de visualização do Cronograma: 'subjects' (Por Matéria / Apostila) ou 'students' (Por Aluno)
  const [scheduleViewMode, setScheduleViewMode] = useState<'subjects' | 'students'>('subjects');

  // Controle de accordion de matérias expandidas na visão por matéria
  const [expandedSubjects, setExpandedSubjects] = useState<Record<string, boolean>>({});

  // Parâmetros de projeção e filtros refinados
  const [horizonMonths, setHorizonMonths] = useState<1 | 2 | 3 | 4>(4);
  const [triggerLesson, setTriggerLesson] = useState<number>(4);
  const [searchStudent, setSearchStudent] = useState<string>('');
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [filterWeek, setFilterWeek] = useState<string>('all'); // 'all', '0', '1', '2', '3', '4', 'until_1', 'until_2', 'until_3'
  const [filterStage, setFilterStage] = useState<'all' | 'atual' | 'proxima'>('all');
  const [filterPace, setFilterPace] = useState<'all' | '1x' | '2x' | '4x' | 'special'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'imediato' | 'projetado'>('all');
  const [sortColumn, setSortColumn] = useState<'student' | 'subject' | 'lesson' | 'pace' | 'stage' | 'week' | 'status'>('week');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Controle de deduplicação com o Histórico de Pedidos
  const [excludeHistorical, setExcludeHistorical] = useState<boolean>(true);
  const [showExcludedModal, setShowExcludedModal] = useState<boolean>(false);

  // Filtro por abas na sub-aba de Frequência: Todos, 1 aula, 2 aulas, 4 aulas, Personalizado
  const [frequencyFilterTab, setFrequencyFilterTab] = useState<'all' | '1x' | '2x' | '4x' | 'custom'>('all');

  // Modo da fonte de dados dos alunos
  const [sourceMode, setSourceMode] = useState<'full_sheet' | 'current_order' | 'custom_file'>('full_sheet');
  const [sourceItems, setSourceItems] = useState<(ProcessedStudentItem | Record<string, unknown>)[]>([]);
  const [customUploadedFileName, setCustomUploadedFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Matérias ignoradas sincronizadas com unit_settings das Configurações
  const [syncedIgnoredSubjects, setSyncedIgnoredSubjects] = useState<string[]>(() => {
    if (ignoredSubjects && ignoredSubjects.length > 0) return ignoredSubjects;
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('microlins_unit_settings');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed.ignored_subjects) && parsed.ignored_subjects.length > 0) {
            return parsed.ignored_subjects;
          }
        }
      } catch (e) {}
    }
    return ['Digitação', 'Digitacao'];
  });

  // 1. Configurações de Cursos (Durações e Ativação) - Carrega os 101 cursos oficiais do sistema_fichas.db
  const [coursesConfig, setCoursesConfig] = useState<CourseDurationConfig[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('microlins_forecast_courses');
        if (cached) {
          const parsed = JSON.parse(cached);
          // Se tiver pelo menos 80 cursos, aceita o cache; senão, carrega a lista oficial de 101 cursos
          if (Array.isArray(parsed) && parsed.length >= 80) {
            return parsed;
          }
        }
      } catch (e) {}
    }
    return getDefaultCourseDurations();
  });

  // Busca e modal no cadastro de cursos
  const [courseSearch, setCourseSearch] = useState('');
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseDuration, setNewCourseDuration] = useState(16);
  const [isAddCourseModalOpen, setIsAddCourseModalOpen] = useState(false);

  // 2. Frequência individual dos alunos (aulas/semana) - Normaliza chaves com normalizeText
  const [frequencyConfigs, setFrequencyConfigs] = useState<Record<string, number>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('microlins_forecast_frequencies');
        if (cached) {
          const parsed = JSON.parse(cached);
          const normalized: Record<string, number> = {};
          for (const [k, v] of Object.entries(parsed)) {
            normalized[normalizeText(k)] = Number(v);
          }
          return normalized;
        }
      } catch (e) {}
    }
    return {};
  });

  // Filtros de Pendências
  const [issueFilterStudent, setIssueFilterStudent] = useState('');
  const [issueFilterSubject, setIssueFilterSubject] = useState('');
  const [issueFilterType, setIssueFilterType] = useState('all');

  // Atualiza syncedIgnoredSubjects caso a prop ignoredSubjects seja fornecida
  useEffect(() => {
    if (ignoredSubjects && ignoredSubjects.length > 0) {
      setSyncedIgnoredSubjects(ignoredSubjects);
    }
  }, [ignoredSubjects]);

  // Inicializa fonte de dados priorizando a planilha completa com todos os alunos
  useEffect(() => {
    if (sourceMode === 'full_sheet') {
      if (rawRows && rawRows.length > 0) {
        setSourceItems(rawRows);
      } else if (currentOrderItems && currentOrderItems.length > 0) {
        setSourceItems(currentOrderItems);
        setSourceMode('current_order');
      }
    } else if (sourceMode === 'current_order') {
      if (currentOrderItems && currentOrderItems.length > 0) {
        setSourceItems(currentOrderItems);
      }
    }
  }, [rawRows, currentOrderItems, sourceMode]);

  // Carrega configurações persistidas do Supabase ao montar (forecast_settings e unit_settings)
  useEffect(() => {
    async function fetchSavedConfigs() {
      try {
        const currentUnit = unitId || process.env.NEXT_PUBLIC_DEFAULT_UNIT_ID || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
        if (!currentUnit) return;

        // 1. Carrega unit_settings para sincronizar matérias ignoradas cadastradas (ex: Annual Book 2)
        const { data: unitSettingsData } = await supabase
          .from('unit_settings')
          .select('ignored_subjects')
          .eq('unit_id', currentUnit)
          .maybeSingle();

        if (unitSettingsData && Array.isArray(unitSettingsData.ignored_subjects) && unitSettingsData.ignored_subjects.length > 0) {
          setSyncedIgnoredSubjects(unitSettingsData.ignored_subjects);
          if (typeof window !== 'undefined') {
            try {
              const currentCache = JSON.parse(localStorage.getItem('microlins_unit_settings') || '{}');
              currentCache.ignored_subjects = unitSettingsData.ignored_subjects;
              localStorage.setItem('microlins_unit_settings', JSON.stringify(currentCache));
            } catch (e) {}
          }
        }

        // 2. Carrega configurações da previsão
        const { data } = await supabase
          .from('audit_logs')
          .select('metadata')
          .eq('unit_id', currentUnit)
          .eq('entity_type', 'forecast_settings')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data && data.metadata) {
          const raw = data.metadata as any;
          if (Array.isArray(raw.forecast_courses) && raw.forecast_courses.length >= 80) {
            setCoursesConfig(raw.forecast_courses);
          }
          if (raw.forecast_frequencies && typeof raw.forecast_frequencies === 'object') {
            const normalizedFreqs: Record<string, number> = {};
            for (const [k, v] of Object.entries(raw.forecast_frequencies)) {
              normalizedFreqs[normalizeText(k)] = Number(v);
            }
            setFrequencyConfigs(normalizedFreqs);
          }
        }
      } catch (err) {
        console.warn('Configurações salvas da previsão não puderam ser recuperadas do banco:', err);
      }
    }
    fetchSavedConfigs();
  }, [unitId]);

  // Handler de upload direto de planilha avulsa para a Previsão
  const handleDirectFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const buffer = event.target?.result as ArrayBuffer;
        const parsed = parseSpreadsheetBuffer(buffer, {
          lessonMin: 1,
          lessonMax: 99,
          allLessons: true,
          ignoredSubjects: syncedIgnoredSubjects,
          excludedContractTypes: ['Bolsista'],
        });

        if (parsed.rawRows.length === 0 && parsed.eligibleItems.length === 0) {
          showAlert('Nenhum registro legível encontrado na planilha.', 'error', 'Upload de Planilha');
          return;
        }

        const itemsToUse = parsed.rawRows.length > 0 ? parsed.rawRows : parsed.eligibleItems;
        setSourceItems(itemsToUse);
        setSourceMode('custom_file');
        setCustomUploadedFileName(file.name);
        showToast(`Planilha "${file.name}" carregada com ${itemsToUse.length} registros!`, 'success');
      } catch (err: any) {
        showAlert(`Falha ao ler planilha: ${err.message}`, 'error', 'Erro de Leitura');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // Alterna entre fonte completa e pedido físico atual
  const handleSelectSource = (mode: 'full_sheet' | 'current_order') => {
    setSourceMode(mode);
    setCustomUploadedFileName('');
    if (mode === 'full_sheet') {
      if (rawRows && rawRows.length > 0) {
        setSourceItems(rawRows);
        showToast(`Utilizando toda a escola (${rawRows.length} registros da planilha completa)!`, 'info');
      } else {
        showAlert('A planilha completa não foi carregada no passo 1.', 'warning');
      }
    } else {
      if (currentOrderItems && currentOrderItems.length > 0) {
        setSourceItems(currentOrderItems);
        showToast(`Utilizando ${currentOrderItems.length} alunos do pedido físico atual!`, 'info');
      } else {
        showAlert('Não há alunos carregados no pedido em elaboração.', 'warning');
      }
    }
  };

  // Cálculo do Motor de Previsão Multi-Meses & Multi-Ciclos
  const forecastResult = useMemo(() => {
    const itemsToProcess =
      sourceItems.length > 0
        ? sourceItems
        : rawRows && rawRows.length > 0
        ? rawRows
        : currentOrderItems;

    return computeStudentsForecast({
      rawOrProcessedItems: itemsToProcess,
      coursesConfig,
      frequencyConfigs,
      triggerLesson,
      horizonMonths,
      ignoredSubjects: syncedIgnoredSubjects,
      historicalMap,
      excludeHistorical,
    });
  }, [sourceItems, rawRows, currentOrderItems, coursesConfig, frequencyConfigs, triggerLesson, horizonMonths, syncedIgnoredSubjects, historicalMap, excludeHistorical]);

  // Rótulos amigáveis dos meses (Mês 1 Atual, Daqui a 1 mês, Daqui a 2 meses, Daqui a 3 meses)
  const monthLabels = useMemo(() => getUpcomingMonthLabels(new Date(), horizonMonths), [horizonMonths]);

  // Helpers de filtragem refinada
  const matchesWeekFilter = useCallback((item: ForecastStudentItem, filter: string): boolean => {
    if (filter === 'all') return true;
    if (item.estimatedMonthIndex !== 1) return false;
    if (filter === '0') return item.weeksUntilNextOrder === 0;
    if (filter === '1') return item.weeksUntilNextOrder === 1;
    if (filter === '2') return item.weeksUntilNextOrder === 2;
    if (filter === '3') return item.weeksUntilNextOrder === 3;
    if (filter === '4') return item.weeksUntilNextOrder >= 4;
    if (filter === 'until_1') return item.weeksUntilNextOrder <= 1;
    if (filter === 'until_2') return item.weeksUntilNextOrder <= 2;
    if (filter === 'until_3') return item.weeksUntilNextOrder <= 3;
    return true;
  }, []);

  const matchesPaceFilter = useCallback((item: ForecastStudentItem, filter: string): boolean => {
    if (filter === 'all') return true;
    if (filter === '1x') return item.lessonsPerWeek === 1;
    if (filter === '2x') return item.lessonsPerWeek === 2;
    if (filter === '4x') return item.lessonsPerWeek === 4;
    if (filter === 'special') return item.isSpecial || item.lessonsPerWeek > 2;
    return true;
  }, []);

  const matchesStageFilter = useCallback((item: ForecastStudentItem, filter: string): boolean => {
    if (filter === 'all') return true;
    return item.stage === filter;
  }, []);

  const matchesStatusFilter = useCallback((item: ForecastStudentItem, filter: string): boolean => {
    if (filter === 'all') return true;
    return item.status === filter;
  }, []);

  // Helper de ordenação dinâmica das colunas
  const sortStudentItems = useCallback(
    (
      items: ForecastStudentItem[],
      column: 'student' | 'subject' | 'lesson' | 'pace' | 'stage' | 'week' | 'status',
      direction: 'asc' | 'desc'
    ): ForecastStudentItem[] => {
      return [...items].sort((a, b) => {
        let cmp = 0;
        switch (column) {
          case 'student':
            cmp = a.studentName.localeCompare(b.studentName);
            break;
          case 'subject':
            cmp = a.subjectName.localeCompare(b.subjectName);
            break;
          case 'lesson':
            cmp = a.currentLesson - b.currentLesson;
            break;
          case 'pace':
            cmp = a.lessonsPerWeek - b.lessonsPerWeek;
            break;
          case 'stage':
            cmp = (a.stage || '').localeCompare(b.stage || '');
            break;
          case 'week':
            cmp = a.weeksUntilNextOrder - b.weeksUntilNextOrder;
            break;
          case 'status':
            cmp = a.status.localeCompare(b.status);
            break;
        }
        return direction === 'asc' ? cmp : -cmp;
      });
    },
    []
  );

  const handleSort = (col: typeof sortColumn) => {
    if (sortColumn === col) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(col);
      setSortDirection('asc');
    }
  };

  const hasActiveFilters =
    searchStudent.trim().length > 0 ||
    filterMonth !== 'all' ||
    filterWeek !== 'all' ||
    filterStage !== 'all' ||
    filterPace !== 'all' ||
    filterStatus !== 'all';

  const handleClearFilters = () => {
    setSearchStudent('');
    setFilterMonth('all');
    setFilterWeek('all');
    setFilterStage('all');
    setFilterPace('all');
    setFilterStatus('all');
  };

  // Alunos e demandas filtrados para a tabela do Cronograma (Visão por Aluno)
  const filteredForecastItems: ForecastStudentItem[] = useMemo(() => {
    const filtered = forecastResult.forecastItems.filter((item) => {
      if (searchStudent) {
        const q = searchStudent.toLowerCase();
        const matchesName = item.studentName.toLowerCase().includes(q);
        const matchesSubj = item.subjectName.toLowerCase().includes(q);
        if (!matchesName && !matchesSubj) return false;
      }
      if (filterMonth !== 'all' && item.estimatedMonthIndex !== parseInt(filterMonth, 10)) {
        return false;
      }
      if (!matchesWeekFilter(item, filterWeek)) return false;
      if (!matchesStageFilter(item, filterStage)) return false;
      if (!matchesPaceFilter(item, filterPace)) return false;
      if (!matchesStatusFilter(item, filterStatus)) return false;
      return true;
    });

    return sortStudentItems(filtered, sortColumn, sortDirection);
  }, [
    forecastResult.forecastItems,
    searchStudent,
    filterMonth,
    filterWeek,
    filterStage,
    filterPace,
    filterStatus,
    sortColumn,
    sortDirection,
    matchesWeekFilter,
    matchesStageFilter,
    matchesPaceFilter,
    matchesStatusFilter,
    sortStudentItems,
  ]);

  // Lista única de alunos para a sub-aba de Frequência, isolando formações distintas (ex: Caleb com 2 contratos)
  const frequencyStudentsList = useMemo(() => {
    const map = new Map<string, ForecastStudentItem>();
    forecastResult.forecastItems.forEach((item) => {
      const key = `${normalizeText(item.studentName)}:::${normalizeText(item.courseName || '')}`;
      if (!map.has(key)) {
        map.set(key, item);
      }
    });
    return Array.from(map.values());
  }, [forecastResult.forecastItems]);

  // Contadores dinâmicos para as abas de frequência
  const frequencyCounts = useMemo(() => {
    let count1x = 0;
    let count2x = 0;
    let count4x = 0;
    let countCustom = 0;

    frequencyStudentsList.forEach((s) => {
      if (s.lessonsPerWeek === 1) count1x++;
      else if (s.lessonsPerWeek === 2) count2x++;
      else if (s.lessonsPerWeek === 4) count4x++;
      else countCustom++;
    });

    return {
      all: frequencyStudentsList.length,
      count1x,
      count2x,
      count4x,
      countCustom,
    };
  }, [frequencyStudentsList]);

  // Alunos filtrados pela aba de frequência selecionada
  const filteredFrequencyStudents = useMemo(() => {
    return frequencyStudentsList.filter((item) => {
      if (searchStudent && !item.studentName.toLowerCase().includes(searchStudent.toLowerCase())) {
        return false;
      }
      if (frequencyFilterTab === '1x') return item.lessonsPerWeek === 1;
      if (frequencyFilterTab === '2x') return item.lessonsPerWeek === 2;
      if (frequencyFilterTab === '4x') return item.lessonsPerWeek === 4;
      if (frequencyFilterTab === 'custom') {
        return item.lessonsPerWeek !== 1 && item.lessonsPerWeek !== 2 && item.lessonsPerWeek !== 4;
      }
      return true;
    });
  }, [frequencyStudentsList, searchStudent, frequencyFilterTab]);

  // Agrupamento por Mês e por Matéria para responder: "Quais apostilas, quantas em cada mês, quais alunos?"
  const monthlySubjectsGrouped = useMemo(() => {
    const result: {
      monthIndex: number;
      monthLabel: string;
      relativeLabel: string;
      totalWorkbooks: number;
      uniqueStudentsCount: number;
      subjects: {
        subjectName: string;
        count: number;
        students: ForecastStudentItem[];
      }[];
    }[] = [];

    monthLabels.forEach((m) => {
      // Se tiver filtro de mês específico e não for este, ignora
      if (filterMonth !== 'all' && m.index !== parseInt(filterMonth, 10)) {
        return;
      }

      const itemsInMonth = forecastResult.forecastItems.filter((item) => {
        if (item.estimatedMonthIndex !== m.index) return false;
        if (searchStudent) {
          const q = searchStudent.toLowerCase();
          return item.studentName.toLowerCase().includes(q) || item.subjectName.toLowerCase().includes(q);
        }
        if (!matchesWeekFilter(item, filterWeek)) return false;
        if (!matchesStageFilter(item, filterStage)) return false;
        if (!matchesPaceFilter(item, filterPace)) return false;
        if (!matchesStatusFilter(item, filterStatus)) return false;
        return true;
      });

      const uniqueStudentsInMonth = new Set(itemsInMonth.map((i) => i.studentName.toLowerCase())).size;

      // Agrupa por matéria
      const subjectsMap = new Map<string, ForecastStudentItem[]>();
      itemsInMonth.forEach((it) => {
        const arr = subjectsMap.get(it.subjectName) || [];
        arr.push(it);
        subjectsMap.set(it.subjectName, arr);
      });

      const subjectsList = Array.from(subjectsMap.entries())
        .map(([subjectName, students]) => ({
          subjectName,
          count: students.length,
          students: sortStudentItems(students, sortColumn, sortDirection),
        }))
        .sort((a, b) => b.count - a.count);

      result.push({
        monthIndex: m.index,
        monthLabel: m.label,
        relativeLabel: m.relativeLabel,
        totalWorkbooks: itemsInMonth.length,
        uniqueStudentsCount: uniqueStudentsInMonth,
        subjects: subjectsList,
      });
    });

    return result;
  }, [
    monthLabels,
    forecastResult.forecastItems,
    filterMonth,
    searchStudent,
    filterWeek,
    filterStage,
    filterPace,
    filterStatus,
    sortColumn,
    sortDirection,
    matchesWeekFilter,
    matchesStageFilter,
    matchesPaceFilter,
    matchesStatusFilter,
    sortStudentItems,
  ]);

  // Alterna expansão de uma matéria específica
  const toggleSubjectExpanded = (key: string) => {
    setExpandedSubjects((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Altera aulas/semana in-place para um aluno com chave normalizada (elimina falhas com acentos)
  const handleUpdateStudentFrequency = (studentName: string, newLessons: number, courseName?: string) => {
    const studentKey = normalizeText(studentName);
    const specificKey = courseName ? `${studentKey}:::${normalizeText(courseName)}` : studentKey;
    setFrequencyConfigs((prev) => {
      const updated = {
        ...prev,
        [studentKey]: newLessons,
        ...(courseName ? { [specificKey]: newLessons } : {}),
      };
      if (typeof window !== 'undefined') {
        localStorage.setItem('microlins_forecast_frequencies', JSON.stringify(updated));
      }
      return updated;
    });
    setHasUnsavedChanges(true);
  };

  // Altera total de aulas de um curso in-place
  const handleUpdateCourseDuration = (courseId: string, totalLessons: number) => {
    if (isNaN(totalLessons) || totalLessons < 1) return;
    setCoursesConfig((prev) => {
      const updated = prev.map((c) => (c.id === courseId ? { ...c, totalLessons } : c));
      if (typeof window !== 'undefined') {
        localStorage.setItem('microlins_forecast_courses', JSON.stringify(updated));
      }
      return updated;
    });
    setHasUnsavedChanges(true);
  };

  // Alterna ativação / exclusão na lixeira do curso
  const handleToggleCourseActive = (courseId: string) => {
    setCoursesConfig((prev) => {
      const updated = prev.map((c) => (c.id === courseId ? { ...c, active: !c.active } : c));
      if (typeof window !== 'undefined') {
        localStorage.setItem('microlins_forecast_courses', JSON.stringify(updated));
      }
      return updated;
    });
    setHasUnsavedChanges(true);
    showToast('Catálogo de cursos atualizado.', 'info');
  };

  // Restaura o catálogo oficial com os 101 cursos de sistema_fichas.db
  const handleResetOfficialCourses = () => {
    showConfirm({
      title: 'Restaurar Catálogo Oficial',
      message: 'Deseja restaurar as durações e catálogo oficial com todos os 101 cursos extraídos de sistema_fichas.db?',
      onConfirm: () => {
        const official = getDefaultCourseDurations();
        setCoursesConfig(official);
        if (typeof window !== 'undefined') {
          localStorage.setItem('microlins_forecast_courses', JSON.stringify(official));
        }
        setHasUnsavedChanges(true);
        showToast('Catálogo oficial restaurado com 101 cursos de sistema_fichas.db!', 'success');
      },
    });
  };

  // Adiciona novo curso customizado
  const handleAddNewCourse = () => {
    if (!newCourseName.trim()) {
      showAlert('Informe o nome do curso ou matéria.', 'warning');
      return;
    }
    const newCourse: CourseDurationConfig = {
      id: `course_custom_${Date.now()}`,
      name: newCourseName.trim(),
      totalLessons: Number(newCourseDuration) || 16,
      active: true,
      isCustom: true,
    };
    setCoursesConfig((prev) => {
      const updated = [newCourse, ...prev];
      if (typeof window !== 'undefined') {
        localStorage.setItem('microlins_forecast_courses', JSON.stringify(updated));
      }
      return updated;
    });
    setNewCourseName('');
    setNewCourseDuration(16);
    setIsAddCourseModalOpen(false);
    setHasUnsavedChanges(true);
    showToast(`Curso "${newCourse.name}" adicionado com sucesso!`, 'success');
  };

  // Salvar no Banco Supabase explicitamente
  const handleSaveConfigsToSupabase = async () => {
    try {
      setIsSavingConfig(true);
      const currentUnit = unitId || process.env.NEXT_PUBLIC_DEFAULT_UNIT_ID || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

      if (typeof window !== 'undefined') {
        localStorage.setItem('microlins_forecast_courses', JSON.stringify(coursesConfig));
        localStorage.setItem('microlins_forecast_frequencies', JSON.stringify(frequencyConfigs));
      }

      const payload = {
        forecast_courses: coursesConfig,
        forecast_frequencies: frequencyConfigs,
        forecast_trigger_lesson: triggerLesson,
        forecast_horizon_months: horizonMonths,
        saved_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('audit_logs').insert({
        unit_id: currentUnit,
        entity_type: 'forecast_settings',
        entity_id: currentUnit,
        action: 'UPDATE_FORECAST_CONFIG',
        metadata: payload as any,
      });

      if (error) {
        console.warn('Erro ao sincronizar com audit_logs no Supabase:', error.message);
      }

      setHasUnsavedChanges(false);
      showToast('Configurações salvas no Supabase com sucesso!', 'success');
    } catch (err: any) {
      showAlert(`Erro ao salvar no banco: ${err.message}`, 'error', 'Salvar Configurações');
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Exportar Excel
  const handleExportExcel = async () => {
    try {
      if (forecastResult.forecastItems.length === 0) {
        showAlert('Nenhum dado de aluno disponível para exportação.', 'warning');
        return;
      }
      await exportForecastToExcel(forecastResult.monthlySummaries, forecastResult.forecastItems);
      showToast('Planilha de Previsão gerada com sucesso!', 'success');
    } catch (err: any) {
      showAlert(`Erro ao gerar Excel: ${err.message}`, 'error');
    }
  };

  // Pendências filtradas
  const filteredIssues = useMemo(() => {
    return forecastResult.issues.filter((issue) => {
      if (issueFilterStudent && !issue.studentName.toLowerCase().includes(issueFilterStudent.toLowerCase())) {
        return false;
      }
      if (issueFilterSubject && !issue.subjectName.toLowerCase().includes(issueFilterSubject.toLowerCase())) {
        return false;
      }
      if (issueFilterType !== 'all' && issue.issueType !== issueFilterType) {
        return false;
      }
      return true;
    });
  }, [forecastResult.issues, issueFilterStudent, issueFilterSubject, issueFilterType]);

  // Cursos filtrados na sub-aba de Cursos
  const filteredCourses = useMemo(() => {
    if (!courseSearch) return coursesConfig;
    const q = courseSearch.toLowerCase();
    return coursesConfig.filter((c) => c.name.toLowerCase().includes(q));
  }, [coursesConfig, courseSearch]);

  // Resumos para os cards executivos
  const month1Summary = forecastResult.monthlySummaries.find((m) => m.monthIndex === 1);
  const month2Summary = forecastResult.monthlySummaries.find((m) => m.monthIndex === 2);
  const month3Summary = forecastResult.monthlySummaries.find((m) => m.monthIndex === 3); // Daqui a 2 meses
  const month4Summary = forecastResult.monthlySummaries.find((m) => m.monthIndex === 4);

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-[#0f3b7d] to-slate-900 p-5 rounded-2xl text-white shadow-md border border-slate-700/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center border border-white/20 backdrop-blur-xs shadow-inner shrink-0">
            <CalendarClock className="w-6 h-6 text-amber-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold tracking-tight">Previsão de Apostilas & Cronograma de Compras</h2>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-300/30">
                Até 4 Meses
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Planejamento cronológico de compras para toda a escola, baseado na duração oficial dos cursos e no ritmo dos alunos.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Input oculto para Upload Avulso */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleDirectFileUpload}
            accept=".xls,.xlsx"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/15 transition-all shadow-xs"
            title="Importar outra planilha avulsa (.xls / .xlsx - Controle Pedagógico ou Entrega de Apostila) para simular previsão"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-300" />
            <span>{customUploadedFileName ? 'Trocar Planilha Avulsa' : 'Upload Planilha Avulsa'}</span>
          </button>

          {/* Salvar Configurações no Banco */}
          <button
            type="button"
            onClick={handleSaveConfigsToSupabase}
            disabled={isSavingConfig}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs shadow-md transition-all ${
              hasUnsavedChanges
                ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 animate-pulse'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
            title="Gravar durações de cursos e frequências no banco Supabase"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSavingConfig ? 'Gravando...' : hasUnsavedChanges ? 'Salvar Configurações *' : 'Configurações Salvas'}</span>
          </button>
        </div>
      </div>

      {/* SELETOR DE FONTE DE DADOS DOS ALUNOS */}
      <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#0f3b7d]" />
            <span className="font-bold text-slate-700">Fonte dos Alunos para a Previsão:</span>
          </div>
          <div className="text-[11px] text-slate-500 flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-[#0f3b7d] shrink-0" />
            <span>Utiliza a planilha completa do Passo 1. O botão &quot;Upload Planilha Avulsa&quot; serve para testar outras planilhas sem alterar o pedido.</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Botão: Toda a Escola (Planilha Completa) */}
          {rawRows && rawRows.length > 0 && (
            <button
              type="button"
              onClick={() => handleSelectSource('full_sheet')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                sourceMode === 'full_sheet'
                  ? 'bg-[#0f3b7d] text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span>Toda a Escola ({rawRows.length} registros brutos)</span>
              {sourceMode === 'full_sheet' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>}
            </button>
          )}

          {/* Botão: Apenas Pedido Físico Atual */}
          {currentOrderItems && currentOrderItems.length > 0 && (
            <button
              type="button"
              onClick={() => handleSelectSource('current_order')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                sourceMode === 'current_order'
                  ? 'bg-[#0f3b7d] text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span>Apenas Pedido Físico ({currentOrderItems.length} alunos aula {triggerLesson} a 6)</span>
              {sourceMode === 'current_order' && <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>}
            </button>
          )}

          {/* Badge se tiver arquivo avulso */}
          {customUploadedFileName && (
            <span className="px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Arquivo Avulso: {customUploadedFileName} ({sourceItems.length} registros)
            </span>
          )}
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveSubTab('cronograma')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'cronograma'
                ? 'bg-[#0f3b7d] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>1. Cronograma & Previsão</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold ${
                activeSubTab === 'cronograma' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {forecastResult.totalWorkbooksCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('frequencia')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'frequencia'
                ? 'bg-[#0f3b7d] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>2. Alunos & Frequência</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('cursos')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'cursos'
                ? 'bg-[#0f3b7d] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>3. Cadastro de Cursos</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold ${
                activeSubTab === 'cursos' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {coursesConfig.filter((c) => c.active).length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('pendencias')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'pendencias'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-amber-800 hover:text-amber-950 hover:bg-amber-100/60'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>4. Pendências de Dados</span>
            {forecastResult.issues.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-extrabold bg-red-500 text-white">
                {forecastResult.issues.length}
              </span>
            )}
          </button>
        </div>

        {/* Global Controls: Trigger & Months */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-slate-500 font-medium">Gatilho de Pedido:</span>
            <span className="font-bold text-[#0f3b7d]">Aula {triggerLesson}</span>
            <input
              type="range"
              min="2"
              max="8"
              value={triggerLesson}
              onChange={(e) => setTriggerLesson(Number(e.target.value))}
              className="w-16 accent-[#0f3b7d] cursor-pointer"
              title={`Pedir material a partir da aula ${triggerLesson}`}
            />
          </div>

          <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-slate-500 font-medium">Horizonte:</span>
            <select
              value={horizonMonths}
              onChange={(e) => setHorizonMonths(Number(e.target.value) as any)}
              className="font-bold text-[#0f3b7d] bg-transparent outline-none cursor-pointer"
            >
              <option value={1}>1 Mês</option>
              <option value={2}>2 Meses</option>
              <option value={3}>3 Meses</option>
              <option value={4}>4 Meses</option>
            </select>
          </div>

          {/* Deduplicação com Histórico de Pedidos */}
          <button
            type="button"
            onClick={() => setExcludeHistorical((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
              excludeHistorical
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-2xs hover:bg-emerald-100'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
            title="Quando ativado, desconsidera da previsão alunos e matérias que já foram pedidos em remessas anteriores gravadas no sistema"
          >
            <ShieldCheck className={`w-3.5 h-3.5 ${excludeHistorical ? 'text-emerald-600' : 'text-slate-400'}`} />
            <span>Eliminar Histórico</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                excludeHistorical ? 'bg-emerald-200 text-emerald-900' : 'bg-slate-200 text-slate-600'
              }`}
            >
              {excludeHistorical ? 'Ativo' : 'Inativo'}
            </span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-ABA 1: CRONOGRAMA & PREVISÃO MENSAL */}
      {/* ========================================================================= */}
      {activeSubTab === 'cronograma' && (
        <div className="space-y-6">
          {/* BANNER DE PROTEÇÃO CONTRA DUPLICIDADES DO HISTÓRICO */}
          {forecastResult.historicalExcludedCount > 0 && excludeHistorical && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-gradient-to-r from-emerald-50 via-teal-50/50 to-white border border-emerald-200 rounded-2xl shadow-xs text-xs">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl shrink-0 shadow-2xs">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-emerald-950 text-sm">
                      {forecastResult.historicalExcludedCount}{' '}
                      {forecastResult.historicalExcludedCount === 1 ? 'apostila suprimida' : 'apostilas suprimidas'} da previsão
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Já Pedidas no Histórico
                    </span>
                  </div>
                  <p className="text-slate-600 text-[11px] mt-0.5">
                    Estas apostilas já foram registradas em pedidos anteriores no sistema e foram desconsideradas para evitar compras duplicadas.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowExcludedModal(true)}
                  className="px-3 py-1.5 bg-white hover:bg-emerald-100/50 text-emerald-800 border border-emerald-300 font-semibold rounded-xl text-xs shadow-2xs transition-colors cursor-pointer"
                >
                  Ver Lista ({forecastResult.historicalExcludedCount})
                </button>
              </div>
            </div>
          )}

          {!excludeHistorical && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Aviso de Histórico Inativo:</strong> A eliminação de apostilas já pedidas está <strong>desativada</strong>. Itens já pedidos anteriormente estão sendo incluídos na previsão com o selo <span className="px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 font-bold text-[10px]">Histórico</span>.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setExcludeHistorical(true)}
                className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs shrink-0 cursor-pointer transition-colors"
              >
                Reativar Eliminação
              </button>
            </div>
          )}
          {/* RESUMO EXECUTIVO CONSOLIDADO (2 CARDS ESTRATÉGICOS) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Resumo 1: Demanda Total Acumulada no Horizonte */}
            <div className="bg-white p-5 rounded-2xl border border-blue-200/80 shadow-xs flex flex-col justify-between relative overflow-hidden bg-gradient-to-br from-white via-blue-50/20 to-blue-50/50">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                <span className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                  <div className="p-1.5 rounded-lg bg-blue-100 text-[#0f3b7d]">
                    <Users className="w-4 h-4" />
                  </div>
                  Demanda Total Consolidada ({horizonMonths} Meses)
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                  Total Único
                </span>
              </div>
              <div className="flex items-baseline gap-3 my-2">
                <span className="text-3xl font-black text-[#0f3b7d] tracking-tight">{forecastResult.uniqueStudentsCount}</span>
                <span className="text-sm text-slate-600 font-semibold">alunos únicos com demanda</span>
              </div>
              <div className="text-xs text-slate-600 border-t border-blue-100/80 pt-2.5 flex items-center justify-between">
                <span>Total de apostilas projetadas no período:</span>
                <strong className="text-[#0f3b7d] font-bold text-sm">{forecastResult.totalWorkbooksCount} apostilas</strong>
              </div>
            </div>

            {/* Resumo 2: Recomendação Estratégica - Pedido Alvo (Mês 3 / Daqui a 2 Meses) */}
            <div className="bg-white p-5 rounded-2xl border-2 border-amber-400 shadow-xs flex flex-col justify-between relative overflow-hidden bg-gradient-to-br from-amber-50/80 via-white to-amber-50/30">
              <div className="flex items-center justify-between text-xs text-amber-900 mb-2">
                <span className="font-bold flex items-center gap-2 text-sm text-amber-950">
                  <div className="p-1.5 rounded-lg bg-amber-200 text-amber-900">
                    <Target className="w-4 h-4 text-amber-700" />
                  </div>
                  Pedido Alvo Recomendado (Daqui a 2 Meses)
                </span>
                <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-300 text-amber-950 shadow-2xs border border-amber-400">
                  Mês 3 • Alvo 🎯
                </span>
              </div>
              <div className="flex items-baseline gap-3 my-2">
                <span className="text-3xl font-black text-amber-800 tracking-tight">{month3Summary?.totalWorkbooks || 0}</span>
                <span className="text-sm text-amber-900 font-semibold">apostilas a pedir</span>
              </div>
              <div className="text-xs text-amber-900 border-t border-amber-200/80 pt-2.5 flex items-center justify-between">
                <span className="font-medium">
                  Competência: <strong>{month3Summary ? month3Summary.monthLabel.split('(')[0].trim() : 'Dezembro / 2026'}</strong>
                </span>
                <strong className="text-amber-950 font-bold shrink-0">{month3Summary?.uniqueStudentsCount || 0} alunos</strong>
              </div>
            </div>
          </div>

          {/* CRONOGRAMA MENSAL DE DEMANDA (LINHA DO TEMPO) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {forecastResult.monthlySummaries.map((summary) => {
              const isTargetMonth = summary.monthIndex === 3;
              const cleanMonth = summary.monthLabel.includes('(')
                ? summary.monthLabel.split('(')[0].trim()
                : summary.monthLabel;

              const relativeBadge =
                summary.monthIndex === 1
                  ? 'Imediato'
                  : summary.monthIndex === 2
                  ? '+4 sem'
                  : summary.monthIndex === 3
                  ? 'Alvo Recomendado'
                  : '+12 sem';

              return (
                <div
                  key={summary.monthIndex}
                  className={`p-4 rounded-2xl border flex flex-col justify-between transition-all ${
                    isTargetMonth
                      ? 'bg-gradient-to-b from-amber-50/70 to-white border-2 border-amber-400 shadow-xs ring-2 ring-amber-300/30'
                      : 'bg-white border-slate-200 hover:border-[#0f3b7d]/50 shadow-2xs'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-2 gap-2">
                    <span className="font-bold text-slate-800 text-xs tracking-tight shrink-0" title={cleanMonth}>
                      {cleanMonth}
                    </span>
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full shrink-0 ${
                        isTargetMonth
                          ? 'bg-amber-300 text-amber-950 border border-amber-400'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      Mês {summary.monthIndex} • {relativeBadge}
                    </span>
                  </div>

                  <div className="my-2">
                    <div className="flex items-baseline gap-1.5">
                      <span className={`text-2xl font-black ${isTargetMonth ? 'text-amber-900' : 'text-[#0f3b7d]'}`}>
                        {summary.totalWorkbooks}
                      </span>
                      <span className="text-xs text-slate-500 font-semibold">apostilas</span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                      {summary.uniqueStudentsCount || 0} alunos com demanda
                    </p>
                  </div>

                  <div
                    className="text-[11px] text-slate-500 border-t border-slate-100 pt-2.5 truncate"
                    title={
                      summary.subjectsBreakdown.length > 0
                        ? `${summary.subjectsBreakdown[0].subject} (${summary.subjectsBreakdown[0].count} apostilas)`
                        : 'Sem demandas'
                    }
                  >
                    {summary.subjectsBreakdown.length > 0 ? (
                      <span>
                        Maior volume:{' '}
                        <strong className="text-slate-700">
                          {summary.subjectsBreakdown[0].subject} ({summary.subjectsBreakdown[0].count})
                        </strong>
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">Sem demandas</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* PAINEL SEMANAL DE CURTO PRAZO (DENTRO DO MÊS ATUAL) */}
          <div className="bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-white p-4 rounded-2xl border border-blue-200 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#0f3b7d] text-white rounded-xl shadow-2xs shrink-0">
                  <CalendarClock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-[#0f3b7d] text-xs sm:text-sm">
                    Previsão Semanal de Curto Prazo (Dentro do Mês Atual)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Clique em um prazo abaixo para filtrar instantaneamente quem precisa de material nesta semana ou quinzena.
                  </p>
                </div>
              </div>
              {filterWeek !== 'all' && (
                <button
                  type="button"
                  onClick={() => setFilterWeek('all')}
                  className="px-2.5 py-1 text-[11px] font-bold text-[#0f3b7d] bg-white border border-blue-200 hover:bg-blue-50 rounded-lg shadow-2xs self-start sm:self-auto cursor-pointer transition-colors"
                >
                  ✕ Ver Todas as Semanas
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* Card 0: Imediato */}
              {(() => {
                const w0 = forecastResult.weeklyBreakdownMonth1?.[0];
                const isSelected = filterWeek === '0';
                return (
                  <button
                    type="button"
                    onClick={() => setFilterWeek(isSelected ? 'all' : '0')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-rose-50 border-rose-400 ring-2 ring-rose-300 shadow-xs'
                        : 'bg-white border-rose-200/80 hover:border-rose-300 hover:bg-rose-50/40 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-rose-900 flex items-center gap-1">
                        <span>🚨</span> Imediato (Hoje)
                      </span>
                      <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-rose-100 text-rose-800">
                        Aula ≥ {triggerLesson}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1 my-1">
                      <span className="text-xl font-black text-rose-800 tracking-tight">
                        {w0?.totalWorkbooks || 0}
                      </span>
                      <span className="text-[11px] text-slate-500 font-semibold">apostilas</span>
                    </div>
                    <p className="text-[10px] text-slate-500 truncate">
                      {w0?.uniqueStudentsCount || 0} alunos já no gatilho
                    </p>
                  </button>
                );
              })()}

              {/* Card 1: Em 1 semana */}
              {(() => {
                const w1 = forecastResult.weeklyBreakdownMonth1?.[1];
                const isSelected = filterWeek === '1';
                return (
                  <button
                    type="button"
                    onClick={() => setFilterWeek(isSelected ? 'all' : '1')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-300 shadow-xs'
                        : 'bg-white border-blue-200/80 hover:border-blue-300 hover:bg-blue-50/40 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-blue-900 flex items-center gap-1">
                        <span>⚡</span> Em 1 Semana
                      </span>
                      <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800">
                        ~7 dias
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1 my-1">
                      <span className="text-xl font-black text-[#0f3b7d] tracking-tight">
                        {w1?.totalWorkbooks || 0}
                      </span>
                      <span className="text-[11px] text-slate-500 font-semibold">apostilas</span>
                    </div>
                    <p className="text-[10px] text-slate-500 truncate">
                      {w1?.uniqueStudentsCount || 0} alunos • Acumulado: {w1?.cumulativeWorkbooks || 0}
                    </p>
                  </button>
                );
              })()}

              {/* Card 2: Em 2 semanas (Quinzena) */}
              {(() => {
                const w2 = forecastResult.weeklyBreakdownMonth1?.[2];
                const isSelected = filterWeek === '2';
                return (
                  <button
                    type="button"
                    onClick={() => setFilterWeek(isSelected ? 'all' : '2')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50 border-indigo-400 ring-2 ring-indigo-300 shadow-xs'
                        : 'bg-white border-indigo-200/80 hover:border-indigo-300 hover:bg-indigo-50/40 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-indigo-900 flex items-center gap-1">
                        <span>📅</span> Em 2 Semanas
                      </span>
                      <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800">
                        Quinzena
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1 my-1">
                      <span className="text-xl font-black text-indigo-800 tracking-tight">
                        {w2?.totalWorkbooks || 0}
                      </span>
                      <span className="text-[11px] text-slate-500 font-semibold">apostilas</span>
                    </div>
                    <p className="text-[10px] text-slate-500 truncate">
                      {w2?.uniqueStudentsCount || 0} alunos • Acumulado: {w2?.cumulativeWorkbooks || 0}
                    </p>
                  </button>
                );
              })()}

              {/* Card 3: Em 3 semanas */}
              {(() => {
                const w3 = forecastResult.weeklyBreakdownMonth1?.[3];
                const isSelected = filterWeek === '3';
                return (
                  <button
                    type="button"
                    onClick={() => setFilterWeek(isSelected ? 'all' : '3')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-300 shadow-xs'
                        : 'bg-white border-amber-200/80 hover:border-amber-300 hover:bg-amber-50/40 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-amber-950 flex items-center gap-1">
                        <span>📆</span> Em 3 Semanas
                      </span>
                      <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">
                        ~21 dias
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1 my-1">
                      <span className="text-xl font-black text-amber-900 tracking-tight">
                        {w3?.totalWorkbooks || 0}
                      </span>
                      <span className="text-[11px] text-slate-500 font-semibold">apostilas</span>
                    </div>
                    <p className="text-[10px] text-slate-500 truncate">
                      {w3?.uniqueStudentsCount || 0} alunos • Acumulado: {w3?.cumulativeWorkbooks || 0}
                    </p>
                  </button>
                );
              })()}
            </div>
          </div>

          {/* BARRA DE CONTROLE: ALTERNAR ENTRE VISÃO POR MATÉRIA E VISÃO POR ALUNO */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-col xl:flex-row xl:items-center justify-between gap-3 bg-slate-50/60">
              {/* Seletor do Modo de Visualização */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center bg-slate-200/80 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setScheduleViewMode('subjects')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      scheduleViewMode === 'subjects'
                        ? 'bg-[#0f3b7d] text-white shadow-xs'
                        : 'text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Visão por Matéria (Apostilas & Alunos)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduleViewMode('students')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      scheduleViewMode === 'students'
                        ? 'bg-[#0f3b7d] text-white shadow-xs'
                        : 'text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Visão por Aluno (Lista Cronológica)</span>
                  </button>
                </div>
              </div>

              {/* Barra de Filtros Completa & Dinâmica */}
              <div className="flex flex-wrap items-center gap-2">
                {/* 1. Busca por Aluno / Matéria */}
                <div className="relative w-full sm:w-48">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Filtrar aluno ou matéria..."
                    value={searchStudent}
                    onChange={(e) => setSearchStudent(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-white text-xs border border-slate-200 rounded-xl outline-none focus:border-[#0f3b7d]"
                  />
                </div>

                {/* 2. Filtro de Mês */}
                <select
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="px-2.5 py-1.5 bg-white text-xs border border-slate-200 rounded-xl outline-none text-slate-700 font-semibold cursor-pointer"
                  title="Filtrar por Mês"
                >
                  <option value="all">Todos os Meses</option>
                  {monthLabels.map((m) => (
                    <option key={m.index} value={m.index}>
                      {m.label} ({m.relativeLabel})
                    </option>
                  ))}
                </select>

                {/* 3. Filtro de Prazo Semanal */}
                <select
                  value={filterWeek}
                  onChange={(e) => setFilterWeek(e.target.value)}
                  className={`px-2.5 py-1.5 text-xs border rounded-xl outline-none font-semibold cursor-pointer ${
                    filterWeek !== 'all'
                      ? 'bg-blue-50 text-[#0f3b7d] border-blue-300'
                      : 'bg-white text-slate-700 border-slate-200'
                  }`}
                  title="Filtrar por Prazo Semanal"
                >
                  <option value="all">Semanas: Todas</option>
                  <option value="0">🚨 Imediato (Hoje)</option>
                  <option value="1">⚡ Em 1 Semana (~7 dias)</option>
                  <option value="2">📅 Em 2 Semanas (~14 dias)</option>
                  <option value="3">📆 Em 3 Semanas (~21 dias)</option>
                  <option value="4">🗓️ Em 4 Semanas (~28 dias)</option>
                  <option value="until_1">📈 Até 1 Semana (Imediato + Sem 1)</option>
                  <option value="until_2">📈 Até 2 Semanas (Quinzena Completa)</option>
                  <option value="until_3">📈 Até 3 Semanas (3 Semanas Acumuladas)</option>
                </select>

                {/* 4. Filtro de Etapa / Ciclo */}
                <select
                  value={filterStage}
                  onChange={(e) => setFilterStage(e.target.value as any)}
                  className={`px-2.5 py-1.5 text-xs border rounded-xl outline-none font-semibold cursor-pointer ${
                    filterStage !== 'all'
                      ? 'bg-blue-50 text-[#0f3b7d] border-blue-300'
                      : 'bg-white text-slate-700 border-slate-200'
                  }`}
                  title="Filtrar por Etapa"
                >
                  <option value="all">Etapa: Todas</option>
                  <option value="atual">Matéria Atual</option>
                  <option value="proxima">Próxima Matéria</option>
                </select>

                {/* 5. Filtro de Ritmo Semanal */}
                <select
                  value={filterPace}
                  onChange={(e) => setFilterPace(e.target.value as any)}
                  className={`px-2.5 py-1.5 text-xs border rounded-xl outline-none font-semibold cursor-pointer ${
                    filterPace !== 'all'
                      ? 'bg-blue-50 text-[#0f3b7d] border-blue-300'
                      : 'bg-white text-slate-700 border-slate-200'
                  }`}
                  title="Filtrar por Ritmo Semanal"
                >
                  <option value="all">Ritmo: Todos</option>
                  <option value="1x">1x por semana</option>
                  <option value="2x">2x por semana (Padrão)</option>
                  <option value="4x">4x por semana (Rápido)</option>
                  <option value="special">Especiais (&gt;2x)</option>
                </select>

                {/* 6. Filtro de Status */}
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className={`px-2.5 py-1.5 text-xs border rounded-xl outline-none font-semibold cursor-pointer ${
                    filterStatus !== 'all'
                      ? 'bg-blue-50 text-[#0f3b7d] border-blue-300'
                      : 'bg-white text-slate-700 border-slate-200'
                  }`}
                  title="Filtrar por Status"
                >
                  <option value="all">Status: Todos</option>
                  <option value="imediato">Imediato</option>
                  <option value="projetado">Projetado</option>
                </select>

                {/* Botão Limpar Filtros */}
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                    title="Limpar todos os filtros ativos"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Limpar</span>
                  </button>
                )}

                {/* Exportar Excel */}
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
                  title="Exportar planilha Excel com Resumo Mensal por Matéria e Cronograma por Aluno"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Excel (.xlsx)</span>
                </button>
              </div>
            </div>

            {/* MODO 1: VISÃO AGRUPADA POR MATÉRIA (Quais apostilas, quantas em cada mês, quais alunos) */}
            {scheduleViewMode === 'subjects' && (
              <div className="p-4 space-y-6">
                {monthlySubjectsGrouped.length === 0 || monthlySubjectsGrouped.every((m) => m.subjects.length === 0) ? (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    Nenhuma demanda encontrada para os filtros selecionados.
                  </div>
                ) : (
                  monthlySubjectsGrouped.map((mGroup) => (
                    <div
                      key={mGroup.monthIndex}
                      className={`border rounded-2xl overflow-hidden ${
                        mGroup.monthIndex === 3 ? 'border-amber-300 bg-amber-50/20' : 'border-slate-200 bg-white'
                      }`}
                    >
                      {/* Cabeçalho do Mês */}
                      <div className="p-3.5 bg-slate-100/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-[#0f3b7d] text-sm">
                            {mGroup.monthLabel}
                          </span>
                          <span
                            className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                              mGroup.monthIndex === 3
                                ? 'bg-amber-300 text-amber-950 font-black'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {mGroup.relativeLabel}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-slate-600">
                            Total de Apostilas: <strong className="text-[#0f3b7d] font-black">{mGroup.totalWorkbooks}</strong>
                          </span>
                          <span className="text-slate-300">|</span>
                          <span className="text-slate-600">
                            Alunos: <strong className="text-slate-800 font-bold">{mGroup.uniqueStudentsCount}</strong>
                          </span>
                        </div>
                      </div>

                      {/* Lista de Matérias deste Mês */}
                      {mGroup.subjects.length === 0 ? (
                        <div className="p-4 text-center text-slate-400 text-xs italic">
                          Nenhuma apostila prevista para este mês.
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-100">
                          {mGroup.subjects.map((subj) => {
                            const expandKey = `m${mGroup.monthIndex}_${subj.subjectName}`;
                            const isExpanded = !!expandedSubjects[expandKey];

                            return (
                              <div key={subj.subjectName} className="transition-colors hover:bg-slate-50/60">
                                {/* Linha da Matéria */}
                                <div
                                  onClick={() => toggleSubjectExpanded(expandKey)}
                                  className="p-3.5 flex items-center justify-between cursor-pointer select-none"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-[#0f3b7d]">
                                      {isExpanded ? (
                                        <ChevronDown className="w-4 h-4" />
                                      ) : (
                                        <ChevronRight className="w-4 h-4" />
                                      )}
                                    </div>
                                    <div>
                                      <h4 className="font-bold text-slate-800 text-xs flex items-center gap-2">
                                        <span>{subj.subjectName}</span>
                                      </h4>
                                      <span className="text-[11px] text-slate-500">
                                        Clique para {isExpanded ? 'ocultar' : 'ver'} os {subj.count} alunos que receberão este material
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <span className="px-3 py-1 rounded-xl bg-[#0f3b7d] text-white font-extrabold text-xs shadow-2xs">
                                      {subj.count} {subj.count === 1 ? 'apostila' : 'apostilas'}
                                    </span>
                                  </div>
                                </div>

                                {/* Lista de Alunos Expandida para esta Matéria */}
                                {isExpanded && (
                                  <div className="px-4 pb-4 pt-1 bg-slate-50/70">
                                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                                      <table className="w-full text-left text-xs">
                                        <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 text-[11px]">
                                          <tr>
                                            <th
                                              onClick={() => handleSort('student')}
                                              className="py-2 px-3 cursor-pointer hover:bg-slate-200/70 select-none transition-colors"
                                            >
                                              <div className="flex items-center gap-1">
                                                <span>Aluno</span>
                                                {sortColumn === 'student' ? (
                                                  sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-[#0f3b7d]" /> : <ArrowDown className="w-3 h-3 text-[#0f3b7d]" />
                                                ) : (
                                                  <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                                                )}
                                              </div>
                                            </th>
                                            <th
                                              onClick={() => handleSort('lesson')}
                                              className="py-2 px-3 text-center w-28 cursor-pointer hover:bg-slate-200/70 select-none transition-colors"
                                            >
                                              <div className="flex items-center justify-center gap-1">
                                                <span>Aula / Total</span>
                                                {sortColumn === 'lesson' ? (
                                                  sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-[#0f3b7d]" /> : <ArrowDown className="w-3 h-3 text-[#0f3b7d]" />
                                                ) : (
                                                  <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                                                )}
                                              </div>
                                            </th>
                                            <th
                                              onClick={() => handleSort('pace')}
                                              className="py-2 px-3 text-center w-28 cursor-pointer hover:bg-slate-200/70 select-none transition-colors"
                                            >
                                              <div className="flex items-center justify-center gap-1">
                                                <span>Ritmo Semanal</span>
                                                {sortColumn === 'pace' ? (
                                                  sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-[#0f3b7d]" /> : <ArrowDown className="w-3 h-3 text-[#0f3b7d]" />
                                                ) : (
                                                  <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                                                )}
                                              </div>
                                            </th>
                                            <th
                                              onClick={() => handleSort('stage')}
                                              className="py-2 px-3 text-center w-36 cursor-pointer hover:bg-slate-200/70 select-none transition-colors"
                                            >
                                              <div className="flex items-center justify-center gap-1">
                                                <span>Etapa</span>
                                                {sortColumn === 'stage' ? (
                                                  sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-[#0f3b7d]" /> : <ArrowDown className="w-3 h-3 text-[#0f3b7d]" />
                                                ) : (
                                                  <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                                                )}
                                              </div>
                                            </th>
                                            <th
                                              onClick={() => handleSort('week')}
                                              className="py-2 px-3 text-center w-36 cursor-pointer hover:bg-slate-200/70 select-none transition-colors"
                                            >
                                              <div className="flex items-center justify-center gap-1">
                                                <span>Semana Est.</span>
                                                {sortColumn === 'week' ? (
                                                  sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-[#0f3b7d]" /> : <ArrowDown className="w-3 h-3 text-[#0f3b7d]" />
                                                ) : (
                                                  <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                                                )}
                                              </div>
                                            </th>
                                            <th
                                              onClick={() => handleSort('status')}
                                              className="py-2 px-3 text-center w-28 cursor-pointer hover:bg-slate-200/70 select-none transition-colors"
                                            >
                                              <div className="flex items-center justify-center gap-1">
                                                <span>Status</span>
                                                {sortColumn === 'status' ? (
                                                  sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-[#0f3b7d]" /> : <ArrowDown className="w-3 h-3 text-[#0f3b7d]" />
                                                ) : (
                                                  <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                                                )}
                                              </div>
                                            </th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                          {subj.students.map((student) => (
                                            <tr key={student.id} className="hover:bg-slate-50">
                                              <td className="py-2 px-3">
                                                <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                                                  <span>{student.studentName}</span>
                                                  {student.isHistoricalDuplicate && (
                                                    <span
                                                      className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-100 text-rose-800 border border-rose-200"
                                                      title={student.historicalMatchOrderTitle || 'Pedido Anterior Cadastrado'}
                                                    >
                                                      Histórico
                                                    </span>
                                                  )}
                                                </div>
                                                {student.courseName && (
                                                  <div className="text-[10px] text-slate-500 font-medium">
                                                    Formação: {student.courseName}
                                                  </div>
                                                )}
                                              </td>
                                              <td className="py-2 px-3 text-center font-mono">
                                                <span className="font-bold text-[#0f3b7d]">{student.currentLesson}</span>
                                                <span className="text-slate-400"> / {student.totalLessons}</span>
                                              </td>
                                              <td className="py-2 px-3 text-center">
                                                <span
                                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                    student.isSpecial
                                                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                                      : 'bg-slate-100 text-slate-700'
                                                  }`}
                                                >
                                                  {student.lessonsPerWeek}x/sem
                                                </span>
                                              </td>
                                              <td className="py-2 px-3 text-center">
                                                {student.stage === 'atual' ? (
                                                  <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 font-bold text-[10px]">
                                                    Matéria Atual
                                                  </span>
                                                ) : (
                                                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-bold text-[10px]">
                                                    Próxima Matéria
                                                  </span>
                                                )}
                                              </td>
                                              <td className="py-2 px-3 text-center">
                                                {student.weeksUntilNextOrder === 0 ? (
                                                  <span className="px-2 py-0.5 rounded font-extrabold text-[10px] bg-rose-100 text-rose-800 border border-rose-200 inline-flex items-center gap-1">
                                                    🚨 Imediato
                                                  </span>
                                                ) : student.weeksUntilNextOrder === 1 ? (
                                                  <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-blue-100 text-blue-800 border border-blue-200 inline-flex items-center gap-1">
                                                    ⚡ 1 semana
                                                  </span>
                                                ) : student.weeksUntilNextOrder === 2 ? (
                                                  <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-indigo-100 text-indigo-800 border border-indigo-200 inline-flex items-center gap-1">
                                                    📅 2 semanas
                                                  </span>
                                                ) : student.weeksUntilNextOrder === 3 ? (
                                                  <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-amber-100 text-amber-900 border border-amber-200 inline-flex items-center gap-1">
                                                    📆 3 semanas
                                                  </span>
                                                ) : (
                                                  <span className="px-2 py-0.5 rounded font-medium text-[10px] bg-slate-100 text-slate-700">
                                                    ~{student.weeksUntilNextOrder} sem
                                                  </span>
                                                )}
                                              </td>
                                              <td className="py-2 px-3 text-center">
                                                {student.status === 'imediato' ? (
                                                  <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 font-black text-[10px] uppercase">
                                                    Imediato
                                                  </span>
                                                ) : (
                                                  <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold text-[10px] uppercase">
                                                    Projetado
                                                  </span>
                                                )}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* MODO 2: VISÃO POR ALUNO (Tabela Clássica Completa) */}
            {scheduleViewMode === 'students' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/80 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">#</th>
                      <th
                        onClick={() => handleSort('student')}
                        className="py-2.5 px-3 min-w-[180px] cursor-pointer hover:bg-slate-200/70 select-none transition-colors"
                      >
                        <div className="flex items-center gap-1">
                          <span>Aluno</span>
                          {sortColumn === 'student' ? (
                            sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-[#0f3b7d]" /> : <ArrowDown className="w-3 h-3 text-[#0f3b7d]" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('subject')}
                        className="py-2.5 px-3 min-w-[180px] cursor-pointer hover:bg-slate-200/70 select-none transition-colors"
                      >
                        <div className="flex items-center gap-1">
                          <span>Matéria Solicitada</span>
                          {sortColumn === 'subject' ? (
                            sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-[#0f3b7d]" /> : <ArrowDown className="w-3 h-3 text-[#0f3b7d]" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('stage')}
                        className="py-2.5 px-3 text-center w-32 cursor-pointer hover:bg-slate-200/70 select-none transition-colors"
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span>Etapa</span>
                          {sortColumn === 'stage' ? (
                            sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-[#0f3b7d]" /> : <ArrowDown className="w-3 h-3 text-[#0f3b7d]" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('lesson')}
                        className="py-2.5 px-3 text-center w-28 cursor-pointer hover:bg-slate-200/70 select-none transition-colors"
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span>Aula / Total</span>
                          {sortColumn === 'lesson' ? (
                            sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-[#0f3b7d]" /> : <ArrowDown className="w-3 h-3 text-[#0f3b7d]" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('pace')}
                        className="py-2.5 px-3 text-center w-28 cursor-pointer hover:bg-slate-200/70 select-none transition-colors"
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span>Aulas / Sem.</span>
                          {sortColumn === 'pace' ? (
                            sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-[#0f3b7d]" /> : <ArrowDown className="w-3 h-3 text-[#0f3b7d]" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                          )}
                        </div>
                      </th>
                      <th className="py-2.5 px-3 text-center w-28">Matérias Rest.</th>
                      <th
                        onClick={() => handleSort('week')}
                        className="py-2.5 px-3 text-center w-36 cursor-pointer hover:bg-slate-200/70 select-none transition-colors"
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span>Semana Est. / Prazo</span>
                          {sortColumn === 'week' ? (
                            sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-[#0f3b7d]" /> : <ArrowDown className="w-3 h-3 text-[#0f3b7d]" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                          )}
                        </div>
                      </th>
                      <th className="py-2.5 px-3 min-w-[170px]">Mês Estimado</th>
                      <th
                        onClick={() => handleSort('status')}
                        className="py-2.5 px-3 text-center w-28 cursor-pointer hover:bg-slate-200/70 select-none transition-colors"
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span>Status</span>
                          {sortColumn === 'status' ? (
                            sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-[#0f3b7d]" /> : <ArrowDown className="w-3 h-3 text-[#0f3b7d]" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                          )}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredForecastItems.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-10 text-center text-slate-400">
                          Nenhum aluno encontrado para os filtros selecionados.
                        </td>
                      </tr>
                    ) : (
                      filteredForecastItems.map((item: ForecastStudentItem, idx: number) => (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">
                            {item.studentName}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                              <span>{item.subjectName}</span>
                              {item.isHistoricalDuplicate && (
                                <span
                                  className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-100 text-rose-800 border border-rose-200"
                                  title={item.historicalMatchOrderTitle || 'Pedido Anterior Cadastrado'}
                                >
                                  Histórico
                                </span>
                              )}
                            </div>
                            {item.courseName && (
                              <div className="text-[10px] text-slate-500 font-medium">
                                Formação: {item.courseName}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {item.stage === 'atual' ? (
                              <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 font-bold text-[10px]">
                                Matéria Atual
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-bold text-[10px]">
                                Próxima Matéria
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono">
                            <span className="font-bold text-[#0f3b7d]">{item.currentLesson}</span>
                            <span className="text-slate-400"> / {item.totalLessons}</span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                item.isSpecial
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {item.lessonsPerWeek}x/sem
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-semibold text-slate-700">
                            {item.remainingSubjectsCount}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {item.weeksUntilNextOrder === 0 ? (
                              <span className="px-2 py-0.5 rounded font-extrabold text-[10px] bg-rose-100 text-rose-800 border border-rose-200 inline-flex items-center gap-1">
                                🚨 Imediato
                              </span>
                            ) : item.weeksUntilNextOrder === 1 ? (
                              <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-blue-100 text-blue-800 border border-blue-200 inline-flex items-center gap-1">
                                ⚡ 1 semana
                              </span>
                            ) : item.weeksUntilNextOrder === 2 ? (
                              <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-indigo-100 text-indigo-800 border border-indigo-200 inline-flex items-center gap-1">
                                📅 2 semanas
                              </span>
                            ) : item.weeksUntilNextOrder === 3 ? (
                              <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-amber-100 text-amber-900 border border-amber-200 inline-flex items-center gap-1">
                                📆 3 semanas
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded font-medium text-[10px] bg-slate-100 text-slate-700">
                                ~{item.weeksUntilNextOrder} sem
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-semibold text-slate-800">{item.estimatedMonthLabel}</span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {item.status === 'imediato' ? (
                              <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 font-black text-[10px] uppercase">
                                Imediato
                              </span>
                            ) : item.status === 'projetado' ? (
                              <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold text-[10px] uppercase">
                                Projetado
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-500 font-medium text-[10px]">
                                Sem Demanda
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-ABA 2: ALUNOS & FREQUÊNCIA */}
      {/* ========================================================================= */}
      {activeSubTab === 'frequencia' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Frequência Semanal dos Alunos</h3>
              <p className="text-xs text-slate-500">
                Selecione ou digite a quantidade de aulas semanais de cada aluno. As alterações ficam salvas para futuras importações.
              </p>
            </div>
            <div className="w-full sm:w-64 relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar aluno..."
                value={searchStudent}
                onChange={(e) => setSearchStudent(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 text-xs border border-slate-200 rounded-xl outline-none"
              />
            </div>
          </div>

          {/* Abas de Filtragem de Frequência */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/80 pb-3">
            {[
              { id: 'all', label: 'Todos', count: frequencyCounts.all },
              { id: '1x', label: '1 aula na semana', count: frequencyCounts.count1x },
              { id: '2x', label: '2 aulas na semana', count: frequencyCounts.count2x },
              { id: '4x', label: '4 aulas na semana', count: frequencyCounts.count4x },
              { id: 'custom', label: 'Personalizado', count: frequencyCounts.countCustom },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFrequencyFilterTab(tab.id as any)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  frequencyFilterTab === tab.id
                    ? 'bg-[#0f3b7d] text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                    frequencyFilterTab === tab.id
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">Aluno</th>
                  <th className="py-2.5 px-3">Matéria Atual</th>
                  <th className="py-2.5 px-3 text-center">Aula Atual</th>
                  <th className="py-2.5 px-3 text-center min-w-[280px]">Aulas por Semana</th>
                  <th className="py-2.5 px-3 text-center">Classificação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredFrequencyStudents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      Nenhum aluno encontrado nesta aba de frequência.
                    </td>
                  </tr>
                ) : (
                  filteredFrequencyStudents.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2 px-3 font-semibold text-slate-800">{item.studentName}</td>
                      <td className="py-2 px-3">
                        <div className="font-semibold text-slate-800">{item.subjectName}</div>
                        {item.courseName && (
                          <div className="text-[10px] text-slate-500 font-medium">Formação: {item.courseName}</div>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center font-bold text-[#0f3b7d]">{item.currentLesson}</td>
                      <td className="py-2 px-3 text-center">
                        <div className="inline-flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
                          {[1, 2, 4].map((num) => (
                            <button
                              key={num}
                              type="button"
                              onClick={() => handleUpdateStudentFrequency(item.studentName, num, item.courseName)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                item.lessonsPerWeek === num
                                  ? num === 4
                                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                                    : 'bg-[#0f3b7d] text-white shadow-xs'
                                  : 'text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              {num}x
                            </button>
                          ))}
                          <div className="flex items-center gap-1 pl-1.5 border-l border-slate-300">
                            <input
                              type="number"
                              min="1"
                              max="20"
                              value={item.lessonsPerWeek}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                if (!isNaN(val) && val >= 1) {
                                  handleUpdateStudentFrequency(item.studentName, val, item.courseName);
                                }
                              }}
                              className="w-12 px-1.5 py-0.5 text-center text-xs font-bold bg-white border border-slate-300 rounded-md outline-none focus:border-[#0f3b7d]"
                              title="Digite qualquer quantidade de aulas por semana"
                            />
                            <span className="text-[10px] font-bold text-slate-500">aulas/sem</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-center">
                        {item.lessonsPerWeek === 2 ? (
                          <span className="text-slate-400 text-xs font-medium">Padrão (2x)</span>
                        ) : item.lessonsPerWeek === 1 ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
                            1 aula/semana
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                            Ritmo Especial ({item.lessonsPerWeek}x/sem)
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-ABA 3: CADASTRO DE CURSOS (101 CURSOS OFICIAIS DO SISTEMA_FICHAS.DB) */}
      {/* ========================================================================= */}
      {activeSubTab === 'cursos' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-800 text-sm">Catálogo Oficial de Cursos & Duração das Matérias</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                  {coursesConfig.length} Cursos do sistema_fichas.db
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Lista oficial extraída diretamente de <code>D:\Malone\CriaFichas\sistema_fichas.db</code>. O total de aulas pode ser ajustado diretamente na tabela.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Botão de Restaurar Cursos Oficiais */}
              <button
                type="button"
                onClick={handleResetOfficialCourses}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition-all shadow-2xs"
                title="Restaurar o catálogo oficial padrão dos 101 cursos de sistema_fichas.db"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>Restaurar Catálogo Oficial (101 Cursos)</span>
              </button>

              {/* Botão Adicionar Matéria Personalizada */}
              <button
                type="button"
                onClick={() => setIsAddCourseModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0f3b7d] text-white text-xs font-bold hover:bg-[#1e54a4] transition-all shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar Matéria</span>
              </button>
            </div>
          </div>

          {/* Barra de Busca de Cursos */}
          <div className="w-full max-w-sm relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar entre os 101 cursos..."
              value={courseSearch}
              onChange={(e) => setCourseSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 text-xs border border-slate-200 rounded-xl outline-none focus:border-[#0f3b7d]"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">Curso / Matéria Oficial</th>
                  <th className="py-2.5 px-3 text-center w-36">Total de Aulas</th>
                  <th className="py-2.5 px-3 text-center w-32">Status</th>
                  <th className="py-2.5 px-3 text-right w-24">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCourses.map((course) => (
                  <tr
                    key={course.id}
                    className={`transition-colors ${course.active ? 'hover:bg-slate-50' : 'bg-slate-50/50 opacity-60'}`}
                  >
                    <td className="py-2.5 px-3">
                      <span className={`font-semibold ${course.active ? 'text-slate-800' : 'text-slate-400 line-through'}`}>
                        {course.name}
                      </span>
                      {course.isCustom && (
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                          Personalizado
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <input
                        type="number"
                        min="1"
                        max="120"
                        value={course.totalLessons}
                        onChange={(e) => handleUpdateCourseDuration(course.id, parseInt(e.target.value, 10))}
                        disabled={!course.active}
                        className="w-20 text-center py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-[#0f3b7d] outline-none focus:border-[#0f3b7d] focus:ring-1 focus:ring-[#0f3b7d]"
                      />
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {course.active ? (
                        <span className="text-emerald-700 font-semibold text-xs">Ativo</span>
                      ) : (
                        <span className="text-slate-400 text-xs italic">Desativado</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleToggleCourseActive(course.id)}
                        className={`p-1.5 rounded-lg border transition-all ${
                          course.active
                            ? 'text-red-600 hover:bg-red-50 border-red-200'
                            : 'text-emerald-600 hover:bg-emerald-50 border-emerald-200'
                        }`}
                        title={course.active ? 'Desativar matéria (excluir do cálculo)' : 'Reativar matéria'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-ABA 4: PENDÊNCIAS DE DADOS */}
      {/* ========================================================================= */}
      {activeSubTab === 'pendencias' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-800 text-sm">Pendências & Divergências de Dados</h3>
            <p className="text-xs text-slate-500">
              Registros com dados incompletos ou inconsistências que podem distorcer o cálculo de previsão.
            </p>
          </div>

          {/* Filtros de Pendências */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
            <div>
              <label className="block text-slate-500 font-medium mb-1">Filtrar por Aluno</label>
              <input
                type="text"
                placeholder="Nome do aluno..."
                value={issueFilterStudent}
                onChange={(e) => setIssueFilterStudent(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-500 font-medium mb-1">Filtrar por Matéria</label>
              <input
                type="text"
                placeholder="Matéria..."
                value={issueFilterSubject}
                onChange={(e) => setIssueFilterSubject(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-500 font-medium mb-1">Tipo de Pendência</label>
              <select
                value={issueFilterType}
                onChange={(e) => setIssueFilterType(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg outline-none"
              >
                <option value="all">Todas as Pendências</option>
                <option value="missing_lesson">Aula Inconsistente</option>
                <option value="missing_subject">Matéria Inválida/Desconhecida</option>
                <option value="missing_duration">Sem Duração de Aulas</option>
                <option value="divergence">Divergência entre Relatórios</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">Aluno</th>
                  <th className="py-2.5 px-3">Matéria</th>
                  <th className="py-2.5 px-3">Descrição da Pendência</th>
                  <th className="py-2.5 px-3">Ação Recomendada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredIssues.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-emerald-600 font-medium">
                      Nenhuma pendência de dados encontrada! Todos os registros estão válidos.
                    </td>
                  </tr>
                ) : (
                  filteredIssues.map((issue) => (
                    <tr key={issue.id} className="hover:bg-amber-50/40 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-slate-800">{issue.studentName}</td>
                      <td className="py-2.5 px-3 text-slate-600">{issue.subjectName}</td>
                      <td className="py-2.5 px-3 text-red-600 font-medium">{issue.description}</td>
                      <td className="py-2.5 px-3 text-slate-500">{issue.solutionTip || 'Verificar cadastro'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Adicionar Curso */}
      {isAddCourseModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="font-bold text-slate-800 text-sm">Adicionar Novo Curso / Matéria</h4>
              <button
                type="button"
                onClick={() => setIsAddCourseModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Nome da Matéria:</label>
                <input
                  type="text"
                  placeholder="Ex: Illustrator 2024"
                  value={newCourseName}
                  onChange={(e) => setNewCourseName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-[#0f3b7d]"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Total de Aulas:</label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={newCourseDuration}
                  onChange={(e) => setNewCourseDuration(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-[#0f3b7d]"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsAddCourseModalOpen(false)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAddNewCourse}
                className="px-4 py-1.5 rounded-xl bg-[#0f3b7d] text-white font-bold text-xs hover:bg-[#1e54a4]"
              >
                Salvar Matéria
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: LISTA DE APOSTILAS SUPRIMIDAS DO HISTÓRICO */}
      {showExcludedModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full p-5 space-y-4 max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Apostilas Suprimidas da Previsão ({forecastResult.historicalExcludedCount})
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Itens identificados como já solicitados no histórico do sistema.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowExcludedModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 pr-1">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-bold sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">#</th>
                    <th className="py-2 px-3">Aluno</th>
                    <th className="py-2 px-3">Matéria Suprimida</th>
                    <th className="py-2 px-3 text-center">Etapa</th>
                    <th className="py-2 px-3">Pedido Anterior</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {forecastResult.historicalExcludedItems.map((it, idx) => (
                    <tr key={`${it.studentName}_${it.subjectName}_${idx}`} className="hover:bg-slate-50">
                      <td className="py-2 px-3 text-slate-400 font-mono text-[10px]">{idx + 1}</td>
                      <td className="py-2 px-3 font-semibold text-slate-800">
                        {it.studentName}
                        {it.courseName && (
                          <div className="text-[10px] text-slate-400 font-normal">
                            {it.courseName}
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-3 text-emerald-800 font-bold">
                        {it.subjectName}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                          {it.stage === 'atual' ? 'Matéria Atual' : 'Próxima'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-[11px] text-slate-500">
                        {it.orderTitle || 'Pedido Anterior no Sistema'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 shrink-0">
              <span className="text-[11px] text-slate-500">
                Total de {forecastResult.historicalExcludedCount} apostilas protegidas contra compra dupla.
              </span>
              <button
                type="button"
                onClick={() => setShowExcludedModal(false)}
                className="px-4 py-1.5 rounded-xl bg-[#0f3b7d] text-white font-bold text-xs hover:bg-[#1e54a4] transition-colors cursor-pointer"
              >
                Entendi e Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
