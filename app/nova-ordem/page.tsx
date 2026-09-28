'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Upload,
  FileSpreadsheet,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Filter,
  Save,
  RefreshCw,
  Search,
  BookOpen,
  ClipboardList,
  UserCheck,
  ChevronDown,
  Check,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Users,
  FileText,
  Layers,
  PenLine,
  Zap,
  Ban,
  Calendar,
  Clock
} from 'lucide-react';
import {
  parseSpreadsheetBuffer,
  parseSpreadsheetRows,
  parseBaseContratosBuffer,
  buildContractBaseAnalysis,
  lookupEducatorInBase,
  ContractBaseAnalysis,
  parseControlePedagogicoBuffer,
  buildPedagogicalScheduleAnalysis,
  lookupPedagogicalSchedule,
  enrichItemsWithPedagogicalSchedule,
  PedagogicalScheduleAnalysis
} from '../../lib/importers';
import { analyzeDuplicates } from '../../lib/domain/duplicates';
import { formatOrderTitle, normalizeText, toFirstName } from '../../lib/domain/sanitizer';
import { ProcessedStudentItem, Educator } from '../../types';
import { supabase } from '../../lib/supabase/client';
import { useDialog } from '../../components/ui/dialog';

export default function NovaOrdemPage() {
  const router = useRouter();
  const { showAlert, showConfirm, showToast } = useDialog();

  // Wizard State
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [title, setTitle] = useState('ENTREGA DE MATERIAL - PEDIDO');
  const [fileName, setFileName] = useState('');
  const [rawBuffer, setRawBuffer] = useState<ArrayBuffer | null>(null);
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);

  // Filter State - inicializa lendo configuracao salva ou padrao 2 a 6
  const [lessonMin, setLessonMin] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('microlins_unit_settings');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (typeof parsed.default_lesson_from === 'number') return parsed.default_lesson_from;
        }
      } catch (e) {}
    }
    return 2;
  });
  const [lessonMax, setLessonMax] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('microlins_unit_settings');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (typeof parsed.default_lesson_to === 'number') return parsed.default_lesson_to;
        }
      } catch (e) {}
    }
    return 6;
  });
  const [allLessons, setAllLessons] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Base de Contratos (Planilha Complementar para Cruzamento Aluno x Educador)
  const [baseContratos, setBaseContratos] = useState<ContractBaseAnalysis | null>(null);
  const [baseContratosFileName, setBaseContratosFileName] = useState<string>('');
  const [baseContratosSource, setBaseContratosSource] = useState<'system' | 'custom' | null>(null);
  const [isProcessingBaseContratos, setIsProcessingBaseContratos] = useState(false);
  const [crossedEducatorsCount, setCrossedEducatorsCount] = useState(0);
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);

  // Controle Pedagógico (Planilha Complementar Opcional para Próxima Matéria, Turma e Horário)
  const [controlePedagogico, setControlePedagogico] = useState<PedagogicalScheduleAnalysis | null>(null);
  const [controlePedagogicoFileName, setControlePedagogicoFileName] = useState<string>('');
  const [isProcessingControlePedagogico, setIsProcessingControlePedagogico] = useState(false);
  const [matchedPedagogicalCount, setMatchedPedagogicalCount] = useState(0);

  // Data & Duplicates State
  const [items, setItems] = useState<ProcessedStudentItem[]>([]);
  const [internalDuplicatesCount, setInternalDuplicatesCount] = useState(0);
  const [historicalDuplicatesCount, setHistoricalDuplicatesCount] = useState(0);
  const [ignoredEducators, setIgnoredEducators] = useState<string[]>([
    'Malone de Souza',
    'Antonio Fagner dos Santos Silva',
    'Pyetra Alves Vieira de Oliveira',
  ]);
  const [historicalMap, setHistoricalMap] = useState<Map<string, string>>(new Map());

  // Settings-based exclusion lists (loaded from Supabase)
  const [ignoredSubjects, setIgnoredSubjects] = useState<string[]>(['Digitação', 'Digitacao']);
  const [excludedContractTypes, setExcludedContractTypes] = useState<string[]>(['Bolsista']);

  // Educador único por pedido (override manual opcional)
  const [selectedEducator, setSelectedEducator] = useState('');
  const [educators, setEducators] = useState<Educator[]>([]);
  const [isEducatorDropdownOpen, setIsEducatorDropdownOpen] = useState(false);
  const [educatorSearch, setEducatorSearch] = useState('');
  const educatorDropdownRef = useRef<HTMLDivElement | null>(null);

  // Filtro por Educador e Ordenação na Tabela de Inspeção
  const [filterEducator, setFilterEducator] = useState<string>('all');
  const [isEducatorFilterMenuOpen, setIsEducatorFilterMenuOpen] = useState(false);
  const [educatorFilterSearch, setEducatorFilterSearch] = useState('');
  const educatorFilterMenuRef = useRef<HTMLTableCellElement | null>(null);

  const [sortField, setSortField] = useState<
    'index' | 'studentName' | 'subjectName' | 'educatorName' | 'currentLesson' | 'classSchedule'
  >('index');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Loading States
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Fecha dropdowns ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        educatorDropdownRef.current &&
        !educatorDropdownRef.current.contains(event.target as Node)
      ) {
        setIsEducatorDropdownOpen(false);
      }
      if (
        educatorFilterMenuRef.current &&
        !educatorFilterMenuRef.current.contains(event.target as Node)
      ) {
        setIsEducatorFilterMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Carrega educadores, settings, histórico existente e base de contratos padrão
  useEffect(() => {
    async function loadInitialData() {
      try {
        const unitId = process.env.NEXT_PUBLIC_DEFAULT_UNIT_ID || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

        // 1. Busca educadores cadastrados
        const { data: educatorsData } = await supabase
          .from('educators')
          .select('*')
          .eq('active', true)
          .order('name');

        if (educatorsData && educatorsData.length > 0) {
          setIgnoredEducators(educatorsData.map((e) => e.name));
          setEducators(educatorsData);
        }

        // 2. Busca configurações da unidade
        const { data: settingsData } = await supabase
          .from('unit_settings')
          .select('*')
          .eq('unit_id', unitId)
          .single();

        let configuredMin = 2;
        let configuredMax = 6;

        if (settingsData) {
          if (typeof window !== 'undefined') {
            localStorage.setItem('microlins_unit_settings', JSON.stringify(settingsData));
          }
          if (settingsData.ignored_subjects && settingsData.ignored_subjects.length > 0) {
            setIgnoredSubjects(settingsData.ignored_subjects);
          }
          if (settingsData.excluded_contract_types && settingsData.excluded_contract_types.length > 0) {
            setExcludedContractTypes(settingsData.excluded_contract_types);
          }
          if (typeof settingsData.default_lesson_from === 'number') {
            setLessonMin(settingsData.default_lesson_from);
            configuredMin = settingsData.default_lesson_from;
          }
          if (typeof settingsData.default_lesson_to === 'number') {
            setLessonMax(settingsData.default_lesson_to);
            configuredMax = settingsData.default_lesson_to;
          }
        }

        // 3. Busca itens do histórico para detecção de duplicidades
        const { data: existingItems } = await supabase
          .from('order_items')
          .select('duplicate_fingerprint, orders(title)');

        if (existingItems) {
          const hist = new Map<string, string>();
          existingItems.forEach((item: any) => {
            if (item.duplicate_fingerprint) {
              const orderTitle = item.orders?.title || 'Pedido Anterior';
              hist.set(item.duplicate_fingerprint, orderTitle);
            }
          });
          setHistoricalMap(hist);
        }

        // 4. Carrega a Base de Contratos (se salva em cache ou padrão do sistema)
        let loadedBaseContratos: ContractBaseAnalysis | null = null;
        try {
          const savedBase = localStorage.getItem('microlins_base_contratos_cache');
          if (savedBase) {
            const parsed = JSON.parse(savedBase);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const analysis = buildContractBaseAnalysis(parsed);
              loadedBaseContratos = analysis;
              setBaseContratos(analysis);
              setBaseContratosFileName('Base Salva (Cache Local)');
              setBaseContratosSource('custom');
            }
          } else {
            // Tenta carregar o base_contratos.json disponibilizado
            const res = await fetch('./base_contratos.json');
            if (res.ok) {
              const data = await res.json();
              if (Array.isArray(data) && data.length > 0) {
                const analysis = buildContractBaseAnalysis(data);
                loadedBaseContratos = analysis;
                setBaseContratos(analysis);
                setBaseContratosFileName('Análise Base de Contratos (Padrão)');
                setBaseContratosSource('system');
              }
            }
          }
        } catch (e) {
          console.warn('Base de contratos padrão não encontrada automaticamente:', e);
        }

        // 4b. Carrega o Controle Pedagógico (se salvo em cache local)
        let loadedControlePedagogico: PedagogicalScheduleAnalysis | null = null;
        try {
          const savedControle = localStorage.getItem('microlins_controle_pedagogico_cache');
          if (savedControle) {
            const parsed = JSON.parse(savedControle);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const analysis = buildPedagogicalScheduleAnalysis(parsed);
              loadedControlePedagogico = analysis;
              setControlePedagogico(analysis);
              setControlePedagogicoFileName('Controle Pedagógico Salvo');
            }
          }
        } catch (e) {
          console.warn('Erro ao carregar controle pedagógico do cache:', e);
        }

        // 5. Restaura rascunho de importação em andamento (se houver)
        try {
          const savedDraft = localStorage.getItem('microlins_draft_nova_ordem');
          if (savedDraft) {
            const draft = JSON.parse(savedDraft);
            if (draft.items && draft.items.length > 0) {
              setItems(draft.items);
              if (draft.title) setTitle(draft.title);
              if (draft.fileName) setFileName(draft.fileName);
              if (draft.rawRows && Array.isArray(draft.rawRows)) {
                setRawRows(draft.rawRows);
              }

              // Prioriza a faixa configurada na unidade
              const targetMin = typeof settingsData?.default_lesson_from === 'number'
                ? settingsData.default_lesson_from
                : (typeof draft.lessonMin === 'number' ? draft.lessonMin : configuredMin);
              const targetMax = typeof settingsData?.default_lesson_to === 'number'
                ? settingsData.default_lesson_to
                : (typeof draft.lessonMax === 'number' ? draft.lessonMax : configuredMax);

              setLessonMin(targetMin);
              setLessonMax(targetMax);
              if (draft.allLessons !== undefined) setAllLessons(draft.allLessons);
              if (draft.selectedEducator) setSelectedEducator(draft.selectedEducator);
              if (draft.filterEducator) setFilterEducator(draft.filterEducator);
              if (draft.crossedEducatorsCount) setCrossedEducatorsCount(draft.crossedEducatorsCount);
              if (draft.matchedPedagogicalCount) setMatchedPedagogicalCount(draft.matchedPedagogicalCount);
              if (draft.internalDuplicatesCount !== undefined) setInternalDuplicatesCount(draft.internalDuplicatesCount);
              if (draft.historicalDuplicatesCount !== undefined) setHistoricalDuplicatesCount(draft.historicalDuplicatesCount);
              setStep(3);
              setHasRestoredDraft(true);

              // Se a faixa configurada difere do rascunho e temos as linhas brutas, reprocessa imediatamente
              if (draft.rawRows && Array.isArray(draft.rawRows) && draft.rawRows.length > 0) {
                if (draft.lessonMin !== targetMin || draft.lessonMax !== targetMax) {
                  reprocessRowsWithFilters(
                    draft.rawRows,
                    targetMin,
                    targetMax,
                    draft.allLessons ?? false,
                    settingsData?.ignored_subjects || ignoredSubjects,
                    settingsData?.excluded_contract_types || excludedContractTypes,
                    loadedBaseContratos || baseContratos,
                    loadedControlePedagogico || controlePedagogico
                  );
                }
              }
            }
          }
        } catch (draftErr) {
          console.warn('Erro ao restaurar rascunho de nova ordem:', draftErr);
        }
      } catch (err) {
        console.warn('Supabase offline ou tabelas pendentes:', err);
      }
    }

    loadInitialData();
  }, []);

  // Reprocessa registros brutos com novos filtros
  const reprocessRowsWithFilters = (
    rowsToProcess: Record<string, unknown>[],
    min: number,
    max: number,
    all: boolean,
    activeIgnoredSubjects = ignoredSubjects,
    activeExcludedContracts = excludedContractTypes,
    activeBaseContratos = baseContratos,
    activeControlePedagogico = controlePedagogico
  ) => {
    try {
      const result = parseSpreadsheetRows(rowsToProcess, {
        ignoredEducators,
        ignoredSubjects: activeIgnoredSubjects,
        excludedContractTypes: activeExcludedContracts,
        lessonMin: min,
        lessonMax: max,
        allLessons: all,
      });

      // Aplica cruzamento com a Base de Contratos (se disponível)
      let crossedCount = 0;
      let enrichedItems = result.eligibleItems.map((item) => {
        if (activeBaseContratos) {
          const matchedEducator = lookupEducatorInBase(
            {
              studentName: item.studentName,
              contractNumber: item.contractNumber,
              courseName: item.courseName,
              rawSubjectName: item.rawSubjectName,
            },
            activeBaseContratos
          );

          if (matchedEducator) {
            crossedCount++;
            return {
              ...item,
              educatorName: matchedEducator,
            };
          }
        }
        return item;
      });

      // Aplica enriquecimento com o Controle Pedagógico (Próxima Matéria, Turma, Horário e Telefone)
      let pedagogicalMatched = 0;
      if (activeControlePedagogico) {
        const enrichedResult = enrichItemsWithPedagogicalSchedule(enrichedItems, activeControlePedagogico);
        enrichedItems = enrichedResult.items;
        pedagogicalMatched = enrichedResult.matchedCount;
      }

      const duplicateAnalysis = analyzeDuplicates(enrichedItems, historicalMap);

      setItems(duplicateAnalysis.items);
      setInternalDuplicatesCount(duplicateAnalysis.internalDuplicatesCount);
      setHistoricalDuplicatesCount(duplicateAnalysis.historicalDuplicatesCount);
      setCrossedEducatorsCount(crossedCount);
      setMatchedPedagogicalCount(pedagogicalMatched);
      setLessonMin(min);
      setLessonMax(max);
      setAllLessons(all);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao processar filtros de aula.');
    }
  };

  // Processa o buffer do arquivo com os filtros atuais, base de contratos e controle pedagógico
  const processSpreadsheet = (
    buffer: ArrayBuffer,
    overrideIgnoredSubjects?: string[],
    overrideExcludedContracts?: string[],
    activeBaseContratos = baseContratos,
    activeControlePedagogico = controlePedagogico
  ) => {
    try {
      setIsProcessingFile(true);
      setErrorMessage('');

      const result = parseSpreadsheetBuffer(buffer, {
        ignoredEducators,
        ignoredSubjects: overrideIgnoredSubjects || ignoredSubjects,
        excludedContractTypes: overrideExcludedContracts || excludedContractTypes,
        lessonMin,
        lessonMax,
        allLessons,
      });

      setRawRows(result.rawRows);

      // Aplica cruzamento com a Base de Contratos (se disponível)
      let crossedCount = 0;
      let enrichedItems = result.eligibleItems.map((item) => {
        if (activeBaseContratos) {
          const matchedEducator = lookupEducatorInBase(
            {
              studentName: item.studentName,
              contractNumber: item.contractNumber,
              courseName: item.courseName,
              rawSubjectName: item.rawSubjectName,
            },
            activeBaseContratos
          );

          if (matchedEducator) {
            crossedCount++;
            return {
              ...item,
              educatorName: matchedEducator,
            };
          }
        }
        return item;
      });

      // Aplica enriquecimento com o Controle Pedagógico (Próxima Matéria, Turma, Horário)
      let pedagogicalMatched = 0;
      if (activeControlePedagogico) {
        const enrichedResult = enrichItemsWithPedagogicalSchedule(enrichedItems, activeControlePedagogico);
        enrichedItems = enrichedResult.items;
        pedagogicalMatched = enrichedResult.matchedCount;
      }

      // Aplica verificação de duplicidades internas e históricas
      const duplicateAnalysis = analyzeDuplicates(enrichedItems, historicalMap);

      setItems(duplicateAnalysis.items);
      setInternalDuplicatesCount(duplicateAnalysis.internalDuplicatesCount);
      setHistoricalDuplicatesCount(duplicateAnalysis.historicalDuplicatesCount);
      setCrossedEducatorsCount(crossedCount);
      setMatchedPedagogicalCount(pedagogicalMatched);
      setFilterEducator('all');
      setStep(3); // Avança para a tabela de inspeção
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao processar arquivo.');
    } finally {
      setIsProcessingFile(false);
    }
  };

  // Upload handler da Planilha Principal
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const buffer = event.target?.result as ArrayBuffer;
      if (buffer) {
        setRawBuffer(buffer);
        processSpreadsheet(buffer);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Upload handler da Planilha Complementar (Análise Base de Contratos)
  const handleBaseContratosUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessingBaseContratos(true);
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const buffer = event.target?.result as ArrayBuffer;
          if (buffer) {
            const analysis = parseBaseContratosBuffer(buffer);
            setBaseContratos(analysis);
            setBaseContratosFileName(file.name);
            setBaseContratosSource('custom');

            // Salva no localStorage para não precisar enviar novamente a cada sessão
            try {
              const simplified = analysis.entries.map((en) => ({
                Nome: en.studentName,
                Educador: en.educatorName,
                Contrato: en.contractNumber,
                Formações: en.courseName,
                'Tipo Contrato': en.contractType,
              }));
              localStorage.setItem('microlins_base_contratos_cache', JSON.stringify(simplified));
            } catch (storageErr) {
              console.warn('Storage limit:', storageErr);
            }

            showToast(
              `Base de Contratos conectada: ${analysis.totalRows} registros e ${analysis.educators.length} educadores mapeados!`,
              'success'
            );

            // Se a planilha principal já foi enviada, reprocessa imediatamente para cruzar os alunos
            if (rawBuffer) {
              processSpreadsheet(rawBuffer, undefined, undefined, analysis, controlePedagogico);
            } else if (rawRows.length > 0) {
              reprocessRowsWithFilters(
                rawRows,
                lessonMin,
                lessonMax,
                allLessons,
                ignoredSubjects,
                excludedContractTypes,
                analysis,
                controlePedagogico
              );
            }
          }
        } catch (err: any) {
          showAlert(
            err.message || 'Falha ao processar a Base de Contratos.',
            'error',
            'Arquivo Inválido'
          );
        } finally {
          setIsProcessingBaseContratos(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err: any) {
      setIsProcessingBaseContratos(false);
      showAlert(err.message || 'Erro ao ler arquivo.', 'error', 'Erro');
    }
  };

  // Upload handler da Planilha Complementar (Controle Pedagógico - Próxima Matéria, Turma e Horário)
  const handleControlePedagogicoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessingControlePedagogico(true);
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const buffer = event.target?.result as ArrayBuffer;
          if (buffer) {
            const analysis = parseControlePedagogicoBuffer(buffer);
            setControlePedagogico(analysis);
            setControlePedagogicoFileName(file.name);

            // Salva no localStorage para manter entre navegações
            try {
              const simplified = analysis.entries.map((en) => ({
                Aluno: en.studentName,
                'Nº Contrato': en.contractNumber,
                'Próxima Matéria': en.nextSubject,
                'Dias / Horários': en.classSchedule,
                Dia: en.scheduledDay,
                Horário: en.scheduledTime,
                Telefone: en.phone,
              }));
              localStorage.setItem('microlins_controle_pedagogico_cache', JSON.stringify(simplified));
            } catch (storageErr) {
              console.warn('Storage limit:', storageErr);
            }

            showToast(
              `Controle Pedagógico conectado: ${analysis.totalRows} alunos mapeados com horários e próxima matéria!`,
              'success'
            );

            // Se a planilha principal já foi enviada, reprocessa imediatamente para cruzar
            if (rawBuffer) {
              processSpreadsheet(rawBuffer, undefined, undefined, baseContratos, analysis);
            } else if (rawRows.length > 0) {
              reprocessRowsWithFilters(
                rawRows,
                lessonMin,
                lessonMax,
                allLessons,
                ignoredSubjects,
                excludedContractTypes,
                baseContratos,
                analysis
              );
            }
          }
        } catch (err: any) {
          showAlert(
            err.message || 'Falha ao processar o Controle Pedagógico.',
            'error',
            'Arquivo Inválido'
          );
        } finally {
          setIsProcessingControlePedagogico(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err: any) {
      setIsProcessingControlePedagogico(false);
      showAlert(err.message || 'Erro ao ler arquivo.', 'error', 'Erro');
    }
  };

  // Re-aplica filtros de aulas sem re-upload
  const handleApplyFilter = (min: number, max: number, all: boolean) => {
    setLessonMin(min);
    setLessonMax(max);
    setAllLessons(all);

    if (rawRows && rawRows.length > 0) {
      reprocessRowsWithFilters(
        rawRows,
        min,
        max,
        all,
        ignoredSubjects,
        excludedContractTypes,
        baseContratos,
        controlePedagogico
      );
    } else if (rawBuffer) {
      processSpreadsheet(
        rawBuffer,
        undefined,
        undefined,
        baseContratos,
        controlePedagogico
      );
    }
  };

  // Exclusão manual de aluno individual na tabela de inspeção
  const handleRemoveItem = (id: string) => {
    const remaining = items.filter((item) => item.id !== id);
    const duplicateAnalysis = analyzeDuplicates(remaining, historicalMap);
    setItems(duplicateAnalysis.items);
    setInternalDuplicatesCount(duplicateAnalysis.internalDuplicatesCount);
    setHistoricalDuplicatesCount(duplicateAnalysis.historicalDuplicatesCount);
  };

  // Contagem de apostilas por educador
  const educatorCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    items.forEach((item) => {
      const ed = item.educatorName?.trim() || 'Sem Educador';
      counts[ed] = (counts[ed] || 0) + 1;
    });
    return counts;
  }, [items]);

  // Lista ordenada de educadores com alunos presentes
  const distinctEducatorsWithCounts = useMemo(() => {
    return Object.entries(educatorCounts).sort((a, b) => {
      if (a[0] === 'Sem Educador') return 1;
      if (b[0] === 'Sem Educador') return -1;
      return a[0].localeCompare(b[0]);
    });
  }, [educatorCounts]);

  // Alterna ordenação de coluna
  const handleSort = (
    field: 'index' | 'studentName' | 'subjectName' | 'educatorName' | 'currentLesson' | 'classSchedule'
  ) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Itens visíveis filtrados e ordenados
  const visibleItems = useMemo(() => {
    let list = items;

    // Filtro por Educador (da aba ou rótulo de coluna)
    if (filterEducator !== 'all') {
      if (filterEducator === '__unassigned__') {
        list = list.filter((i) => !i.educatorName?.trim());
      } else {
        list = list.filter((i) => i.educatorName?.trim() === filterEducator);
      }
    }

    // Filtro por texto digitado
    if (searchQuery.trim()) {
      const q = normalizeText(searchQuery);
      list = list.filter(
        (i) =>
          i.studentNameNormalized.includes(q) ||
          i.subjectNameNormalized.includes(q) ||
          normalizeText(i.educatorName || '').includes(q) ||
          normalizeText(i.rawSubjectName || '').includes(q)
      );
    }

    // Ordenação dinâmica
    return [...list].sort((a, b) => {
      let valA: any = a[sortField as keyof ProcessedStudentItem] || '';
      let valB: any = b[sortField as keyof ProcessedStudentItem] || '';

      if (sortField === 'index') {
        valA = a.sourceRowNumber || 0;
        valB = b.sourceRowNumber || 0;
      } else if (sortField === 'educatorName') {
        valA = selectedEducator || a.educatorName || '';
        valB = selectedEducator || b.educatorName || '';
      }

      if (typeof valA === 'string') {
        const res = valA.localeCompare(valB, 'pt-BR');
        return sortDirection === 'asc' ? res : -res;
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [items, filterEducator, searchQuery, sortField, sortDirection, selectedEducator]);

  // Finalização do pedido: Salva apenas os itens do educador filtrado OU todos os itens
  const handleFinalizeOrder = async (onlyFilteredEducator = false) => {
    const itemsToSave = onlyFilteredEducator ? visibleItems : items;

    if (itemsToSave.length === 0) {
      showAlert('Não há itens válidos para gerar o pedido.', 'warning', 'Pedido Vazio');
      return;
    }

    try {
      setIsSaving(true);
      const unitId = process.env.NEXT_PUBLIC_DEFAULT_UNIT_ID || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
      const now = new Date();

      // Ajusta título se estiver separando por educador
      let finalTitle = title;
      if (onlyFilteredEducator && filterEducator !== 'all' && filterEducator !== '__unassigned__') {
        if (!title.toLowerCase().includes(filterEducator.toLowerCase())) {
          finalTitle = `${title} (${filterEducator})`;
        }
      }
      const cleanTitle = formatOrderTitle(finalTitle);

      // 1. Obtém sequência de ordem
      const { data: seqData } = await supabase.rpc('get_next_order_sequence', {
        p_unit_id: unitId,
      });

      const nextSeq = seqData?.[0]?.next_seq || 1;
      const orderNumber = seqData?.[0]?.next_number || `#${String(nextSeq).padStart(3, '0')}`;

      // 2. Cria o pedido
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          unit_id: unitId,
          order_number: orderNumber,
          sequence_num: nextSeq,
          title: cleanTitle,
          status: 'open',
          competence_month: now.getMonth() + 1,
          competence_year: now.getFullYear(),
          total_items: itemsToSave.length,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // 3. Grava itens do pedido com os educadores individuais cruzados
      const itemsToInsert = itemsToSave.map((item, idx) => ({
        order_id: orderData.id,
        student_name: item.studentName,
        student_name_normalized: item.studentNameNormalized,
        subject_name: item.subjectName,
        subject_name_normalized: item.subjectNameNormalized,
        raw_subject_name: item.rawSubjectName,
        course_name: item.courseName || null,
        educator_name: selectedEducator.trim() || item.educatorName || null,
        contract_number: item.contractNumber || null,
        current_lesson: item.currentLesson,
        scheduled_day: item.scheduledDay || null,
        scheduled_time: item.scheduledTime || null,
        class_schedule: item.classSchedule || null,
        next_subject: item.nextSubject || null,
        phone: item.phone || null,
        duplicate_fingerprint: item.duplicateFingerprint,
        is_internal_duplicate: item.isInternalDuplicate,
        is_historical_duplicate: item.isHistoricalDuplicate,
        historical_match_order_title: item.historicalMatchOrderTitle || null,
        source_row: idx + 5,
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(itemsToInsert);
      if (itemsError) throw itemsError;

      // Se salvou apenas um educador e ainda restam outros alunos na lista
      if (onlyFilteredEducator && itemsToSave.length < items.length) {
        const savedIds = new Set(itemsToSave.map((i) => i.id));
        const remaining = items.filter((i) => !savedIds.has(i.id));

        setItems(remaining);
        setFilterEducator('all');
        showToast(
          `Pedido ${orderNumber} criado para ${filterEducator} (${itemsToSave.length} apostilas)! Restam ${remaining.length} alunos na lista.`,
          'success'
        );
      } else {
        localStorage.removeItem('microlins_draft_nova_ordem');
        showToast(`Pedido ${orderNumber} criado com sucesso com ${itemsToSave.length} apostilas!`, 'success');
        router.push('/historico');
      }
    } catch (err: any) {
      console.error('Erro ao finalizar pedido:', err);
      showAlert(
        `Erro ao salvar no banco:\n${err.message || 'Verifique a conexão ou políticas do Supabase.'}`,
        'error',
        'Falha no Pedido'
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Salva rascunho de importação automaticamente no localStorage para não perder ao navegar
  useEffect(() => {
    if (items.length > 0) {
      try {
        const draft = {
          title,
          fileName,
          items,
          rawRows,
          step,
          lessonMin,
          lessonMax,
          allLessons,
          selectedEducator,
          filterEducator,
          crossedEducatorsCount,
          matchedPedagogicalCount,
          internalDuplicatesCount,
          historicalDuplicatesCount,
        };
        localStorage.setItem('microlins_draft_nova_ordem', JSON.stringify(draft));
      } catch (e) {
        try {
          const draftLight = {
            title,
            fileName,
            items,
            step,
            lessonMin,
            lessonMax,
            allLessons,
            selectedEducator,
            filterEducator,
            crossedEducatorsCount,
            matchedPedagogicalCount,
            internalDuplicatesCount,
            historicalDuplicatesCount,
          };
          localStorage.setItem('microlins_draft_nova_ordem', JSON.stringify(draftLight));
        } catch (innerE) {
          console.warn('Falha ao salvar rascunho de nova ordem:', innerE);
        }
      }
    }
  }, [
    items,
    rawRows,
    title,
    fileName,
    step,
    lessonMin,
    lessonMax,
    allLessons,
    selectedEducator,
    filterEducator,
    crossedEducatorsCount,
    matchedPedagogicalCount,
    internalDuplicatesCount,
    historicalDuplicatesCount,
  ]);

  // Descarta o rascunho de importação e reinicia o fluxo
  const handleClearDraft = () => {
    showConfirm({
      title: 'Descartar Rascunho',
      message: 'Deseja descartar a importação atual e limpar os dados carregados?',
      confirmText: 'Sim, descartar',
      cancelText: 'Cancelar',
      type: 'warning',
      onConfirm: () => {
        try {
          localStorage.removeItem('microlins_draft_nova_ordem');
          setItems([]);
          setRawRows([]);
          setFileName('');
          setRawBuffer(null);
          setTitle('ENTREGA DE MATERIAL - PEDIDO');
          setSelectedEducator('');
          setFilterEducator('all');
          setCrossedEducatorsCount(0);
          setMatchedPedagogicalCount(0);
          setHasRestoredDraft(false);

          // Restaura a faixa de aulas configurada na unidade
          try {
            const cached = localStorage.getItem('microlins_unit_settings');
            if (cached) {
              const p = JSON.parse(cached);
              if (typeof p.default_lesson_from === 'number') setLessonMin(p.default_lesson_from);
              if (typeof p.default_lesson_to === 'number') setLessonMax(p.default_lesson_to);
            }
          } catch (e) {}

          setStep(1);
          showToast('Importação descartada com sucesso.', 'info');
        } catch {}
      },
    });
  };

  // Abre os dados importados no editor de Pedido Manual para edição livre de linhas
  const handleEditInManualOrder = () => {
    const targetItems = filterEducator !== 'all' && filterEducator !== '__unassigned__' ? visibleItems : items;
    if (targetItems.length === 0) {
      showAlert('Não há itens válidos para editar no Pedido Manual.', 'warning', 'Atenção');
      return;
    }

    let finalTitle = title;
    if (filterEducator !== 'all' && filterEducator !== '__unassigned__' && !title.toLowerCase().includes(filterEducator.toLowerCase())) {
      finalTitle = `${title} (${filterEducator})`;
    }

    const manualRows = targetItems.map((item) => ({
      id: item.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9)),
      studentName: item.studentName,
      subjectName: item.subjectName,
      educatorName: toFirstName(selectedEducator.trim() || item.educatorName || ''),
    }));

    const draftManual = {
      title: finalTitle,
      competenceMonth: new Date().getMonth() + 1,
      competenceYear: new Date().getFullYear(),
      selectedEducator: toFirstName(selectedEducator.trim() || (filterEducator !== 'all' && filterEducator !== '__unassigned__' ? filterEducator : '')),
      rows: manualRows,
      isEditMode: false,
      source: 'imported_from_nova_ordem',
      importedFileName: fileName,
    };

    localStorage.setItem('microlins_draft_pedido_manual', JSON.stringify(draftManual));
    showToast(`Carregando ${manualRows.length} apostilas no editor manual...`, 'info');
    router.push('/novo-pedido-manual?from=import');
  };

  const filteredEducators = educators.filter((ed) =>
    ed.name.toLowerCase().includes(educatorSearch.toLowerCase())
  );

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-[#0f3b7d]" />
            Central de Gestão • Novo Pedido
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Importação inteligente com cruzamento de educadores, conferência de matérias e separação de pedidos
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 text-xs font-semibold">
          <span
            className={`px-3 py-1 rounded-full ${
              step >= 1 ? 'bg-[#0f3b7d] text-white' : 'bg-slate-100 text-slate-400'
            }`}
          >
            1. Título
          </span>
          <span className="text-slate-300">→</span>
          <span
            className={`px-3 py-1 rounded-full ${
              step >= 2 ? 'bg-[#0f3b7d] text-white' : 'bg-slate-100 text-slate-400'
            }`}
          >
            2. Upload
          </span>
          <span className="text-slate-300">→</span>
          <span
            className={`px-3 py-1 rounded-full ${
              step === 3 ? 'bg-[#0f3b7d] text-white' : 'bg-slate-100 text-slate-400'
            }`}
          >
            3. Curadoria & Finalização
          </span>
        </div>
      </div>

      {/* Erro Geral */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Banner de Rascunho Restaurado */}
      {hasRestoredDraft && items.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 text-[#0f3b7d] px-4 py-3 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#0f3b7d] shrink-0" />
            <span>
              <strong>Rascunho mantido:</strong> Sua importação com <strong>{items.length} apostilas</strong> foi restaurada para não perder seu trabalho ao navegar entre as opções do sistema.
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleEditInManualOrder}
              className="text-xs font-bold text-[#0f3b7d] hover:underline flex items-center gap-1"
            >
              <PenLine className="w-3.5 h-3.5" />
              Editar Pedido
            </button>
            <button
              type="button"
              onClick={handleClearDraft}
              className="text-slate-500 hover:text-red-600 font-semibold underline text-[11px]"
            >
              Descartar e começar novo
            </button>
          </div>
        </div>
      )}

      {/* Banner de Alternância para Pedido Manual */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#0f3b7d] flex items-center justify-center text-white shrink-0 shadow-sm">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-800">
              Possui listas impressas de pedidos já feitos para cadastrar?
            </h3>
            <p className="text-[11px] text-slate-500">
              Utilize a digitação manual de histórico com campos de Aluno, Matéria, Educador, Data, Entrega e Liberação.
            </p>
          </div>
        </div>
        <Link
          href="/novo-pedido-manual"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0f3b7d] text-white text-xs font-bold hover:bg-[#0a2e68] shadow-sm transition-all shrink-0"
        >
          <PenLine className="w-3.5 h-3.5" />
          <span>Lançar Pedido Manual</span>
        </Link>
      </div>

      {/* ETAPA 1 & 2: Formulário de Entrada, Planilha Principal, Controle Pedagógico & Base de Contratos */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {/* Card 1: Título do Pedido */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3 flex flex-col justify-between">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-1">
              1. Título do Pedido
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: ENTREGA DE MATERIAL - PEDIDO"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3b7d] font-medium"
            />
            <p className="text-[11px] text-slate-400 mt-2">
              * O sistema preserva exatamente maiúsculas e minúsculas conforme digitado.
            </p>
          </div>

          {filterEducator !== 'all' && filterEducator !== '__unassigned__' && (
            <button
              type="button"
              onClick={() => setTitle(`ENTREGA DE MATERIAL - PEDIDO (${filterEducator})`)}
              className="text-[11px] text-[#0f3b7d] hover:underline font-semibold text-left flex items-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>Sugestão: Título com nome de {filterEducator}</span>
            </button>
          )}
        </div>

        {/* Card 2: Upload da Planilha Principal (Entrega de Apostilas) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-2">
              2. Planilha Principal (.xls, .xlsx, .csv)
            </label>
            <div className="border-2 border-dashed border-slate-300 hover:border-[#0f3b7d] rounded-xl p-4 text-center cursor-pointer transition-colors relative bg-slate-50/50">
              <input
                type="file"
                accept=".xls,.xlsx,.csv,.txt"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <div className="flex flex-col items-center justify-center gap-1.5">
                <div className="w-9 h-9 rounded-full bg-blue-50 text-[#0f3b7d] flex items-center justify-center">
                  <Upload className="w-4 h-4" />
                </div>
                <p className="text-xs font-semibold text-slate-700">
                  {fileName ? (
                    <span className="text-[#0f3b7d] font-bold">{fileName}</span>
                  ) : (
                    'Arraste o relatório de entrega aqui'
                  )}
                </p>
                <p className="text-[10px] text-slate-400">
                  Entrega de Apostilas
                </p>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-2">
            * Arquivo principal que define os alunos e as apostilas a pedir.
          </p>
        </div>

        {/* Card 3: Planilha Complementar - Controle Pedagógico (Opcional - Próxima Matéria, Turma e Horário) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[#0f3b7d] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#0f3b7d]" />
                3. Controle Pedagógico (Opcional)
              </label>
            </div>

            {controlePedagogico ? (
              <div className="bg-sky-50/60 border border-sky-200 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#0f3b7d]" />
                    <span className="text-xs font-bold text-slate-800 truncate max-w-[130px]" title={controlePedagogicoFileName}>
                      {controlePedagogicoFileName}
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-[#0f3b7d]">
                    {controlePedagogico.totalRows} alunos
                  </span>
                </div>
                <p className="text-[10px] text-slate-600">
                  Próxima matéria, horários e turmas integrados
                </p>

                <div className="pt-1 flex items-center justify-between">
                  <label className="text-[11px] text-[#0f3b7d] hover:underline font-bold cursor-pointer flex items-center gap-1.5">
                    <RefreshCw className="w-3 h-3 text-[#0f3b7d]" />
                    <span>Atualizar planilha</span>
                    <input
                      type="file"
                      accept=".xls,.xlsx,.csv,.txt"
                      onChange={handleControlePedagogicoUpload}
                      className="hidden"
                    />
                  </label>
                  <span className="text-[10px] text-slate-400">Cruzamento ativo</span>
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-sky-200 hover:border-[#0f3b7d] rounded-xl p-4 text-center cursor-pointer transition-colors relative bg-sky-50/30">
                <input
                  type="file"
                  accept=".xls,.xlsx,.csv,.txt"
                  onChange={handleControlePedagogicoUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <div className="flex flex-col items-center justify-center gap-1">
                  <Clock className="w-5 h-5 text-sky-600" />
                  <p className="text-xs font-semibold text-slate-700">
                    {isProcessingControlePedagogico ? 'Processando...' : 'Carregar Controle Pedagógico'}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Opcional: Próxima Matéria, Turma e Horário
                  </p>
                </div>
              </div>
            )}
          </div>

          <p className="text-[10px] text-slate-400 mt-2">
            * Consulta horários de aula, turmas e próxima matéria de cada aluno.
          </p>
        </div>

        {/* Card 4: Planilha Complementar - Base de Contratos (Aluno x Educador) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[#0f3b7d] flex items-center gap-1.5">
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#0f3b7d]" />
                4. Base de Contratos (Complementar)
              </label>
            </div>

            {baseContratos ? (
              <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-[#0f3b7d]" />
                    <span className="text-xs font-bold text-slate-800 truncate max-w-[130px]" title={baseContratosFileName}>
                      {baseContratosFileName}
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-[#0f3b7d]">
                    {baseContratos.totalRows} contratos
                  </span>
                </div>
                <p className="text-[10px] text-slate-600 line-clamp-1">
                  Educadores: {baseContratos.educators.join(', ')}
                </p>

                <div className="pt-1 flex items-center justify-between">
                  <label className="text-[11px] text-[#0f3b7d] hover:underline font-bold cursor-pointer flex items-center gap-1.5">
                    <RefreshCw className="w-3 h-3 text-[#0f3b7d]" />
                    <span>Atualizar planilha</span>
                    <input
                      type="file"
                      accept=".xls,.xlsx"
                      onChange={handleBaseContratosUpload}
                      className="hidden"
                    />
                  </label>
                  <span className="text-[10px] text-slate-400">Cruzamento automático</span>
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-indigo-200 hover:border-[#0f3b7d] rounded-xl p-4 text-center cursor-pointer transition-colors relative bg-indigo-50/30">
                <input
                  type="file"
                  accept=".xls,.xlsx"
                  onChange={handleBaseContratosUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <div className="flex flex-col items-center justify-center gap-1">
                  <Users className="w-5 h-5 text-indigo-600" />
                  <p className="text-xs font-semibold text-slate-700">
                    {isProcessingBaseContratos ? 'Processando...' : 'Carregar Análise Base de Contratos'}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Cruza automaticamente Aluno x Educador
                  </p>
                </div>
              </div>
            )}
          </div>

          <p className="text-[10px] text-slate-400 mt-2">
            * Vincula cada aluno ao seu respectivo educador pelo número de contrato e nome.
          </p>
        </div>
      </div>

      {/* Seletor Geral de Educador & Informações de Regras */}
      {items.length > 0 && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-end">
            {/* Educador Global (Override opcional) */}
            <div className="md:col-span-5" ref={educatorDropdownRef}>
              <label className="block text-xs font-bold text-[#0f3b7d] mb-1.5 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4" />
                Sobrescrever Educador de Toda a Lista (Opcional)
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setIsEducatorDropdownOpen((prev) => !prev);
                    setEducatorSearch('');
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-left text-xs font-semibold transition-all ${
                    selectedEducator
                      ? 'border-[#0f3b7d] bg-blue-50/40 text-slate-900 shadow-sm'
                      : 'border-slate-300 bg-white text-slate-500 hover:border-slate-400'
                  }`}
                >
                  <span className="truncate">
                    {selectedEducator || 'Usar educadores individuais cruzados na lista'}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform ${
                      isEducatorDropdownOpen ? 'rotate-180 text-[#0f3b7d]' : ''
                    }`}
                  />
                </button>

                {isEducatorDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-xl border border-slate-200 shadow-2xl z-50 py-2 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                    {educators.length > 4 && (
                      <div className="px-3 pb-2 border-b border-slate-100">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                          <input
                            type="text"
                            autoComplete="off"
                            value={educatorSearch}
                            onChange={(e) => setEducatorSearch(e.target.value)}
                            placeholder="Buscar educador..."
                            className="w-full pl-8 pr-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0f3b7d]"
                          />
                        </div>
                      </div>
                    )}

                    <div className="max-h-56 overflow-y-auto divide-y divide-slate-50">
                      {selectedEducator && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedEducator('');
                            setIsEducatorDropdownOpen(false);
                          }}
                          className="w-full flex items-center px-3.5 py-2 text-xs text-left text-slate-500 hover:bg-slate-50 italic"
                        >
                          Limpar (usar educadores individuais cruzados)
                        </button>
                      )}
                      {filteredEducators.length === 0 ? (
                        <div className="px-4 py-3 text-slate-400 text-xs italic text-center">
                          Nenhum educador encontrado
                        </div>
                      ) : (
                        filteredEducators.map((ed) => {
                          const isSelected = selectedEducator === ed.name;
                          return (
                            <button
                              key={ed.id}
                              type="button"
                              onClick={() => {
                                setSelectedEducator(ed.name);
                                setIsEducatorDropdownOpen(false);
                              }}
                              className={`w-full flex items-center justify-between px-3.5 py-2 text-xs text-left transition-colors ${
                                isSelected
                                  ? 'bg-blue-50 text-[#0f3b7d] font-bold'
                                  : 'text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <span>{ed.name}</span>
                              {isSelected && (
                                <Check className="w-3.5 h-3.5 text-[#0f3b7d] shrink-0" />
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Deixe vazio para manter o educador de cada aluno identificado pela Base de Contratos.
              </p>
            </div>

            {/* Info sobre filtros aplicados */}
            <div className="md:col-span-7 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
              <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-md border border-slate-200">
                <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                <span>Matérias excluídas:</span>
                <strong className="text-slate-700">{ignoredSubjects.join(', ') || 'Nenhuma'}</strong>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-md border border-slate-200">
                <Ban className="w-3.5 h-3.5 text-red-500" />
                <span>Contratos excluídos:</span>
                <strong className="text-slate-700">{excludedContractTypes.join(', ') || 'Nenhum'}</strong>
              </div>
              {crossedEducatorsCount > 0 && (
                <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-md border border-slate-200 text-slate-700 font-medium">
                  <Users className="w-3.5 h-3.5 text-slate-500" />
                  <span>Educadores identificados:</span>
                  <strong>{crossedEducatorsCount} de {items.length} alunos</strong>
                </div>
              )}
              {matchedPedagogicalCount > 0 && (
                <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-md border border-slate-200 text-slate-700 font-medium">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Horários & Próxima Matéria:</span>
                  <strong>{matchedPedagogicalCount} de {items.length} alunos</strong>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ETAPA 3: Inspeção, Curadoria e Separação por Educador */}
      {items.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-6">
          {/* Barra Superior: Faixa de Aulas, Busca e Resumos */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5" /> Faixa de Aulas:
              </span>

              <div className="flex items-center gap-1.5 text-xs">
                <input
                  type="number"
                  value={lessonMin}
                  disabled={allLessons}
                  onChange={(e) => handleApplyFilter(Number(e.target.value), lessonMax, allLessons)}
                  className="w-14 px-2 py-1 border border-slate-300 rounded text-center text-xs"
                />
                <span className="text-slate-400">até</span>
                <input
                  type="number"
                  value={lessonMax}
                  disabled={allLessons}
                  onChange={(e) => handleApplyFilter(lessonMin, Number(e.target.value), allLessons)}
                  className="w-14 px-2 py-1 border border-slate-300 rounded text-center text-xs"
                />
              </div>

              <button
                type="button"
                onClick={() => handleApplyFilter(lessonMin, lessonMax, !allLessons)}
                className={`px-3 py-1 rounded text-xs font-semibold border transition-colors flex items-center gap-1.5 ${
                  allLessons
                    ? 'bg-[#0f3b7d] text-white border-[#0f3b7d]'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {allLessons && <Check className="w-3.5 h-3.5" />}
                <span>Todas as Aulas</span>
              </button>
            </div>

            {/* Ações Rápidas: Editar Pedido & Busca Rápida */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleEditInManualOrder}
                className="px-3 py-1.5 rounded-lg border border-[#0f3b7d] bg-blue-50/70 text-[#0f3b7d] hover:bg-[#0f3b7d] hover:text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-xs"
                title="Editar este pedido na tela de Pedido Manual"
              >
                <PenLine className="w-3.5 h-3.5" />
                <span>Editar Pedido</span>
              </button>

              <div className="relative w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filtrar aluno, matéria ou educador..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0f3b7d]"
                />
              </div>
            </div>
          </div>

          {/* Abas de Filtragem Rápida por Educador (Separação Rápida de Pedidos) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#0f3b7d]" />
                Filtrar Pedido por Educador:
              </span>
              {filterEducator !== 'all' && (
                <button
                  type="button"
                  onClick={() => setFilterEducator('all')}
                  className="text-[11px] text-[#0f3b7d] hover:underline font-semibold"
                >
                  Mostrar todos os educadores ({items.length})
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Botão Todos */}
              <button
                type="button"
                onClick={() => setFilterEducator('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  filterEducator === 'all'
                    ? 'bg-[#0f3b7d] text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>Todos</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    filterEducator === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {items.length}
                </span>
              </button>

              {/* Botões individuais por educador */}
              {distinctEducatorsWithCounts.map(([educatorName, count]) => {
                const isSelected = filterEducator === educatorName;
                const isUnassigned = educatorName === 'Sem Educador';

                return (
                  <button
                    key={educatorName}
                    type="button"
                    onClick={() => setFilterEducator(isUnassigned ? '__unassigned__' : educatorName)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      (isUnassigned && filterEducator === '__unassigned__') || isSelected
                        ? 'bg-[#0f3b7d] text-white shadow-sm'
                        : isUnassigned
                        ? 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <span>{educatorName}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        (isUnassigned && filterEducator === '__unassigned__') || isSelected
                          ? 'bg-white/20 text-white'
                          : isUnassigned
                          ? 'bg-amber-200 text-amber-900'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Banner de Separação Ativa por Educador */}
          {filterEducator !== 'all' && filterEducator !== '__unassigned__' && (
            <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-150">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-[#0f3b7d] shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-[#0f3b7d]">
                    Visualizando pedido exclusivo de: {filterEducator}
                  </h4>
                  <p className="text-[11px] text-slate-600">
                    Você pode finalizar apenas as <strong>{visibleItems.length} apostilas</strong> deste educador para gerar a ordem separada.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleFinalizeOrder(true)}
                  disabled={isSaving || visibleItems.length === 0}
                  className="inline-flex items-center gap-1.5 bg-[#0f3b7d] hover:bg-[#0a2e68] text-white px-3.5 py-1.5 rounded-lg font-bold text-xs shadow-sm transition-all disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Finalizar Apenas {filterEducator.split(' ')[0]} ({visibleItems.length})</span>
                </button>
              </div>
            </div>
          )}

          {/* Alertas de Duplicidade */}
          <div className="flex flex-wrap gap-3">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 text-[#0f3b7d] text-xs font-semibold border border-blue-100">
              <span>Exibindo:</span>
              <span className="bg-white px-2 py-0.5 rounded font-bold shadow-xs">
                {visibleItems.length} {visibleItems.length === 1 ? 'aluno' : 'alunos'}
              </span>
              {filterEducator !== 'all' && (
                <span className="text-slate-500 font-normal">
                  (de {items.length} totais)
                </span>
              )}
            </div>

            {internalDuplicatesCount > 0 && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-800 text-xs font-semibold border border-amber-200">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Duplicidade Interna: {internalDuplicatesCount} itens repetidos na lista</span>
              </div>
            )}

            {historicalDuplicatesCount > 0 && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#fce8e6] text-[#c5221f] text-xs font-semibold border border-red-200">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Duplicidade Histórica: {historicalDuplicatesCount} itens já entregues em pedidos passados</span>
              </div>
            )}
          </div>

          {/* Tabela de Inspeção com Ordenação e Filtro nos Rótulos de Colunas */}
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider select-none">
                <tr>
                  <th
                    className="py-2.5 px-3 cursor-pointer hover:bg-slate-100 transition-colors w-12"
                    onClick={() => handleSort('index')}
                  >
                    <div className="flex items-center gap-1">
                      <span>#</span>
                      {sortField === 'index' && (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-[#0f3b7d]" /> : <ArrowDown className="w-3 h-3 text-[#0f3b7d]" />
                      )}
                    </div>
                  </th>

                  <th
                    className="py-2.5 px-3 cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort('studentName')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Aluno</span>
                      {sortField === 'studentName' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-[#0f3b7d]" /> : <ArrowDown className="w-3 h-3 text-[#0f3b7d]" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                      )}
                    </div>
                  </th>

                  <th
                    className="py-2.5 px-3 cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort('subjectName')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Matéria Higienizada</span>
                      {sortField === 'subjectName' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-[#0f3b7d]" /> : <ArrowDown className="w-3 h-3 text-[#0f3b7d]" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                      )}
                    </div>
                  </th>

                  {/* Coluna Educador com Filtro de Rótulo (Dropdown Excel) */}
                  <th className="py-2.5 px-3 relative" ref={educatorFilterMenuRef}>
                    <div className="flex items-center justify-between gap-1">
                      <div
                        className="flex items-center gap-1.5 cursor-pointer hover:text-[#0f3b7d] transition-colors"
                        onClick={() => handleSort('educatorName')}
                      >
                        <span>Educador</span>
                        {sortField === 'educatorName' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-[#0f3b7d]" /> : <ArrowDown className="w-3 h-3 text-[#0f3b7d]" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                        )}
                      </div>

                      {/* Botão de Filtro no Rótulo */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsEducatorFilterMenuOpen((prev) => !prev);
                        }}
                        className={`p-1 rounded transition-colors ${
                          filterEducator !== 'all'
                            ? 'bg-[#0f3b7d] text-white shadow-xs'
                            : 'text-slate-400 hover:text-slate-700 hover:bg-slate-200'
                        }`}
                        title="Filtrar por Educador específico"
                      >
                        <Filter className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Menu Suspenso de Filtro na Coluna (Estilo Excel) */}
                    {isEducatorFilterMenuOpen && (
                      <div className="absolute left-0 top-full mt-1 w-64 bg-white rounded-xl border border-slate-200 shadow-2xl z-50 py-2 overflow-hidden normal-case font-normal animate-in fade-in duration-100">
                        <div className="px-3 pb-2 border-b border-slate-100">
                          <span className="text-[11px] font-bold text-slate-700 block mb-1">
                            Filtrar por Educador:
                          </span>
                          <div className="relative">
                            <Search className="w-3 h-3 absolute left-2 top-2 text-slate-400" />
                            <input
                              type="text"
                              value={educatorFilterSearch}
                              onChange={(e) => setEducatorFilterSearch(e.target.value)}
                              placeholder="Buscar educador..."
                              className="w-full pl-7 pr-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-[#0f3b7d]"
                            />
                          </div>
                        </div>

                        <div className="max-h-52 overflow-y-auto divide-y divide-slate-50 text-xs">
                          {/* Opção Todos */}
                          <button
                            type="button"
                            onClick={() => {
                              setFilterEducator('all');
                              setIsEducatorFilterMenuOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors ${
                              filterEducator === 'all'
                                ? 'bg-blue-50 text-[#0f3b7d] font-bold'
                                : 'text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <span>(Todos os Educadores)</span>
                            <span className="text-[11px] text-slate-400">{items.length}</span>
                          </button>

                          {/* Lista de Educadores presentes */}
                          {distinctEducatorsWithCounts
                            .filter(([name]) =>
                              name.toLowerCase().includes(educatorFilterSearch.toLowerCase())
                            )
                            .map(([name, count]) => {
                              const isSelected =
                                (name === 'Sem Educador' && filterEducator === '__unassigned__') ||
                                filterEducator === name;

                              return (
                                <button
                                  key={name}
                                  type="button"
                                  onClick={() => {
                                    setFilterEducator(name === 'Sem Educador' ? '__unassigned__' : name);
                                    setIsEducatorFilterMenuOpen(false);
                                  }}
                                  className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors ${
                                    isSelected
                                      ? 'bg-blue-50 text-[#0f3b7d] font-bold'
                                      : 'text-slate-700 hover:bg-slate-50'
                                  }`}
                                >
                                  <span className="truncate pr-2">{name}</span>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">
                                      {count}
                                    </span>
                                    {isSelected && <Check className="w-3.5 h-3.5 text-[#0f3b7d]" />}
                                  </div>
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </th>

                  <th
                    className="py-2.5 px-3 text-center cursor-pointer hover:bg-slate-100 transition-colors w-16"
                    onClick={() => handleSort('currentLesson')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Aula</span>
                      {sortField === 'currentLesson' && (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-[#0f3b7d]" /> : <ArrowDown className="w-3 h-3 text-[#0f3b7d]" />
                      )}
                    </div>
                  </th>

                  <th
                    className="py-2.5 px-3 cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort('classSchedule')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Turma / Horário</span>
                      {sortField === 'classSchedule' && (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-[#0f3b7d]" /> : <ArrowDown className="w-3 h-3 text-[#0f3b7d]" />
                      )}
                    </div>
                  </th>

                  <th className="py-2.5 px-3">Próxima Matéria</th>
                  <th className="py-2.5 px-3 text-center w-20">Avisos</th>
                  <th className="py-2.5 px-3 text-right w-16">Ação</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {visibleItems.map((item, idx) => {
                  const hasWarning = item.isInternalDuplicate || item.isHistoricalDuplicate;
                  const itemEducator = selectedEducator || item.educatorName;

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        item.isHistoricalDuplicate
                          ? 'bg-[#fce8e6]/40'
                          : item.isInternalDuplicate
                          ? 'bg-amber-50/40'
                          : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{item.studentName}</td>
                      <td className="py-2.5 px-3 text-slate-800 font-medium">
                        {item.subjectName}
                        {item.rawSubjectName !== item.subjectName && (
                          <span className="block text-[10px] text-slate-400">
                            Origem: {item.rawSubjectName}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        {itemEducator ? (
                          <span className="font-semibold text-slate-800">
                            {itemEducator}
                          </span>
                        ) : (
                          <span className="text-amber-600 italic text-[11px]">Não identificado</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-[#0f3b7d]">
                        {item.currentLesson}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {item.classSchedule || (item.scheduledDay ? `${item.scheduledDay}` : '—')}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">{item.nextSubject || '—'}</td>
                      <td className="py-2.5 px-3 text-center">
                        {item.isHistoricalDuplicate && (
                          <span
                            title={`Já entregue no pedido: ${item.historicalMatchOrderTitle}`}
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#fce8e6] text-[#c5221f] border border-red-300"
                          >
                            Histórico
                          </span>
                        )}
                        {item.isInternalDuplicate && (
                          <span
                            title="Aluno repetido mais de uma vez nesta folha"
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 ml-1"
                          >
                            Repetido
                          </span>
                        )}
                        {!hasWarning && <Check className="w-4 h-4 text-emerald-600 inline-block" />}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-slate-400 hover:text-red-600 p-1 rounded transition-colors"
                          title="Excluir este aluno do pedido"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Barra de Finalização e Separação de Pedidos */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100">
            <div className="text-xs text-slate-500">
              Total na visualização:{' '}
              <strong className="text-slate-900">{visibleItems.length} apostilas</strong>
              {items.length !== visibleItems.length && (
                <span className="text-slate-400 ml-1">
                  (de {items.length} totais na planilha)
                </span>
              )}
              {filterEducator !== 'all' && filterEducator !== '__unassigned__' && (
                <span className="ml-2 bg-blue-50 text-[#0f3b7d] px-2 py-0.5 rounded font-semibold border border-blue-200">
                  Educador: {filterEducator}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Botão de Descartar Rascunho */}
              <button
                type="button"
                onClick={handleClearDraft}
                className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-300 text-slate-600 hover:text-red-600 hover:border-red-300 hover:bg-red-50 text-xs font-semibold transition-colors"
                title="Descartar importação atual e reiniciar"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Descartar</span>
              </button>

              {/* Botão para Editar Pedido no Pedido Manual */}
              <button
                type="button"
                onClick={handleEditInManualOrder}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[#0f3b7d] bg-white text-[#0f3b7d] font-bold text-xs hover:bg-blue-50 transition-all shadow-xs"
                title="Editar este pedido na tela de Pedido Manual"
              >
                <PenLine className="w-4 h-4 text-[#0f3b7d]" />
                <span>Editar Pedido</span>
              </button>

              {/* Botão de Finalizar apenas o Educador Filtrado */}
              {filterEducator !== 'all' && filterEducator !== '__unassigned__' && (
                <button
                  type="button"
                  disabled={isSaving || visibleItems.length === 0}
                  onClick={() => handleFinalizeOrder(true)}
                  className="inline-flex items-center gap-2 bg-[#0f3b7d] hover:bg-[#0a2e68] text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>
                    {isSaving
                      ? 'Gravando...'
                      : `Finalizar Pedido de ${filterEducator.split(' ')[0]} (${visibleItems.length} apostilas)`}
                  </span>
                </button>
              )}

              {/* Botão de Finalizar Todo o Pedido Geral */}
              <button
                type="button"
                disabled={isSaving || items.length === 0}
                onClick={() => handleFinalizeOrder(false)}
                className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all disabled:opacity-50 ${
                  filterEducator !== 'all' && filterEducator !== '__unassigned__'
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                    : 'bg-[#0f3b7d] hover:bg-[#0a2e68] text-white'
                }`}
              >
                <Save className="w-4 h-4" />
                <span>
                  {isSaving
                    ? 'Gravando no Supabase...'
                    : `Finalizar Todas as Apostilas (${items.length})`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
