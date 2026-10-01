'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ClipboardList,
  Plus,
  Trash2,
  Save,
  AlertTriangle,
  Calendar,
  ArrowRight,
  ClipboardPaste,
  X,
  History,
  Lock,
  UserCheck,
  ChevronDown,
  Check,
  Search,
  Loader2,
  RotateCcw,
  Pencil
} from 'lucide-react';
import { supabase } from '../../lib/supabase/client';
import { cleanSubject, normalizeText, formatOrderTitle, toFirstName } from '../../lib/domain/sanitizer';
import { createDuplicateFingerprint } from '../../lib/domain/duplicates';
import { useDialog } from '../../components/ui/dialog';
import { Educator } from '../../types';

interface ManualRow {
  id: string;
  studentName: string;
  subjectName: string;
  educatorName?: string;
}

interface HistoricalEntry {
  orderId: string;
  orderTitle: string;
  educatorName?: string | null;
}

const DEFAULT_ROW = (): ManualRow => ({
  id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
  studentName: '',
  subjectName: '',
  educatorName: '',
});

function NovoPedidoManualContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editOrderId = searchParams.get('edit');
  const { showAlert, showConfirm, showToast } = useDialog();

  // Dados do Cabeçalho do Pedido (sem campo manual de Nº da Ordem)
  const [title, setTitle] = useState('ENTREGA DE MATERIAL - HISTÓRICO');
  const [competenceMonth, setCompetenceMonth] = useState(new Date().getMonth() + 1);
  const [competenceYear, setCompetenceYear] = useState(new Date().getFullYear());
  
  // Modo de edição (quando carregado via ?edit=ID)
  const [isEditMode, setIsEditMode] = useState<boolean>(() => Boolean(editOrderId));
  const [editingOrderId, setEditingOrderId] = useState<string | null>(() => editOrderId || null);
  const [isLoadingEdit, setIsLoadingEdit] = useState(false);

  // Modo vindo de importação ou rascunho persistido
  const [isFromImport, setIsFromImport] = useState(false);
  const [importedFileName, setImportedFileName] = useState('');
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);

  // Educador único por lista (sem preenchimento automático)
  const [selectedEducator, setSelectedEducator] = useState('');
  const [educators, setEducators] = useState<Educator[]>([]);
  const [showEducatorColumn, setShowEducatorColumn] = useState(false);
  const [isEducatorDropdownOpen, setIsEducatorDropdownOpen] = useState(false);
  const [educatorSearch, setEducatorSearch] = useState('');
  const educatorDropdownRef = useRef<HTMLDivElement | null>(null);

  // Linhas da Tabela (apenas Aluno e Matéria)
  const [rows, setRows] = useState<ManualRow[]>([
    DEFAULT_ROW(),
    DEFAULT_ROW(),
    DEFAULT_ROW(),
    DEFAULT_ROW(),
    DEFAULT_ROW(),
  ]);

  // Mapa de duplicidades históricas: fingerprint -> HistoricalEntry[]
  const [historicalMap, setHistoricalMap] = useState<Map<string, HistoricalEntry[]>>(new Map());

  // Estado do Modal de Colagem Rápida
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteContent, setPasteContent] = useState('');

  // Loading & Salvamento
  const [isSaving, setIsSaving] = useState(false);
  const isCancellingRef = useRef(false);
  const isSavingRef = useRef(false);

  // Referência para focar no novo input criado
  const lastRowInputRef = useRef<HTMLInputElement | null>(null);

  // Fecha dropdown do educador ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        educatorDropdownRef.current &&
        !educatorDropdownRef.current.contains(event.target as Node)
      ) {
        setIsEducatorDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Carrega educadores ativos e histórico (sem auto-preencher educador)
  const loadInitialData = async () => {
    try {
      // 1. Busca educadores ativos
      const { data: edData } = await supabase
        .from('educators')
        .select('*')
        .eq('active', true)
        .order('name');

      if (edData && edData.length > 0) {
        setEducators(edData);
        // IMPORTANTE: NÃO preenche automaticamente o educador para forçar a escolha consciente do operador
      }

      // 2. Busca itens já cadastrados no histórico para aviso de duplicidades
      const { data: existingItems } = await supabase
        .from('order_items')
        .select('duplicate_fingerprint, educator_name, order_id, orders(title)');

      if (existingItems) {
        const hist = new Map<string, HistoricalEntry[]>();
        existingItems.forEach((item: any) => {
          if (item.duplicate_fingerprint) {
            const list = hist.get(item.duplicate_fingerprint) || [];
            list.push({
              orderId: item.order_id,
              orderTitle: item.orders?.title || 'Pedido Anterior',
              educatorName: item.educator_name || null,
            });
            hist.set(item.duplicate_fingerprint, list);
          }
        });
        setHistoricalMap(hist);
      }
    } catch (err) {
      console.warn('Erro ao carregar dados iniciais:', err);
    }
  };

  // Carrega dados de um pedido existente para edição
  const loadOrderForEdit = async (orderId: string) => {
    try {
      setIsLoadingEdit(true);

      // 1. Carrega o pedido
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (orderErr || !order) {
        showAlert('Pedido não encontrado para edição (pode ter sido excluído no Histórico).', 'error', 'Erro');
        setIsEditMode(false);
        setEditingOrderId(null);
        router.push('/historico');
        return;
      }

      // 2. Carrega os itens do pedido
      const { data: items, error: itemsErr } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId)
        .order('source_row', { ascending: true });

      if (itemsErr) throw itemsErr;

      // 3. Preenche os campos
      setTitle(order.title);
      setCompetenceMonth(order.competence_month);
      setCompetenceYear(order.competence_year);
      setIsEditMode(true);
      setEditingOrderId(orderId);

      if (items && items.length > 0) {
        // Identifica o educador predominante
        const educatorCounts = new Map<string, number>();
        items.forEach((item) => {
          if (item.educator_name) {
            const fn = toFirstName(item.educator_name);
            educatorCounts.set(fn, (educatorCounts.get(fn) || 0) + 1);
          }
        });

        let dominantEducator = '';
        let maxCount = 0;
        educatorCounts.forEach((count, name) => {
          if (count > maxCount) {
            maxCount = count;
            dominantEducator = name;
          }
        });
        setSelectedEducator(dominantEducator);

        // Carrega linhas
        const loadedRows: ManualRow[] = items.map((item) => ({
          id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
          studentName: item.student_name,
          subjectName: item.subject_name,
          educatorName: toFirstName(item.educator_name),
        }));

        setRows(loadedRows);
      }

      showToast(`Pedido "${order.title}" carregado para edição.`, 'info');
    } catch (err: any) {
      console.error('Erro ao carregar pedido para edição:', err);
      showAlert(`Erro ao carregar pedido: ${err.message}`, 'error', 'Falha');
    } finally {
      setIsLoadingEdit(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Carrega pedido para edição quando o parâmetro edit= está presente ou limpa estado se ausente
  useEffect(() => {
    if (editOrderId) {
      isCancellingRef.current = false;
      loadOrderForEdit(editOrderId);
    } else {
      isCancellingRef.current = false;
      setIsEditMode(false);
      setEditingOrderId(null);

      // Carrega rascunho de pedido manual (apenas se for novo pedido legítimo)
      try {
        const saved = localStorage.getItem('microlins_draft_pedido_manual');
        if (saved) {
          const draft = JSON.parse(saved);
          // Se o rascunho pertencia ao modo de edição de um pedido anterior, descarta-o
          if (draft.isEditMode || draft.editingOrderId) {
            localStorage.removeItem('microlins_draft_pedido_manual');
            setRows([DEFAULT_ROW(), DEFAULT_ROW(), DEFAULT_ROW(), DEFAULT_ROW(), DEFAULT_ROW()]);
            setTitle('ENTREGA DE MATERIAL - HISTÓRICO');
            setSelectedEducator('');
            return;
          }
          if (draft.rows && draft.rows.length > 0) {
            const sanitizedRows = draft.rows.map((r: any) => ({
              ...r,
              educatorName: toFirstName(r.educatorName),
            }));
            setRows(sanitizedRows);
            if (draft.title) setTitle(draft.title);
            if (draft.competenceMonth) setCompetenceMonth(draft.competenceMonth);
            if (draft.competenceYear) setCompetenceYear(draft.competenceYear);
            if (draft.selectedEducator) setSelectedEducator(toFirstName(draft.selectedEducator));
            if (draft.source === 'imported_from_nova_ordem') {
              setIsFromImport(true);
              setImportedFileName(draft.importedFileName || '');
            }
            setHasRestoredDraft(true);
            return;
          }
        }
      } catch (e) {
        console.warn('Erro ao restaurar rascunho de pedido manual:', e);
      }

      // Se não havia rascunho, garante formulário limpo
      setTitle('ENTREGA DE MATERIAL - HISTÓRICO');
      setSelectedEducator('');
      setShowEducatorColumn(false);
      setHasRestoredDraft(false);
      setRows([
        DEFAULT_ROW(),
        DEFAULT_ROW(),
        DEFAULT_ROW(),
        DEFAULT_ROW(),
        DEFAULT_ROW(),
      ]);
    }
  }, [editOrderId]);

  // Persiste rascunho no localStorage para evitar perda de dados ao navegar entre telas
  useEffect(() => {
    if (isLoadingEdit || isCancellingRef.current || isSavingRef.current) return;

    // Se estiver em modo de edição, grava exclusivamente na chave isolada do pedido em edição
    if (isEditMode || editingOrderId) {
      if (!editingOrderId) return;
      const hasFilled = rows.some((r) => r.studentName.trim() || r.subjectName.trim() || r.educatorName?.trim());
      if (hasFilled) {
        try {
          const draft = {
            title,
            competenceMonth,
            competenceYear,
            selectedEducator,
            rows,
            isEditMode: true,
            editingOrderId,
          };
          localStorage.setItem(`microlins_draft_edit_${editingOrderId}`, JSON.stringify(draft));
        } catch (e) {
          console.warn('Falha ao salvar rascunho de edição:', e);
        }
      }
      return;
    }

    // Apenas novos pedidos manuais são salvos na chave geral microlins_draft_pedido_manual
    const hasFilled = rows.some((r) => r.studentName.trim() || r.subjectName.trim() || r.educatorName?.trim());
    if (hasFilled) {
      try {
        const draft = {
          title,
          competenceMonth,
          competenceYear,
          selectedEducator,
          rows,
          isEditMode: false,
          editingOrderId: null,
          source: isFromImport ? 'imported_from_nova_ordem' : 'manual_entry',
          importedFileName,
        };
        localStorage.setItem('microlins_draft_pedido_manual', JSON.stringify(draft));
      } catch (e) {
        console.warn('Falha ao salvar rascunho manual:', e);
      }
    }
  }, [
    rows,
    title,
    competenceMonth,
    competenceYear,
    selectedEducator,
    isEditMode,
    editingOrderId,
    isFromImport,
    importedFileName,
    isLoadingEdit,
  ]);

  // Cancela a edição do pedido existente e retorna ao Histórico
  const handleCancelEdit = () => {
    isCancellingRef.current = true;
    try {
      localStorage.removeItem('microlins_draft_pedido_manual');
      if (editingOrderId) {
        localStorage.removeItem(`microlins_draft_edit_${editingOrderId}`);
      }
      if (isFromImport) {
        localStorage.removeItem('microlins_draft_nova_ordem');
      }
    } catch {}
    setIsEditMode(false);
    setEditingOrderId(null);
    setTitle('ENTREGA DE MATERIAL - HISTÓRICO');
    setSelectedEducator('');
    setShowEducatorColumn(false);
    setHasRestoredDraft(false);
    setRows([
      DEFAULT_ROW(),
      DEFAULT_ROW(),
      DEFAULT_ROW(),
      DEFAULT_ROW(),
      DEFAULT_ROW(),
    ]);
    showToast('Edição cancelada.', 'info');
    router.push('/historico');
  };

  // Descarta o rascunho atual e reinicia o formulário
  const handleClearManualDraft = () => {
    showConfirm({
      title: 'Limpar Formulário',
      message: 'Deseja limpar todos os dados preenchidos deste formulário?',
      confirmText: 'Sim, limpar',
      cancelText: 'Cancelar',
      type: 'warning',
      onConfirm: () => {
        isCancellingRef.current = true;
        try {
          localStorage.removeItem('microlins_draft_pedido_manual');
          if (editingOrderId) {
            localStorage.removeItem(`microlins_draft_edit_${editingOrderId}`);
          }
          if (isFromImport) {
            localStorage.removeItem('microlins_draft_nova_ordem');
          }
          setIsFromImport(false);
          setImportedFileName('');
          setIsEditMode(false);
          setEditingOrderId(null);
          setTitle('ENTREGA DE MATERIAL - HISTÓRICO');
          setSelectedEducator('');
          setShowEducatorColumn(false);
          setHasRestoredDraft(false);
          setRows([
            DEFAULT_ROW(),
            DEFAULT_ROW(),
            DEFAULT_ROW(),
            DEFAULT_ROW(),
            DEFAULT_ROW(),
          ]);
          if (editOrderId) {
            router.push('/novo-pedido-manual');
          }
          showToast('Formulário limpo com sucesso.', 'info');
        } catch {}
      },
    });
  };

  // Seleciona educador do cabeçalho da lista e replica para as linhas
  const handleSelectHeaderEducator = (name: string) => {
    const clean = toFirstName(name);
    setSelectedEducator(clean);
    setIsEducatorDropdownOpen(false);
    // Se a coluna de educador por linha não estiver ativada, replica para todas as linhas
    if (!showEducatorColumn) {
      setRows((prev) => prev.map((r) => ({ ...r, educatorName: clean })));
    }
  };

  // Adiciona linha
  const handleAddRow = () => {
    setRows((prev) => [...prev, DEFAULT_ROW()]);
    setTimeout(() => {
      if (lastRowInputRef.current) {
        lastRowInputRef.current.focus();
      }
    }, 50);
  };

  // Adiciona múltiplas linhas vazias
  const handleAddMultipleRows = (count: number) => {
    const newItems: ManualRow[] = [];
    for (let i = 0; i < count; i++) {
      newItems.push(DEFAULT_ROW());
    }
    setRows((prev) => [...prev, ...newItems]);
  };

  // Remove linha individual
  const handleRemoveRow = (id: string) => {
    if (rows.length <= 1) {
      setRows([DEFAULT_ROW()]);
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  // Limpa linhas em branco
  const handleCleanEmptyRows = () => {
    const filled = rows.filter((r) => r.studentName.trim() || r.subjectName.trim());
    if (filled.length === 0) {
      setRows([DEFAULT_ROW()]);
      showToast('Nenhuma linha preenchida encontrada.', 'info');
    } else {
      setRows(filled);
      showToast(`${rows.length - filled.length} linhas vazias removidas.`, 'info');
    }
  };

  // Atualiza campo de uma linha sem truncar espaços durante a digitação
  const handleRowChange = (id: string, field: 'studentName' | 'subjectName' | 'educatorName', value: string) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const val = field === 'educatorName' ? toFirstName(value) : value;
        return { ...row, [field]: val };
      })
    );
  };

  // Higieniza matéria somente ao sair do campo (onBlur) para não travar a digitação de espaços
  const handleSubjectBlur = (id: string, value: string) => {
    const cleaned = cleanSubject(value);
    if (cleaned !== value) {
      handleRowChange(id, 'subjectName', cleaned);
    }
  };

  // Atalho Enter para ir direto para a próxima linha
  const handleSubjectKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (index === rows.length - 1) {
        handleAddRow();
      } else {
        const nextInput = document.getElementById(`student-input-${index + 1}`) as HTMLInputElement | null;
        if (nextInput) nextInput.focus();
      }
    }
  };

  // Atalho Enter no campo Aluno move para o campo Matéria da mesma linha
  const handleStudentKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const subjectInput = document.getElementById(`subject-input-${index}`) as HTMLInputElement | null;
      if (subjectInput) subjectInput.focus();
    }
  };

  // Processa colagem de texto/planilha (apenas Aluno e Matéria)
  const handleProcessPastedText = () => {
    if (!pasteContent.trim()) {
      setShowPasteModal(false);
      return;
    }

    const lines = pasteContent.trim().split(/\r?\n/);
    const parsedRows: ManualRow[] = [];

    lines.forEach((line) => {
      if (!line.trim()) return;
      let cols = line.split('\t');
      if (cols.length === 1 && line.includes(';')) {
        cols = line.split(';');
      }

      const student = cols[0]?.trim() || '';
      const subject = cleanSubject(cols[1]?.trim() || '');

      if (student || subject) {
        parsedRows.push({
          id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
          studentName: student,
          subjectName: subject,
        });
      }
    });

    if (parsedRows.length > 0) {
      const hasContent = rows.some((r) => r.studentName.trim() || r.subjectName.trim());
      if (!hasContent) {
        setRows(parsedRows);
      } else {
        setRows((prev) => [...prev, ...parsedRows]);
      }
      showToast(`${parsedRows.length} alunos e matérias importados com sucesso!`, 'success');
    }

    setPasteContent('');
    setShowPasteModal(false);
  };

  // Checagem de duplicidade de uma linha específica
  const checkRowDuplicate = (row: ManualRow, index: number) => {
    if (!row.studentName.trim() || !row.subjectName.trim()) return null;
    const fp = createDuplicateFingerprint(row.studentName, row.subjectName);

    const currentOrderId = editingOrderId || editOrderId;

    // Duplicidade histórica (desconsidera registros do próprio pedido em edição)
    if (historicalMap.has(fp)) {
      const allEntries = historicalMap.get(fp) || [];
      const otherOrders = allEntries.filter(
        (entry) => !currentOrderId || entry.orderId !== currentOrderId
      );

      if (otherOrders.length > 0) {
        const match = otherOrders[0];
        let matchEducator = match.educatorName ? toFirstName(match.educatorName) : '';
        if (!matchEducator && match.orderTitle) {
          const titleMatch = match.orderTitle.match(/\(([^)]+)\)$/);
          if (titleMatch && titleMatch[1]) {
            matchEducator = toFirstName(titleMatch[1]);
          }
        }

        return {
          type: 'historical' as const,
          message: `Já entregue no histórico: "${match.orderTitle}"`,
          orderTitle: match.orderTitle,
          educatorName: matchEducator,
        };
      }
    }

    // Duplicidade interna na própria lista digitada
    const internalIndex = rows.findIndex(
      (r, idx) =>
        idx !== index &&
        r.studentName.trim() &&
        r.subjectName.trim() &&
        createDuplicateFingerprint(r.studentName, r.subjectName) === fp
    );

    if (internalIndex !== -1 && internalIndex < index) {
      return {
        type: 'internal' as const,
        message: `Repetido na linha ${internalIndex + 1} desta mesma lista`,
      };
    }

    return null;
  };

  // Salvar pedido no Supabase
  const handleSaveOrder = async (redirectAfterSave: boolean) => {
    const validRows = rows.filter((r) => r.studentName.trim() && r.subjectName.trim());

    if (validRows.length === 0) {
      showAlert(
        'Preencha pelo menos o Nome do Aluno e a Matéria em uma das linhas antes de salvar.',
        'warning',
        'Lista Vazia'
      );
      return;
    }

    try {
      setIsSaving(true);
      isSavingRef.current = true;
      const unitId = process.env.NEXT_PUBLIC_DEFAULT_UNIT_ID || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
      const competenceDateStr = `${competenceYear}-${String(competenceMonth).padStart(2, '0')}-01`;

      if (isEditMode && editingOrderId) {
        // ============= MODO EDIÇÃO: Atualiza pedido existente =============
        
        // 1. Atualiza o cabeçalho do pedido
        const cleanTitleStr = formatOrderTitle(title);
        const { data: updatedOrder, error: orderErr } = await supabase
          .from('orders')
          .update({
            title: cleanTitleStr,
            competence_month: Number(competenceMonth),
            competence_year: Number(competenceYear),
            competence_date: competenceDateStr,
            total_items: validRows.length,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingOrderId)
          .select('id')
          .single();

        if (orderErr || !updatedOrder?.id) {
          showAlert(
            'O pedido que você está tentando editar não foi encontrado no banco de dados (pode ter sido excluído no Histórico).',
            'error',
            'Pedido Não Encontrado'
          );
          try {
            if (editingOrderId) {
              localStorage.removeItem(`microlins_draft_edit_${editingOrderId}`);
            }
          } catch {}
          return;
        }

        // 2. Remove todos os itens antigos do pedido
        const { error: deleteErr } = await supabase
          .from('order_items')
          .delete()
          .eq('order_id', editingOrderId);

        if (deleteErr) throw deleteErr;

        // 3. Insere os itens atualizados
        const itemsToInsert = validRows.map((row, idx) => {
          const fp = createDuplicateFingerprint(row.studentName, row.subjectName);
          const allEntries = historicalMap.get(fp) || [];
          const otherOrders = allEntries.filter(
            (entry) => !editingOrderId || entry.orderId !== editingOrderId
          );
          const isHistorical = otherOrders.length > 0;
          const matchTitle = isHistorical ? otherOrders[0].orderTitle : null;

          const isInternal = validRows.some(
            (other, otherIdx) =>
              otherIdx < idx &&
              createDuplicateFingerprint(other.studentName, other.subjectName) === fp
          );

          const cleanSubj = cleanSubject(row.subjectName);
          const rowEducator = showEducatorColumn && row.educatorName?.trim()
            ? toFirstName(row.educatorName.trim())
            : toFirstName(selectedEducator.trim());

          return {
            order_id: editingOrderId,
            student_name: row.studentName.trim(),
            student_name_normalized: normalizeText(row.studentName),
            subject_name: cleanSubj,
            subject_name_normalized: normalizeText(cleanSubj),
            raw_subject_name: row.subjectName.trim(),
            educator_name: rowEducator || null,
            delivery_date: competenceDateStr,
            delivery_status: 'Entregue',
            release_status: 'Liberado',
            current_lesson: 0,
            duplicate_fingerprint: fp,
            is_internal_duplicate: isInternal,
            is_historical_duplicate: isHistorical,
            historical_match_order_title: matchTitle,
            source_row: idx + 1,
          };
        });

        const { error: itemsErr } = await supabase.from('order_items').insert(itemsToInsert);
        if (itemsErr) throw itemsErr;

        // Atualiza historicalMap em memória para o pedido editado
        validRows.forEach((r) => {
          const fp = createDuplicateFingerprint(r.studentName, r.subjectName);
          const list = (historicalMap.get(fp) || []).filter((e) => e.orderId !== editingOrderId);
          list.push({
            orderId: editingOrderId,
            orderTitle: cleanTitleStr,
            educatorName: toFirstName(r.educatorName?.trim() || selectedEducator.trim() || ''),
          });
          historicalMap.set(fp, list);
        });

        // Limpa rascunhos salvos e bloqueia auto-save ao sair
        isCancellingRef.current = true;
        try {
          localStorage.removeItem('microlins_draft_pedido_manual');
          if (editingOrderId) {
            localStorage.removeItem(`microlins_draft_edit_${editingOrderId}`);
          }
          if (isFromImport) {
            localStorage.removeItem('microlins_draft_nova_ordem');
          }
        } catch {}

        showToast(`Pedido atualizado com sucesso com ${validRows.length} apostilas!`, 'success');
        router.push('/historico');

      } else {
        // ============= MODO CRIAÇÃO: Cria novo pedido =============

        // 1. Obtém próxima sequência automaticamente no banco de dados
        const { data: seqData } = await supabase.rpc('get_next_order_sequence', {
          p_unit_id: unitId,
        });

        const nextSeq = seqData?.[0]?.next_seq || 1;
        const orderNum = seqData?.[0]?.next_number || `#${String(nextSeq).padStart(3, '0')}`;
        const cleanTitleStr = formatOrderTitle(title, `ENTREGA DE MATERIAL - HISTÓRICO ${orderNum}`);

        // 2. Grava o Pedido
        const { data: newOrder, error: orderErr } = await supabase
          .from('orders')
          .insert({
            unit_id: unitId,
            order_number: orderNum,
            sequence_num: nextSeq,
            title: cleanTitleStr,
            status: 'archived',
            competence_month: Number(competenceMonth),
            competence_year: Number(competenceYear),
            competence_date: competenceDateStr,
            total_items: validRows.length,
            archived_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (orderErr || !newOrder?.id) {
          throw orderErr || new Error('Falha ao registrar novo pedido no banco de dados.');
        }

        // 3. Grava os Itens do Pedido com o Educador da linha/lista e Liberação automática
        const itemsToInsert = validRows.map((row, idx) => {
          const fp = createDuplicateFingerprint(row.studentName, row.subjectName);
          const allEntries = historicalMap.get(fp) || [];
          const isHistorical = allEntries.length > 0;
          const matchTitle = isHistorical ? allEntries[0].orderTitle : null;

          const isInternal = validRows.some(
            (other, otherIdx) =>
              otherIdx < idx &&
              createDuplicateFingerprint(other.studentName, other.subjectName) === fp
          );

          const cleanSubj = cleanSubject(row.subjectName);
          const rowEducator = showEducatorColumn && row.educatorName?.trim()
            ? toFirstName(row.educatorName.trim())
            : toFirstName(selectedEducator.trim());

          return {
            order_id: newOrder.id,
            student_name: row.studentName.trim(),
            student_name_normalized: normalizeText(row.studentName),
            subject_name: cleanSubj,
            subject_name_normalized: normalizeText(cleanSubj),
            raw_subject_name: row.subjectName.trim(),
            educator_name: rowEducator || null,
            delivery_date: competenceDateStr,
            delivery_status: 'Entregue',
            release_status: 'Liberado',
            current_lesson: 0,
            duplicate_fingerprint: fp,
            is_internal_duplicate: isInternal,
            is_historical_duplicate: isHistorical,
            historical_match_order_title: matchTitle,
            source_row: idx + 1,
          };
        });

        const { error: itemsErr } = await supabase.from('order_items').insert(itemsToInsert);
        if (itemsErr) throw itemsErr;

        // Limpa rascunhos salvos
        isCancellingRef.current = true;
        try {
          localStorage.removeItem('microlins_draft_pedido_manual');
          if (isFromImport) {
            localStorage.removeItem('microlins_draft_nova_ordem');
          }
        } catch {}

        showToast(`Lista de ${validRows.length} apostilas salva com sucesso no histórico!`, 'success');

        if (redirectAfterSave) {
          router.push('/historico');
        } else {
          isCancellingRef.current = false;
          // Prepara tela para digitar a próxima lista impressa
          setSelectedEducator(''); // Limpa o educador para a próxima lista
          setRows([
            DEFAULT_ROW(),
            DEFAULT_ROW(),
            DEFAULT_ROW(),
            DEFAULT_ROW(),
            DEFAULT_ROW(),
          ]);

          // Atualiza mapa de duplicidades local
          validRows.forEach((r) => {
            const fp = createDuplicateFingerprint(r.studentName, r.subjectName);
            const list = historicalMap.get(fp) || [];
            list.push({
              orderId: newOrder.id,
              orderTitle: cleanTitleStr,
              educatorName: toFirstName(r.educatorName?.trim() || selectedEducator.trim() || ''),
            });
            historicalMap.set(fp, list);
          });

          // Foca no topo da tabela
          window.scrollTo({ top: 0, behavior: 'smooth' });
          setTimeout(() => {
            const firstInput = document.getElementById('student-input-0') as HTMLInputElement | null;
            if (firstInput) firstInput.focus();
          }, 100);
        }
      }
    } catch (err: any) {
      console.error('Erro ao salvar pedido manual:', err);
      showAlert(
        `Falha ao salvar no banco de dados:\n${err.message || 'Verifique sua conexão ou políticas RLS.'}`,
        'error',
        'Erro ao Salvar'
      );
    } finally {
      setIsSaving(false);
      isSavingRef.current = false;
    }
  };

  const validCount = rows.filter((r) => r.studentName.trim() && r.subjectName.trim()).length;
  const filteredEducators = educators.filter((ed) =>
    ed.name.toLowerCase().includes(educatorSearch.toLowerCase())
  );
  const hasAnyRowEducator = rows.some((r) => Boolean(r.educatorName?.trim()));
  const displayEducatorCol = showEducatorColumn || hasAnyRowEducator || isFromImport;
  const canSave = !isSaving && validCount > 0;

  // Loading state para edição
  if (isLoadingEdit) {
    return (
      <div className="p-8 flex items-center justify-center gap-3 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin text-[#0f3b7d]" />
        <span className="text-sm font-medium">Carregando pedido para edição...</span>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6 max-w-6xl mx-auto w-full">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${
              isEditMode
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-[#0f3b7d]/10 text-[#0f3b7d] border-[#0f3b7d]/20'
            }`}>
              <ClipboardList className="w-3.5 h-3.5 mr-1" />
              {isEditMode ? 'Editando Pedido' : 'Lançamento Rápido'}
            </span>
            <span className="text-xs text-slate-400">• Digitação Focada (Aluno + Matéria)</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            {isEditMode ? 'Editar Pedido Existente' : 'Cadastrar Pedido Manualmente (Listas Impressas)'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {isEditMode
              ? 'Edite os dados do pedido carregado abaixo e salve as alterações.'
              : 'Defina o Educador e Competência da folha no topo e digite apenas o Aluno e a Matéria na tabela.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/historico"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <History className="w-4 h-4 text-slate-500" />
            <span>Ver Histórico</span>
          </Link>
          <button
            type="button"
            onClick={() => setShowPasteModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-300 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
            title="Copiar e colar lista de alunos e matérias"
          >
            <ClipboardPaste className="w-4 h-4 text-emerald-600" />
            <span>Colar do Excel / Texto</span>
          </button>
        </div>
      </div>

      {/* Banner de Modo de Edição Ativo */}
      {isEditMode && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-600 text-white rounded-lg shadow-sm">
              <Pencil className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-amber-900 text-sm">
                Editando Pedido Existente: {title}
              </p>
              <p className="text-amber-700">
                Você está alterando as apostilas de um pedido já arquivado. As alterações atualizarão este mesmo pedido no banco de dados.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCancelEdit}
              className="px-3.5 py-1.5 rounded-lg border border-amber-300 bg-white text-amber-900 font-bold hover:bg-amber-100 transition-colors shadow-sm"
            >
              Cancelar Edição
            </button>
          </div>
        </div>
      )}

      {/* Banner de Rascunho Importado de Nova Ordem */}
      {isFromImport && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#0f3b7d] text-white rounded-lg shadow-sm">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-slate-800 text-sm">
                Pedido importado pronto para edição ({validCount} apostilas)
              </p>
              <p className="text-slate-600">
                {importedFileName ? `Origem: ${importedFileName} • ` : ''}
                Você pode ajustar alunos, matérias, educadores ou adicionar novas linhas antes de salvar no histórico.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/nova-ordem"
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-semibold hover:bg-slate-50 transition-colors shadow-sm"
            >
              ← Voltar à Importação
            </Link>
            <button
              type="button"
              onClick={handleClearManualDraft}
              className="px-3 py-1.5 rounded-lg border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 font-semibold transition-colors"
            >
              Descartar
            </button>
          </div>
        </div>
      )}

      {/* Banner de Rascunho Restaurado Automaticamente */}
      {hasRestoredDraft && !isFromImport && !isEditMode && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-900 shadow-sm">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              <strong>Rascunho preservado:</strong> Seus dados foram restaurados automaticamente para você não perder nada ao navegar entre as páginas.
            </span>
          </div>
          <button
            type="button"
            onClick={handleClearManualDraft}
            className="text-xs font-semibold text-amber-800 hover:text-amber-950 underline self-end sm:self-auto shrink-0"
          >
            Limpar formulário e recomeçar
          </button>
        </div>
      )}

      {/* Cartão de Informações da Lista (Educador Único com Caixinha Personalizada) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#0f3b7d]" />
            {isEditMode ? 'Dados do Pedido em Edição' : 'Cabeçalho da Folha Impressa'}
          </h2>
          <span className="text-xs text-slate-400">
            {isEditMode ? 'Altere os dados conforme necessário' : 'Preenchimento simplificado e direto'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 text-xs">
          {/* Título do Pedido */}
          <div className="md:col-span-5">
            <label className="block font-semibold text-slate-700 mb-1">
              Título do Pedido
            </label>
            <input
              type="text"
              autoComplete="off"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ENTREGA DE MATERIAL - HISTÓRICO"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0f3b7d]"
            />
          </div>

          {/* Educador da Lista (Caixinha Personalizada do Sistema) */}
          <div className="md:col-span-4" ref={educatorDropdownRef}>
            <label className="block font-semibold text-[#0f3b7d] mb-1 flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5" />
              Educador desta Lista
              <span className="text-[10px] text-slate-400 font-normal ml-1">(opcional)</span>
            </label>
            <div className="relative">
              {/* Botão seletor personalizado */}
              <button
                type="button"
                onClick={() => {
                  setIsEducatorDropdownOpen((prev) => !prev);
                  setEducatorSearch('');
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-left text-xs font-semibold transition-all ${
                  selectedEducator
                    ? 'border-[#0f3b7d] bg-blue-50/40 text-slate-900 shadow-sm'
                    : 'border-slate-300 bg-white text-slate-500 hover:border-slate-400'
                }`}
              >
                <span className="truncate">
                  {selectedEducator || 'Nenhum (Sem educador)'}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform ${
                    isEducatorDropdownOpen ? 'rotate-180 text-[#0f3b7d]' : ''
                  }`}
                />
              </button>

              {/* Menu suspenso personalizado (Card Branco do Sistema) */}
              {isEducatorDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-xl border border-slate-200 shadow-2xl z-50 py-2 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                  {/* Busca rápida se houver mais de 4 educadores */}
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
                    {/* Opção para desmarcar / sem educador */}
                    <button
                      type="button"
                      onClick={() => handleSelectHeaderEducator('')}
                      className={`w-full flex items-center justify-between px-3.5 py-2 text-xs text-left transition-colors italic ${
                        !selectedEducator
                          ? 'bg-blue-50 text-[#0f3b7d] font-bold'
                          : 'text-slate-400 hover:bg-slate-50'
                      }`}
                    >
                      <span>(Nenhum educador selecionado)</span>
                      {!selectedEducator && (
                        <Check className="w-3.5 h-3.5 text-[#0f3b7d] shrink-0" />
                      )}
                    </button>

                    {filteredEducators.length === 0 ? (
                      <div className="px-4 py-3 text-slate-400 text-xs italic text-center">
                        Nenhum educador encontrado
                      </div>
                    ) : (
                      filteredEducators.map((ed) => {
                        const isSelected = selectedEducator === toFirstName(ed.name);
                        return (
                          <button
                            key={ed.id}
                            type="button"
                            onClick={() => handleSelectHeaderEducator(ed.name)}
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
          </div>

          {/* Competência Mês / Ano */}
          <div className="md:col-span-3">
            <label className="block font-semibold text-slate-700 mb-1">
              Mês / Ano da Lista
            </label>
            <div className="flex items-center gap-2">
              <select
                value={competenceMonth}
                onChange={(e) => setCompetenceMonth(Number(e.target.value))}
                className="w-1/2 px-2.5 py-2 border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0f3b7d]"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {String(m).padStart(2, '0')} - {new Date(2000, m - 1).toLocaleString('pt-BR', { month: 'short' })}
                  </option>
                ))}
              </select>
              <input
                type="number"
                autoComplete="off"
                value={competenceYear}
                onChange={(e) => setCompetenceYear(Number(e.target.value))}
                className="w-1/2 px-2.5 py-2 border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0f3b7d]"
              />
            </div>
          </div>
        </div>

        {/* Linha de Campos Bloqueados / Padronizados para o Histórico */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
            <Lock className="w-3 h-3 text-slate-400" />
            <span>Data da Entrega:</span>
            <strong className="text-slate-700">Competência ({String(competenceMonth).padStart(2, '0')}/{competenceYear})</strong>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
            <Lock className="w-3 h-3 text-slate-400" />
            <span>Status no Histórico:</span>
            <strong className="text-[#0f3b7d]">{isEditMode ? 'Atualização In-Place' : 'Arquivado / Concluído'}</strong>
          </div>
        </div>
      </div>

      {/* Grid de Digitação Focada (Apenas Aluno e Matéria) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50/90 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
              Tabela de Alunos e Apostilas ({validCount} preenchidos)
            </h3>
            <span className="text-[11px] text-slate-400">
              Digite o Aluno, pressione Tab para Matéria e Enter para ir à próxima linha
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAddRow}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0f3b7d] text-white font-semibold text-xs hover:bg-[#0a2e68]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>1 Linha</span>
            </button>
            <button
              type="button"
              onClick={() => handleAddMultipleRows(5)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-50"
            >
              + 5 Linhas
            </button>
            <button
              type="button"
              onClick={() => handleAddMultipleRows(10)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-50"
            >
              + 10 Linhas
            </button>
            <button
              type="button"
              onClick={handleCleanEmptyRows}
              className="px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 font-semibold text-xs"
              title="Remove linhas em branco"
            >
              Limpar Vazias
            </button>
            {!displayEducatorCol && (
              <button
                type="button"
                onClick={() => setShowEducatorColumn(true)}
                className="px-2.5 py-1.5 rounded-lg border border-dashed border-slate-300 text-slate-600 font-semibold text-xs hover:bg-slate-50 hover:text-slate-800"
                title="Habilitar coluna para especificar educador individual por aluno"
              >
                + Coluna Educador
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-3 w-12 text-center">#</th>
                <th className="py-2.5 px-3 min-w-[240px]">Nome do Aluno *</th>
                <th className="py-2.5 px-3 min-w-[240px]">Matéria / Apostila *</th>
                {displayEducatorCol && (
                  <th className="py-2.5 px-3 min-w-[180px]">Educador</th>
                )}
                <th className="py-2.5 px-3 w-16 text-center">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, index) => {
                const dupInfo = checkRowDuplicate(row, index);
                const isLast = index === rows.length - 1;

                return (
                  <tr
                    key={row.id}
                    className={`transition-colors ${
                      dupInfo ? 'bg-amber-50/70 hover:bg-amber-100/60' : 'hover:bg-slate-50/70'
                    }`}
                  >
                    {/* Número da Linha */}
                    <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">
                      {index + 1}
                    </td>

                    {/* Aluno */}
                    <td className="py-2 px-3">
                      <div className="space-y-1">
                        <input
                          id={`student-input-${index}`}
                          ref={isLast ? lastRowInputRef : undefined}
                          type="text"
                          autoComplete="off"
                          value={row.studentName}
                          onChange={(e) => handleRowChange(row.id, 'studentName', e.target.value)}
                          onKeyDown={(e) => handleStudentKeyDown(e, index)}
                          placeholder="Nome completo do aluno"
                          className="w-full px-3 py-1.5 border border-slate-300 rounded font-medium text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-[#0f3b7d]"
                        />
                        {dupInfo && (
                          <div className="flex flex-col gap-0.5 text-[10px] text-amber-700 font-semibold mt-1">
                            <div className="flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                              <span>{dupInfo.message}</span>
                            </div>
                            {dupInfo.type === 'historical' && (
                              <div className="pl-4 text-slate-600 font-medium">
                                <span>Educador: </span>
                                <strong className="text-slate-800">
                                  {dupInfo.educatorName || 'Não informado'}
                                </strong>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Matéria */}
                    <td className="py-2 px-3">
                      <input
                        id={`subject-input-${index}`}
                        type="text"
                        autoComplete="off"
                        value={row.subjectName}
                        onChange={(e) => handleRowChange(row.id, 'subjectName', e.target.value)}
                        onBlur={(e) => handleSubjectBlur(row.id, e.target.value)}
                        onKeyDown={(e) => handleSubjectKeyDown(e, index)}
                        placeholder="Ex: Windows 11 ou 161869_Windows 11"
                        className="w-full px-3 py-1.5 border border-slate-300 rounded text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-[#0f3b7d]"
                      />
                    </td>

                    {/* Educador por Linha */}
                    {displayEducatorCol && (
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          autoComplete="off"
                          value={toFirstName(row.educatorName) || ''}
                          onChange={(e) => handleRowChange(row.id, 'educatorName', toFirstName(e.target.value))}
                          placeholder={toFirstName(selectedEducator) || 'Educador do aluno'}
                          className="w-full px-3 py-1.5 border border-slate-300 rounded text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-[#0f3b7d]"
                        />
                      </td>
                    )}

                    {/* Ação Excluir */}
                    <td className="py-2 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(row.id)}
                        className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                        title="Remover linha"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Rodapé da Tabela */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-500">
            Total de linhas: <span className="font-bold text-slate-800">{rows.length}</span> • Preenchidas para salvar:{' '}
            <span className="font-bold text-[#0f3b7d]">{validCount}</span>
            {selectedEducator && (
              <span className="ml-2 font-medium text-slate-600">
                • Educador Geral: <strong className="text-slate-800">{selectedEducator}</strong>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleClearManualDraft}
              className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-600 hover:text-red-700 hover:bg-red-50 hover:border-red-200 transition-colors"
              title="Limpar formulário e apagar rascunho"
            >
              Limpar Tudo
            </button>

            <button
              type="button"
              onClick={handleAddRow}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-white"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Linha</span>
            </button>

            {isEditMode ? (
              /* Botões de edição */
              <>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Cancelar Edição</span>
                </button>
                <button
                  type="button"
                  disabled={!canSave || isSaving}
                  onClick={() => handleSaveOrder(true)}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-[#0f3b7d] text-white font-bold text-xs hover:bg-[#0a2e68] shadow-md transition-all disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'Salvando Alterações...' : 'Salvar Alterações'}</span>
                </button>
              </>
            ) : (
              /* Botões de criação */
              <>
                {/* Salvar e Ir para Histórico */}
                <button
                  type="button"
                  disabled={!canSave}
                  onClick={() => handleSaveOrder(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#0f3b7d] text-[#0f3b7d] font-bold text-xs hover:bg-blue-50 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Salvar e Ver Histórico</span>
                </button>

                {/* Salvar e Lançar Próxima Lista Impressa */}
                <button
                  type="button"
                  disabled={!canSave}
                  onClick={() => handleSaveOrder(false)}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-[#0f3b7d] text-white font-bold text-xs hover:bg-[#0a2e68] shadow-md transition-all disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'Salvando Pedido...' : 'Salvar e Lançar Próxima Lista'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Colagem Rápida (Aluno e Matéria) */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ClipboardPaste className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-base">
                  Colar Alunos e Matérias
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPasteModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Copie as colunas de <strong>Aluno</strong> e <strong>Matéria</strong> da sua planilha ou texto e cole abaixo (separados por Tab ou ponto-e-vírgula). O educador atribuído será <strong>{selectedEducator || 'o selecionado no cabeçalho'}</strong>.
            </p>

            <textarea
              rows={8}
              value={pasteContent}
              onChange={(e) => setPasteContent(e.target.value)}
              placeholder={"Exemplo:\nMaria da Silva\tWindows 11\nJoão Pereira\tExcel 2021\nAna Paula Santos\t161869_Word 2021"}
              className="w-full p-3 font-mono text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f3b7d]"
            />

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowPasteModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!pasteContent.trim()}
                onClick={handleProcessPastedText}
                className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs disabled:opacity-50"
              >
                Importar Linhas Coladas
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NovoPedidoManualPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Carregando...</div>}>
      <NovoPedidoManualContent />
    </Suspense>
  );
}
