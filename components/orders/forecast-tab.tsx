'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
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
import { exportForecastToExcel } from '../../lib/export/excel-forecast-export';
import { useDialog } from '../ui/dialog';
import { supabase } from '../../lib/supabase/client';
import { parseSpreadsheetBuffer } from '../../lib/importers';

interface ForecastTabProps {
  currentOrderItems: ProcessedStudentItem[];
  rawRows?: Record<string, unknown>[];
  unitId?: string;
}

export function ForecastTab({ currentOrderItems, rawRows = [], unitId }: ForecastTabProps) {
  const { showAlert, showConfirm, showToast } = useDialog();

  // Sub-abas internas da Previsão
  const [activeSubTab, setActiveSubTab] = useState<'cronograma' | 'frequencia' | 'cursos' | 'pendencias'>('cronograma');

  // Modo de visualização do Cronograma: 'subjects' (Por Matéria / Apostila) ou 'students' (Por Aluno)
  const [scheduleViewMode, setScheduleViewMode] = useState<'subjects' | 'students'>('subjects');

  // Controle de accordion de matérias expandidas na visão por matéria
  const [expandedSubjects, setExpandedSubjects] = useState<Record<string, boolean>>({});

  // Parâmetros de projeção
  const [horizonMonths, setHorizonMonths] = useState<1 | 2 | 3 | 4>(4);
  const [triggerLesson, setTriggerLesson] = useState<number>(4);
  const [searchStudent, setSearchStudent] = useState<string>('');
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Modo da fonte de dados dos alunos
  const [sourceMode, setSourceMode] = useState<'full_sheet' | 'current_order' | 'custom_file'>('full_sheet');
  const [sourceItems, setSourceItems] = useState<(ProcessedStudentItem | Record<string, unknown>)[]>([]);
  const [customUploadedFileName, setCustomUploadedFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  // 2. Frequência individual dos alunos (aulas/semana)
  const [frequencyConfigs, setFrequencyConfigs] = useState<Record<string, number>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('microlins_forecast_frequencies');
        if (cached) return JSON.parse(cached);
      } catch (e) {}
    }
    return {};
  });

  // Filtros de Pendências
  const [issueFilterStudent, setIssueFilterStudent] = useState('');
  const [issueFilterSubject, setIssueFilterSubject] = useState('');
  const [issueFilterType, setIssueFilterType] = useState('all');

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

  // Carrega configurações persistidas do Supabase ao montar
  useEffect(() => {
    async function fetchSavedConfigs() {
      try {
        const currentUnit = unitId || process.env.NEXT_PUBLIC_DEFAULT_UNIT_ID;
        if (!currentUnit) return;

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
            setFrequencyConfigs(raw.forecast_frequencies);
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
          ignoredSubjects: ['Digitação', 'Digitacao'],
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
    });
  }, [sourceItems, rawRows, currentOrderItems, coursesConfig, frequencyConfigs, triggerLesson, horizonMonths]);

  // Rótulos amigáveis dos meses (Mês 1 Atual, Daqui a 1 mês, Daqui a 2 meses, Daqui a 3 meses)
  const monthLabels = useMemo(() => getUpcomingMonthLabels(new Date(), horizonMonths), [horizonMonths]);

  // Alunos e demandas filtrados para a tabela do Cronograma
  const filteredForecastItems = useMemo(() => {
    return forecastResult.forecastItems.filter((item) => {
      if (searchStudent) {
        const q = searchStudent.toLowerCase();
        const matchesName = item.studentName.toLowerCase().includes(q);
        const matchesSubj = item.subjectName.toLowerCase().includes(q);
        if (!matchesName && !matchesSubj) return false;
      }
      if (filterMonth !== 'all') {
        if (item.estimatedMonthIndex !== parseInt(filterMonth, 10)) {
          return false;
        }
      }
      return true;
    });
  }, [forecastResult.forecastItems, searchStudent, filterMonth]);

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
          students,
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
  }, [monthLabels, forecastResult.forecastItems, filterMonth, searchStudent]);

  // Alterna expansão de uma matéria específica
  const toggleSubjectExpanded = (key: string) => {
    setExpandedSubjects((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Altera aulas/semana in-place para um aluno
  const handleUpdateStudentFrequency = (studentName: string, newLessons: number) => {
    const norm = studentName.trim().toLowerCase();
    setFrequencyConfigs((prev) => {
      const updated = { ...prev, [norm]: newLessons };
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
            title="Importar outra planilha avulsa (.xls / .xlsx)"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-300" />
            <span>{customUploadedFileName ? 'Trocar Planilha' : 'Upload Planilha'}</span>
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
      <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#0f3b7d]" />
          <span className="font-bold text-slate-700">Fonte dos Alunos para a Previsão:</span>
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
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-ABA 1: CRONOGRAMA & PREVISÃO MENSAL */}
      {/* ========================================================================= */}
      {activeSubTab === 'cronograma' && (
        <div className="space-y-6">
          {/* RESUMO EXECUTIVO DAS 3 PERGUNTAS CHAVE */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Resposta 1: Total de Alunos Únicos com Demanda nos 4 Meses */}
            <div className="bg-white p-4 rounded-2xl border border-blue-200 shadow-sm flex flex-col justify-between relative overflow-hidden bg-gradient-to-br from-white to-blue-50/50">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-[#0f3b7d]" />
                  Alunos com Demanda (4 Meses)
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                  Total Único
                </span>
              </div>
              <div className="flex items-baseline gap-2 my-2">
                <span className="text-3xl font-black text-[#0f3b7d]">{forecastResult.uniqueStudentsCount}</span>
                <span className="text-xs text-slate-500 font-semibold">alunos únicos</span>
              </div>
              <div className="text-[11px] text-slate-600 border-t border-blue-100/80 pt-2 flex items-center justify-between">
                <span>Total de apostilas projetadas:</span>
                <strong className="text-[#0f3b7d] font-bold">{forecastResult.totalWorkbooksCount} apostilas</strong>
              </div>
            </div>

            {/* Resposta 2: Destaque - Daqui a 2 Meses (Mês 3) */}
            <div className="bg-white p-4 rounded-2xl border-2 border-amber-400 shadow-sm flex flex-col justify-between relative overflow-hidden bg-gradient-to-br from-amber-50/70 to-white">
              <div className="flex items-center justify-between text-xs text-amber-900 mb-1">
                <span className="font-bold flex items-center gap-1.5 text-amber-950">
                  <Target className="w-4 h-4 text-amber-600" />
                  Pedido para DAQUI A 2 MESES
                </span>
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-300 text-amber-950 shadow-xs">
                  Mês 3 🎯
                </span>
              </div>
              <div className="flex items-baseline gap-2 my-2">
                <span className="text-3xl font-black text-amber-800">{month3Summary?.totalWorkbooks || 0}</span>
                <span className="text-xs text-amber-900 font-semibold">apostilas a pedir</span>
              </div>
              <div className="text-[11px] text-amber-900 border-t border-amber-200/80 pt-2 flex items-center justify-between">
                <span className="truncate">{month3Summary ? month3Summary.monthLabel : 'Daqui a 2 meses'}</span>
                <strong className="text-amber-950 font-bold shrink-0">{month3Summary?.uniqueStudentsCount || 0} alunos</strong>
              </div>
            </div>

            {/* Card Mês 1 (Atual - Imediato) */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span className="font-bold text-slate-700">Mês 1 (Mês Atual)</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                  Imediato
                </span>
              </div>
              <div className="flex items-baseline gap-2 my-2">
                <span className="text-3xl font-black text-slate-800">{month1Summary?.totalWorkbooks || 0}</span>
                <span className="text-xs text-slate-500 font-semibold">apostilas</span>
              </div>
              <div className="text-[11px] text-slate-600 border-t border-slate-100 pt-2 flex items-center justify-between">
                <span className="truncate">{month1Summary ? month1Summary.monthLabel : 'Mês Atual'}</span>
                <strong className="text-slate-800 font-bold shrink-0">{month1Summary?.uniqueStudentsCount || 0} alunos</strong>
              </div>
            </div>

            {/* Card Mês 2 (Daqui a 1 Mês) */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span className="font-bold text-slate-700">Mês 2 (Daqui a 1 mês)</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                  +4 semanas
                </span>
              </div>
              <div className="flex items-baseline gap-2 my-2">
                <span className="text-3xl font-black text-slate-800">{month2Summary?.totalWorkbooks || 0}</span>
                <span className="text-xs text-slate-500 font-semibold">apostilas</span>
              </div>
              <div className="text-[11px] text-slate-600 border-t border-slate-100 pt-2 flex items-center justify-between">
                <span className="truncate">{month2Summary ? month2Summary.monthLabel : 'Daqui a 1 mês'}</span>
                <strong className="text-slate-800 font-bold shrink-0">{month2Summary?.uniqueStudentsCount || 0} alunos</strong>
              </div>
            </div>
          </div>

          {/* Cards de Resumo Mensal Detalhados por Mês */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {forecastResult.monthlySummaries.map((summary) => (
              <div
                key={summary.monthIndex}
                className={`p-4 rounded-xl border shadow-2xs flex flex-col justify-between transition-all ${
                  summary.monthIndex === 3
                    ? 'bg-amber-50/40 border-amber-300'
                    : 'bg-white border-slate-200 hover:border-[#0f3b7d]/50'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span className="font-semibold text-slate-700 truncate" title={summary.monthLabel}>
                    {summary.monthLabel}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      summary.monthIndex === 3
                        ? 'bg-amber-200 text-amber-950'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    Mês {summary.monthIndex}
                  </span>
                </div>
                <div className="flex items-baseline gap-2 my-2">
                  <span className="text-2xl font-black text-[#0f3b7d]">{summary.totalWorkbooks}</span>
                  <span className="text-xs text-slate-400 font-medium">apostilas ({summary.uniqueStudentsCount || 0} alunos)</span>
                </div>
                <div className="text-[11px] text-slate-500 border-t border-slate-100 pt-2 truncate">
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
            ))}
          </div>

          {/* BARRA DE CONTROLE: ALTERNAR ENTRE VISÃO POR MATÉRIA E VISÃO POR ALUNO */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/60">
              {/* Seletor do Modo de Visualização */}
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-slate-200/80 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setScheduleViewMode('subjects')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
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
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
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

              {/* Filtro por Aluno / Matéria e Mês */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-full sm:w-60">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Filtrar aluno ou matéria..."
                    value={searchStudent}
                    onChange={(e) => setSearchStudent(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-white text-xs border border-slate-200 rounded-xl outline-none focus:border-[#0f3b7d]"
                  />
                </div>

                <select
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="px-3 py-1.5 bg-white text-xs border border-slate-200 rounded-xl outline-none text-slate-700 font-semibold"
                >
                  <option value="all">Todos os Meses</option>
                  {monthLabels.map((m) => (
                    <option key={m.index} value={m.index}>
                      {m.label} ({m.relativeLabel})
                    </option>
                  ))}
                </select>

                {/* Exportar Excel */}
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all"
                  title="Exportar planilha Excel com Resumo Mensal por Matéria e Cronograma por Aluno"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Exportar Excel (.xlsx)</span>
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
                                            <th className="py-2 px-3">Aluno</th>
                                            <th className="py-2 px-3 text-center w-28">Aula / Total</th>
                                            <th className="py-2 px-3 text-center w-28">Ritmo Semanal</th>
                                            <th className="py-2 px-3 text-center w-36">Etapa</th>
                                            <th className="py-2 px-3 text-center w-32">Semana Est.</th>
                                            <th className="py-2 px-3 text-center w-28">Status</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                          {subj.students.map((student) => (
                                            <tr key={student.id} className="hover:bg-slate-50">
                                              <td className="py-2 px-3 font-semibold text-slate-800">
                                                {student.studentName}
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
                                              <td className="py-2 px-3 text-center text-slate-600 font-mono text-[11px]">
                                                {student.weeksUntilNextOrder === 0
                                                  ? 'Imediato'
                                                  : `Em ~${student.weeksUntilNextOrder} sem.`}
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
                      <th className="py-2.5 px-3 min-w-[200px]">Aluno</th>
                      <th className="py-2.5 px-3 min-w-[200px]">Matéria Solicitada</th>
                      <th className="py-2.5 px-3 text-center w-32">Etapa</th>
                      <th className="py-2.5 px-3 text-center w-28">Aula / Total</th>
                      <th className="py-2.5 px-3 text-center w-28">Aulas / Sem.</th>
                      <th className="py-2.5 px-3 text-center w-28">Matérias Rest.</th>
                      <th className="py-2.5 px-3 min-w-[180px]">Mês Estimado</th>
                      <th className="py-2.5 px-3 text-center w-28">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredForecastItems.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-10 text-center text-slate-400">
                          Nenhum aluno encontrado para os filtros selecionados.
                        </td>
                      </tr>
                    ) : (
                      filteredForecastItems.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">
                            {item.studentName}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-700">
                            {item.subjectName}
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
                Alunos padrão realizam 2 aulas por semana. Alunos especiais (pagamento acelerado ou pacotes VIP) realizam até 4 aulas/semana.
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

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">Aluno</th>
                  <th className="py-2.5 px-3">Matéria Atual</th>
                  <th className="py-2.5 px-3 text-center">Aula Atual</th>
                  <th className="py-2.5 px-3 text-center min-w-[200px]">Aulas por Semana</th>
                  <th className="py-2.5 px-3 text-center">Classificação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {forecastResult.forecastItems
                  .filter((i, idx, arr) => arr.findIndex((x) => x.studentName === i.studentName) === idx)
                  .filter((i) => !searchStudent || i.studentName.toLowerCase().includes(searchStudent.toLowerCase()))
                  .map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2 px-3 font-semibold text-slate-800">{item.studentName}</td>
                      <td className="py-2 px-3 text-slate-600">{item.subjectName}</td>
                      <td className="py-2 px-3 text-center font-bold text-[#0f3b7d]">{item.currentLesson}</td>
                      <td className="py-2 px-3 text-center">
                        <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                          {[1, 2, 3, 4].map((num) => (
                            <button
                              key={num}
                              type="button"
                              onClick={() => handleUpdateStudentFrequency(item.studentName, num)}
                              className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                                item.lessonsPerWeek === num
                                  ? num > 2
                                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                                    : 'bg-[#0f3b7d] text-white shadow-xs'
                                  : 'text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              {num}x
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-center">
                        {item.isSpecial ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                            Aluno Especial ({item.lessonsPerWeek}x/sem)
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">Padrão (2x)</span>
                        )}
                      </td>
                    </tr>
                  ))}
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
    </div>
  );
}
