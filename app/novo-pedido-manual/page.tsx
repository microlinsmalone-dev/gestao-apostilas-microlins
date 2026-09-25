'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ClipboardList,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  FileSpreadsheet,
  ArrowRight,
  ClipboardPaste,
  HelpCircle,
  X,
  History,
  Sparkles
} from 'lucide-react';
import { supabase } from '../../lib/supabase/client';
import { cleanSubject, normalizeText, formatOrderTitle } from '../../lib/domain/sanitizer';
import { createDuplicateFingerprint } from '../../lib/domain/duplicates';
import { useDialog } from '../../components/ui/dialog';
import { Educator } from '../../types';

interface ManualRow {
  id: string;
  studentName: string;
  subjectName: string;
  educatorName: string;
  deliveryDate: string; // YYYY-MM-DD
  deliveryStatus: string;
  releaseStatus: string;
  currentLesson: number;
}

const DEFAULT_ROW = (): ManualRow => ({
  id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
  studentName: '',
  subjectName: '',
  educatorName: '',
  deliveryDate: new Date().toISOString().split('T')[0],
  deliveryStatus: 'Entregue',
  releaseStatus: 'Liberado',
  currentLesson: 0,
});

export default function NovoPedidoManualPage() {
  const router = useRouter();
  const { showAlert, showConfirm, showToast } = useDialog();

  // Dados do Cabeçalho do Pedido
  const [orderNumber, setOrderNumber] = useState('#001');
  const [sequenceNum, setSequenceNum] = useState(1);
  const [title, setTitle] = useState('ENTREGA DE MATERIAL - PEDIDO #001');
  const [competenceMonth, setCompetenceMonth] = useState(new Date().getMonth() + 1);
  const [competenceYear, setCompetenceYear] = useState(new Date().getFullYear());
  const [orderStatus, setOrderStatus] = useState<'archived' | 'open'>('archived'); // Listas impressas já foram entregues por padrão

  // Linhas da Tabela
  const [rows, setRows] = useState<ManualRow[]>([
    DEFAULT_ROW(),
    DEFAULT_ROW(),
    DEFAULT_ROW(),
    DEFAULT_ROW(),
    DEFAULT_ROW(),
  ]);

  // Lista de Educadores do Supabase
  const [educators, setEducators] = useState<Educator[]>([]);
  // Mapa de duplicidades históricas no Supabase: fingerprint -> orderTitle
  const [historicalMap, setHistoricalMap] = useState<Map<string, string>>(new Map());

  // Estado do Modal de Colagem Rápida
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteContent, setPasteContent] = useState('');

  // Preenchimento em Massa
  const [batchDate, setBatchDate] = useState(new Date().toISOString().split('T')[0]);
  const [batchEducator, setBatchEducator] = useState('');
  const [batchDeliveryStatus, setBatchDeliveryStatus] = useState('Entregue');
  const [batchReleaseStatus, setBatchReleaseStatus] = useState('Liberado');

  // Loading & Salvamento
  const [isLoadingSeq, setIsLoadingSeq] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Referência para focar no novo input criado
  const lastRowInputRef = useRef<HTMLInputElement | null>(null);

  // Carrega próximo número sequencial, educadores e duplicidades do histórico
  const loadInitialData = async () => {
    try {
      setIsLoadingSeq(true);
      const unitId = process.env.NEXT_PUBLIC_DEFAULT_UNIT_ID || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

      // 1. Obtém próxima sequência
      const { data: seqData, error: seqErr } = await supabase.rpc('get_next_order_sequence', {
        p_unit_id: unitId,
      });

      if (!seqErr && seqData && seqData[0]) {
        const nextSeq = seqData[0].next_seq || 1;
        const nextNum = seqData[0].next_number || `#${String(nextSeq).padStart(3, '0')}`;
        setSequenceNum(nextSeq);
        setOrderNumber(nextNum);
        setTitle(`ENTREGA DE MATERIAL - PEDIDO ${nextNum}`);
      }

      // 2. Busca lista de educadores ativos
      const { data: edData } = await supabase
        .from('educators')
        .select('*')
        .eq('active', true)
        .order('name');
      if (edData) setEducators(edData);

      // 3. Busca itens já cadastrados no histórico para aviso de duplicidades
      const { data: existingItems } = await supabase
        .from('order_items')
        .select('duplicate_fingerprint, orders(title)');

      if (existingItems) {
        const hist = new Map<string, string>();
        existingItems.forEach((item: any) => {
          if (item.duplicate_fingerprint) {
            hist.set(item.duplicate_fingerprint, item.orders?.title || 'Pedido Anterior');
          }
        });
        setHistoricalMap(hist);
      }
    } catch (err) {
      console.warn('Erro ao carregar dados iniciais:', err);
    } finally {
      setIsLoadingSeq(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

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

  // Atualiza campo de uma linha
  const handleRowChange = (id: string, field: keyof ManualRow, value: any) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;

        if (field === 'subjectName') {
          // Higienização automática ao digitar ou colar matéria
          const cleaned = cleanSubject(value);
          return { ...row, [field]: cleaned };
        }

        return { ...row, [field]: value };
      })
    );
  };

  // Atalho Enter para ir para a próxima linha
  const handleKeyDown = (e: React.KeyboardEvent, index: number, isLastField: boolean) => {
    if (e.key === 'Enter' && isLastField) {
      e.preventDefault();
      if (index === rows.length - 1) {
        handleAddRow();
      }
    }
  };

  // Aplicar Data em Massa
  const handleApplyBatchDate = () => {
    if (!batchDate) return;
    setRows((prev) => prev.map((r) => ({ ...r, deliveryDate: batchDate })));
    showToast(`Data "${batchDate}" aplicada a todas as linhas!`, 'success');
  };

  // Aplicar Educador em Massa
  const handleApplyBatchEducator = () => {
    if (!batchEducator.trim()) return;
    setRows((prev) => prev.map((r) => ({ ...r, educatorName: batchEducator.trim() })));
    showToast(`Educador "${batchEducator}" aplicado a todas as linhas!`, 'success');
  };

  // Aplicar Status Entrega em Massa
  const handleApplyBatchDeliveryStatus = () => {
    setRows((prev) => prev.map((r) => ({ ...r, deliveryStatus: batchDeliveryStatus })));
    showToast(`Status de entrega "${batchDeliveryStatus}" aplicado a todas as linhas!`, 'success');
  };

  // Aplicar Status Liberação em Massa
  const handleApplyBatchReleaseStatus = () => {
    setRows((prev) => prev.map((r) => ({ ...r, releaseStatus: batchReleaseStatus })));
    showToast(`Status de liberação "${batchReleaseStatus}" aplicado a todas as linhas!`, 'success');
  };

  // Processa colagem de texto/planilha
  const handleProcessPastedText = () => {
    if (!pasteContent.trim()) {
      setShowPasteModal(false);
      return;
    }

    const lines = pasteContent.trim().split(/\r?\n/);
    const parsedRows: ManualRow[] = [];

    lines.forEach((line) => {
      if (!line.trim()) return;
      // Suporta separação por Tab (Excel), vírgula ou ponto-e-vírgula
      let cols = line.split('\t');
      if (cols.length === 1 && line.includes(';')) {
        cols = line.split(';');
      }

      const student = cols[0]?.trim() || '';
      const subject = cleanSubject(cols[1]?.trim() || '');
      const educator = cols[2]?.trim() || '';
      const date = cols[3]?.trim() || new Date().toISOString().split('T')[0];
      const delivery = cols[4]?.trim() || 'Entregue';
      const release = cols[5]?.trim() || 'Liberado';

      if (student || subject) {
        parsedRows.push({
          id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
          studentName: student,
          subjectName: subject,
          educatorName: educator,
          deliveryDate: date.includes('/') ? date.split('/').reverse().join('-') : date,
          deliveryStatus: delivery,
          releaseStatus: release,
          currentLesson: 0,
        });
      }
    });

    if (parsedRows.length > 0) {
      // Se a tabela atual só tiver linhas vazias, substitui
      const hasContent = rows.some((r) => r.studentName.trim() || r.subjectName.trim());
      if (!hasContent) {
        setRows(parsedRows);
      } else {
        setRows((prev) => [...prev, ...parsedRows]);
      }
      showToast(`${parsedRows.length} linhas coladas e importadas com sucesso!`, 'success');
    }

    setPasteContent('');
    setShowPasteModal(false);
  };

  // Checagem de duplicidade de uma linha específica
  const checkRowDuplicate = (row: ManualRow, index: number) => {
    if (!row.studentName.trim() || !row.subjectName.trim()) return null;
    const fp = createDuplicateFingerprint(row.studentName, row.subjectName);

    // Duplicidade histórica
    if (historicalMap.has(fp)) {
      return {
        type: 'historical',
        message: `Já entregue no histórico: "${historicalMap.get(fp)}"`,
      };
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
        type: 'internal',
        message: `Repetido na linha ${internalIndex + 1} deste mesmo pedido`,
      };
    }

    return null;
  };

  // Salvar pedido no Supabase
  const handleSaveOrder = async (redirectAfterSave: boolean) => {
    // Valida se há pelo menos um item preenchido
    const validRows = rows.filter((r) => r.studentName.trim() && r.subjectName.trim());

    if (validRows.length === 0) {
      showAlert(
        'Preencha pelo menos o Nome do Aluno e a Matéria em uma das linhas antes de salvar.',
        'warning',
        'Pedido Incompleto'
      );
      return;
    }

    try {
      setIsSaving(true);
      const unitId = process.env.NEXT_PUBLIC_DEFAULT_UNIT_ID || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
      const cleanTitleStr = formatOrderTitle(title, `ENTREGA DE MATERIAL - PEDIDO ${orderNumber}`);

      // 1. Grava o Pedido
      const { data: newOrder, error: orderErr } = await supabase
        .from('orders')
        .insert({
          unit_id: unitId,
          order_number: orderNumber.trim(),
          sequence_num: sequenceNum,
          title: cleanTitleStr,
          status: orderStatus,
          competence_month: Number(competenceMonth),
          competence_year: Number(competenceYear),
          competence_date: `${competenceYear}-${String(competenceMonth).padStart(2, '0')}-01`,
          total_items: validRows.length,
          archived_at: orderStatus === 'archived' ? new Date().toISOString() : null,
        })
        .select()
        .single();

      if (orderErr) throw orderErr;

      // 2. Grava os Itens do Pedido
      const itemsToInsert = validRows.map((row, idx) => {
        const fp = createDuplicateFingerprint(row.studentName, row.subjectName);
        const isHistorical = historicalMap.has(fp);
        const matchTitle = isHistorical ? historicalMap.get(fp) : null;

        // Verifica duplicidade interna
        const isInternal = validRows.some(
          (other, otherIdx) =>
            otherIdx < idx &&
            createDuplicateFingerprint(other.studentName, other.subjectName) === fp
        );

        return {
          order_id: newOrder.id,
          student_name: row.studentName.trim(),
          student_name_normalized: normalizeText(row.studentName),
          subject_name: row.subjectName.trim(),
          subject_name_normalized: normalizeText(cleanSubject(row.subjectName)),
          raw_subject_name: row.subjectName.trim(),
          educator_name: row.educatorName.trim() || null,
          delivery_date: row.deliveryDate || null,
          delivery_status: row.deliveryStatus || 'Entregue',
          release_status: row.releaseStatus || 'Liberado',
          current_lesson: Number(row.currentLesson) || 0,
          duplicate_fingerprint: fp,
          is_internal_duplicate: isInternal,
          is_historical_duplicate: isHistorical,
          historical_match_order_title: matchTitle,
          source_row: idx + 1,
        };
      });

      const { error: itemsErr } = await supabase.from('order_items').insert(itemsToInsert);
      if (itemsErr) throw itemsErr;

      showToast(`Pedido ${orderNumber} salvo com sucesso no histórico com ${validRows.length} itens!`, 'success');

      if (redirectAfterSave) {
        router.push('/historico');
      } else {
        // Prepara tela para digitar a próxima lista impressa
        const nextSeq = sequenceNum + 1;
        const nextNum = `#${String(nextSeq).padStart(3, '0')}`;
        setSequenceNum(nextSeq);
        setOrderNumber(nextNum);
        setTitle(`ENTREGA DE MATERIAL - PEDIDO ${nextNum}`);
        setRows([
          DEFAULT_ROW(),
          DEFAULT_ROW(),
          DEFAULT_ROW(),
          DEFAULT_ROW(),
          DEFAULT_ROW(),
        ]);

        // Atualiza mapa de duplicidades local com os itens recém-inseridos
        validRows.forEach((r) => {
          const fp = createDuplicateFingerprint(r.studentName, r.subjectName);
          historicalMap.set(fp, cleanTitleStr);
        });

        // Foca no topo
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err: any) {
      console.error('Erro ao salvar pedido manual:', err);
      showAlert(
        `Falha ao salvar no banco de dados:\n${err.message || 'Verifique se o número de ordem já existe ou suas políticas RLS.'}`,
        'error',
        'Erro ao Salvar'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const validCount = rows.filter((r) => r.studentName.trim() && r.subjectName.trim()).length;

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Datalist para autocomplete dos Educadores */}
      <datalist id="educators-list">
        {educators.map((ed) => (
          <option key={ed.id} value={ed.name} />
        ))}
      </datalist>

      {/* Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#0f3b7d]/10 text-[#0f3b7d] border border-[#0f3b7d]/20">
              <ClipboardList className="w-3.5 h-3.5 mr-1" />
              Lançamento Manual
            </span>
            <span className="text-xs text-slate-400">• Alimentação de Histórico</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            Cadastrar Pedido Manualmente (Listas Impressas)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Insira os dados das folhas físicas antigas (Aluno, Matéria, Educador, Data, Entrega e Liberação) diretamente na base do sistema.
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
            title="Copiar e colar várias linhas de uma vez"
          >
            <ClipboardPaste className="w-4 h-4 text-emerald-600" />
            <span>Colar do Excel / Texto</span>
          </button>
        </div>
      </div>

      {/* Cartão de Informações do Pedido */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#0f3b7d]" />
            Dados da Ordem / Cabeçalho da Lista Impressa
          </h2>
          <span className="text-xs text-slate-400">
            {isLoadingSeq ? 'Carregando numeração...' : `Identificador sugerido: ${orderNumber}`}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 text-xs">
          {/* Número do Pedido */}
          <div className="md:col-span-2">
            <label className="block font-semibold text-slate-700 mb-1">
              Nº da Ordem
            </label>
            <input
              type="text"
              value={orderNumber}
              onChange={(e) => {
                const val = e.target.value;
                setOrderNumber(val);
                setTitle(`ENTREGA DE MATERIAL - PEDIDO ${val}`);
              }}
              placeholder="#001"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-[#0f3b7d] focus:outline-none focus:ring-2 focus:ring-[#0f3b7d]"
            />
          </div>

          {/* Título do Pedido */}
          <div className="md:col-span-5">
            <label className="block font-semibold text-slate-700 mb-1">
              Título do Pedido (conforme impresso)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ENTREGA DE MATERIAL - PEDIDO #001"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0f3b7d]"
            />
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
                value={competenceYear}
                onChange={(e) => setCompetenceYear(Number(e.target.value))}
                className="w-1/2 px-2.5 py-2 border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0f3b7d]"
              />
            </div>
          </div>

          {/* Status do Pedido */}
          <div className="md:col-span-2">
            <label className="block font-semibold text-slate-700 mb-1">
              Status no Histórico
            </label>
            <select
              value={orderStatus}
              onChange={(e) => setOrderStatus(e.target.value as any)}
              className="w-full px-2.5 py-2 border border-slate-300 rounded-lg font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0f3b7d]"
            >
              <option value="archived">Arquivado / Concluído</option>
              <option value="open">Em Aberto</option>
            </select>
          </div>
        </div>
      </div>

      {/* Barra de Ações Rápidas em Massa (Facilidade para Preenchimento) */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Preenchimento Rápido em Massa (Aplicar a todas as linhas):</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            {/* Data em Massa */}
            <div className="inline-flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-slate-200">
              <span className="text-slate-500">Data:</span>
              <input
                type="date"
                value={batchDate}
                onChange={(e) => setBatchDate(e.target.value)}
                className="text-xs text-slate-700 border-none focus:outline-none"
              />
              <button
                type="button"
                onClick={handleApplyBatchDate}
                className="px-2 py-0.5 rounded bg-[#0f3b7d] text-white font-semibold text-[11px] hover:bg-[#0a2e68]"
              >
                Aplicar
              </button>
            </div>

            {/* Educador em Massa */}
            <div className="inline-flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-slate-200">
              <span className="text-slate-500">Educador:</span>
              <input
                type="text"
                list="educators-list"
                value={batchEducator}
                onChange={(e) => setBatchEducator(e.target.value)}
                placeholder="Nome..."
                className="w-28 text-xs text-slate-700 border-none focus:outline-none"
              />
              <button
                type="button"
                onClick={handleApplyBatchEducator}
                className="px-2 py-0.5 rounded bg-[#0f3b7d] text-white font-semibold text-[11px] hover:bg-[#0a2e68]"
              >
                Aplicar
              </button>
            </div>

            {/* Status Entrega em Massa */}
            <button
              type="button"
              onClick={handleApplyBatchDeliveryStatus}
              className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold text-[11px] hover:bg-emerald-100"
            >
              ✓ Marcar Todas Entregue
            </button>

            {/* Status Liberação em Massa */}
            <button
              type="button"
              onClick={handleApplyBatchReleaseStatus}
              className="px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 font-semibold text-[11px] hover:bg-blue-100"
            >
              ✓ Marcar Todas Liberado
            </button>
          </div>
        </div>
      </div>

      {/* Grid de Digitação Manual */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
              Tabela de Alunos e Apostilas ({validCount} preenchidos)
            </h3>
            <span className="text-[11px] text-slate-400">
              Pressione Enter na última coluna para criar a próxima linha automaticamente
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAddRow}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0f3b7d] text-white font-semibold text-xs hover:bg-[#0a2e68]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ 1 Linha</span>
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
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-3 w-12 text-center">#</th>
                <th className="py-2.5 px-3 min-w-[220px]">Nome do Aluno *</th>
                <th className="py-2.5 px-3 min-w-[200px]">Matéria / Apostila *</th>
                <th className="py-2.5 px-3 min-w-[170px]">Educador</th>
                <th className="py-2.5 px-3 min-w-[130px]">Data Entrega</th>
                <th className="py-2.5 px-3 min-w-[110px]">Entrega</th>
                <th className="py-2.5 px-3 min-w-[110px]">Liberação</th>
                <th className="py-2.5 px-3 w-14 text-center">Ação</th>
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
                      dupInfo ? 'bg-amber-50/60 hover:bg-amber-100/50' : 'hover:bg-slate-50/70'
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
                          ref={isLast ? lastRowInputRef : undefined}
                          type="text"
                          value={row.studentName}
                          onChange={(e) => handleRowChange(row.id, 'studentName', e.target.value)}
                          placeholder="Nome completo do aluno"
                          className="w-full px-2 py-1 border border-slate-300 rounded font-medium text-slate-900 text-xs focus:outline-none focus:ring-1 focus:ring-[#0f3b7d]"
                        />
                        {dupInfo && (
                          <div className="flex items-center gap-1 text-[10px] text-amber-700 font-semibold">
                            <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                            <span>{dupInfo.message}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Matéria */}
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        value={row.subjectName}
                        onChange={(e) => handleRowChange(row.id, 'subjectName', e.target.value)}
                        placeholder="Ex: Windows 11 ou 161869_Windows 11"
                        className="w-full px-2 py-1 border border-slate-300 rounded text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-[#0f3b7d]"
                      />
                    </td>

                    {/* Educador */}
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        list="educators-list"
                        value={row.educatorName}
                        onChange={(e) => handleRowChange(row.id, 'educatorName', e.target.value)}
                        placeholder="Educador..."
                        className="w-full px-2 py-1 border border-slate-300 rounded text-slate-700 text-xs focus:outline-none focus:ring-1 focus:ring-[#0f3b7d]"
                      />
                    </td>

                    {/* Data Entrega */}
                    <td className="py-2 px-3">
                      <input
                        type="date"
                        value={row.deliveryDate}
                        onChange={(e) => handleRowChange(row.id, 'deliveryDate', e.target.value)}
                        className="w-full px-2 py-1 border border-slate-300 rounded text-slate-700 text-xs focus:outline-none focus:ring-1 focus:ring-[#0f3b7d]"
                      />
                    </td>

                    {/* Entrega */}
                    <td className="py-2 px-3">
                      <select
                        value={row.deliveryStatus}
                        onChange={(e) => handleRowChange(row.id, 'deliveryStatus', e.target.value)}
                        className="w-full px-2 py-1 border border-slate-300 rounded text-slate-700 font-medium text-xs focus:outline-none focus:ring-1 focus:ring-[#0f3b7d]"
                      >
                        <option value="Entregue">Entregue</option>
                        <option value="Pendente">Pendente</option>
                        <option value="Não">Não</option>
                        <option value="Sim">Sim</option>
                      </select>
                    </td>

                    {/* Liberação */}
                    <td className="py-2 px-3">
                      <select
                        value={row.releaseStatus}
                        onChange={(e) => handleRowChange(row.id, 'releaseStatus', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, index, true)}
                        className="w-full px-2 py-1 border border-slate-300 rounded text-slate-700 font-medium text-xs focus:outline-none focus:ring-1 focus:ring-[#0f3b7d]"
                      >
                        <option value="Liberado">Liberado</option>
                        <option value="Pendente">Pendente</option>
                        <option value="Assinado">Assinado</option>
                        <option value="Ok">Ok</option>
                      </select>
                    </td>

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
            Total de linhas na tela: <span className="font-bold text-slate-800">{rows.length}</span> • Válidas para gravação:{' '}
            <span className="font-bold text-[#0f3b7d]">{validCount}</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleAddRow}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-white"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Adicionar Mais Linhas</span>
            </button>

            {/* Salvar e Ir para Histórico */}
            <button
              type="button"
              disabled={isSaving || validCount === 0}
              onClick={() => handleSaveOrder(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#0f3b7d] text-[#0f3b7d] font-bold text-xs hover:bg-blue-50 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Salvar e Ver Histórico</span>
            </button>

            {/* Salvar e Lançar Próxima Lista Impressa */}
            <button
              type="button"
              disabled={isSaving || validCount === 0}
              onClick={() => handleSaveOrder(false)}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-[#0f3b7d] text-white font-bold text-xs hover:bg-[#0a2e68] shadow-md transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Salvando Pedido...' : 'Salvar e Lançar Próxima Lista'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Colagem Rápida */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ClipboardPaste className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-base">
                  Colar Linhas da Planilha ou Texto
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
              Copie várias linhas no Excel, Bloco de Notas ou Word e cole na caixa abaixo. O sistema separará as colunas automaticamente (Aluno, Matéria, Educador, Data, Entrega, Liberação).
            </p>

            <textarea
              rows={8}
              value={pasteContent}
              onChange={(e) => setPasteContent(e.target.value)}
              placeholder="Exemplo colado do Excel:&#10;Maria da Silva	161869_Windows 11	Malone de Souza	2024-05-10	Entregue	Liberado&#10;João Pereira	Excel 2021	Antonio Fagner	2024-05-10	Entregue	Liberado"
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
