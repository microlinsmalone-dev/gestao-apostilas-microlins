'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
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
  CheckCircle2
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
}

const DEFAULT_ROW = (): ManualRow => ({
  id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
  studentName: '',
  subjectName: '',
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
  
  // Educador único por lista
  const [selectedEducator, setSelectedEducator] = useState('');
  const [educators, setEducators] = useState<Educator[]>([]);

  // Linhas da Tabela (apenas Aluno e Matéria)
  const [rows, setRows] = useState<ManualRow[]>([
    DEFAULT_ROW(),
    DEFAULT_ROW(),
    DEFAULT_ROW(),
    DEFAULT_ROW(),
    DEFAULT_ROW(),
  ]);

  // Mapa de duplicidades históricas: fingerprint -> orderTitle
  const [historicalMap, setHistoricalMap] = useState<Map<string, string>>(new Map());

  // Estado do Modal de Colagem Rápida
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteContent, setPasteContent] = useState('');

  // Loading & Salvamento
  const [isLoadingSeq, setIsLoadingSeq] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Referência para focar no novo input criado
  const lastRowInputRef = useRef<HTMLInputElement | null>(null);

  // Carrega próximo número sequencial, educadores e histórico
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

      // 2. Busca educadores ativos
      const { data: edData } = await supabase
        .from('educators')
        .select('*')
        .eq('active', true)
        .order('name');

      if (edData && edData.length > 0) {
        setEducators(edData);
        setSelectedEducator(edData[0].name);
      }

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
  const handleRowChange = (id: string, field: 'studentName' | 'subjectName', value: string) => {
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

  // Atalho Enter para ir direto para a próxima linha
  const handleSubjectKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (index === rows.length - 1) {
        handleAddRow();
      } else {
        // Foca no aluno da próxima linha
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
      // Suporta separação por Tab (Excel), ponto-e-vírgula ou vírgula
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
        message: `Repetido na linha ${internalIndex + 1} desta mesma lista`,
      };
    }

    return null;
  };

  // Salvar pedido no Supabase
  const handleSaveOrder = async (redirectAfterSave: boolean) => {
    if (!selectedEducator.trim()) {
      showAlert(
        'Por favor, selecione ou informe o Educador desta lista antes de salvar.',
        'warning',
        'Educador Obrigatório'
      );
      return;
    }

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
      const unitId = process.env.NEXT_PUBLIC_DEFAULT_UNIT_ID || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
      const cleanTitleStr = formatOrderTitle(title, `ENTREGA DE MATERIAL - PEDIDO ${orderNumber}`);
      const competenceDateStr = `${competenceYear}-${String(competenceMonth).padStart(2, '0')}-01`;

      // 1. Grava o Pedido (Status fixo como Archived para listas impressas já realizadas)
      const { data: newOrder, error: orderErr } = await supabase
        .from('orders')
        .insert({
          unit_id: unitId,
          order_number: orderNumber.trim(),
          sequence_num: sequenceNum,
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

      if (orderErr) throw orderErr;

      // 2. Grava os Itens do Pedido com o Educador da lista e Liberação automática
      const itemsToInsert = validRows.map((row, idx) => {
        const fp = createDuplicateFingerprint(row.studentName, row.subjectName);
        const isHistorical = historicalMap.has(fp);
        const matchTitle = isHistorical ? historicalMap.get(fp) : null;

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
          educator_name: selectedEducator.trim(),
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

        // Foca no topo da tabela
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => {
          const firstInput = document.getElementById('student-input-0') as HTMLInputElement | null;
          if (firstInput) firstInput.focus();
        }, 100);
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
    <div className="p-8 space-y-6 max-w-6xl mx-auto w-full">
      {/* Datalist para autocomplete de Educador se preferir digitar */}
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
              Lançamento Rápido
            </span>
            <span className="text-xs text-slate-400">• Digitação Focada (Aluno + Matéria)</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            Cadastrar Pedido Manualmente (Listas Impressas)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Defina o Educador e Competência da folha no topo e digite apenas o Aluno e a Matéria na tabela.
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

      {/* Cartão de Informações da Lista (Educador Único + Dados Bloqueados) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#0f3b7d]" />
            Cabeçalho da Folha Impressa
          </h2>
          <span className="text-xs text-slate-400">
            {isLoadingSeq ? 'Carregando numeração...' : `Identificador sugerido: ${orderNumber}`}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 text-xs">
          {/* Nº da Ordem */}
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
          <div className="md:col-span-4">
            <label className="block font-semibold text-slate-700 mb-1">
              Título do Pedido
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ENTREGA DE MATERIAL - PEDIDO #001"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0f3b7d]"
            />
          </div>

          {/* Educador da Lista (Único para todas as apostilas) */}
          <div className="md:col-span-3">
            <label className="block font-semibold text-[#0f3b7d] mb-1 flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5" />
              Educador desta Lista *
            </label>
            <div className="relative">
              <input
                type="text"
                list="educators-list"
                value={selectedEducator}
                onChange={(e) => setSelectedEducator(e.target.value)}
                placeholder="Selecione o educador..."
                className="w-full px-3 py-2 border-2 border-[#0f3b7d]/30 focus:border-[#0f3b7d] rounded-lg font-semibold text-slate-900 bg-blue-50/20 focus:outline-none focus:ring-2 focus:ring-[#0f3b7d]/20"
              />
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
            <span>Liberação:</span>
            <strong className="text-emerald-700">Liberado (Automático)</strong>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
            <Lock className="w-3 h-3 text-slate-400" />
            <span>Status no Histórico:</span>
            <strong className="text-[#0f3b7d]">Arquivado / Concluído</strong>
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
                <th className="py-2.5 px-3 min-w-[280px]">Nome do Aluno *</th>
                <th className="py-2.5 px-3 min-w-[280px]">Matéria / Apostila *</th>
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
                          value={row.studentName}
                          onChange={(e) => handleRowChange(row.id, 'studentName', e.target.value)}
                          onKeyDown={(e) => handleStudentKeyDown(e, index)}
                          placeholder="Nome completo do aluno"
                          className="w-full px-3 py-1.5 border border-slate-300 rounded font-medium text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-[#0f3b7d]"
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
                        id={`subject-input-${index}`}
                        type="text"
                        value={row.subjectName}
                        onChange={(e) => handleRowChange(row.id, 'subjectName', e.target.value)}
                        onKeyDown={(e) => handleSubjectKeyDown(e, index)}
                        placeholder="Ex: Windows 11 ou 161869_Windows 11"
                        className="w-full px-3 py-1.5 border border-slate-300 rounded text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-[#0f3b7d]"
                      />
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
            Total de linhas: <span className="font-bold text-slate-800">{rows.length}</span> • Preenchidas para salvar:{' '}
            <span className="font-bold text-[#0f3b7d]">{validCount}</span>
            {selectedEducator && (
              <span className="ml-2 font-medium text-slate-600">
                • Educador: <strong className="text-slate-800">{selectedEducator}</strong>
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleAddRow}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-white"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Linha</span>
            </button>

            {/* Salvar e Ir para Histórico */}
            <button
              type="button"
              disabled={isSaving || validCount === 0 || !selectedEducator.trim()}
              onClick={() => handleSaveOrder(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#0f3b7d] text-[#0f3b7d] font-bold text-xs hover:bg-blue-50 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Salvar e Ver Histórico</span>
            </button>

            {/* Salvar e Lançar Próxima Lista Impressa */}
            <button
              type="button"
              disabled={isSaving || validCount === 0 || !selectedEducator.trim()}
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
              placeholder="Exemplo:&#10;Maria da Silva	Windows 11&#10;João Pereira	Excel 2021&#10;Ana Paula Santos	161869_Word 2021"
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
