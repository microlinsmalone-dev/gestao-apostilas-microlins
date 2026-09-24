'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  BookOpen
} from 'lucide-react';
import { parseSpreadsheetBuffer } from '../../lib/importers';
import { analyzeDuplicates } from '../../lib/domain/duplicates';
import { formatOrderTitle } from '../../lib/domain/sanitizer';
import { ProcessedStudentItem } from '../../types';
import { supabase } from '../../lib/supabase/client';

export default function NovaOrdemPage() {
  const router = useRouter();

  // Wizard State
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [title, setTitle] = useState('ENTREGA DE MATERIAL - PEDIDO');
  const [fileName, setFileName] = useState('');
  const [rawBuffer, setRawBuffer] = useState<ArrayBuffer | null>(null);

  // Filter State
  const [lessonMin, setLessonMin] = useState(4);
  const [lessonMax, setLessonMax] = useState(6);
  const [allLessons, setAllLessons] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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

  // Loading States
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Carrega educadores e histórico existente do Supabase
  useEffect(() => {
    async function loadInitialData() {
      try {
        // Busca educadores cadastrados
        const { data: educators } = await supabase
          .from('educators')
          .select('name')
          .eq('active', true);

        if (educators && educators.length > 0) {
          setIgnoredEducators(educators.map((e) => e.name));
        }

        // Busca itens do histórico para detecção de duplicidades históricas
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
      } catch (err) {
        console.warn('Supabase offline ou tabelas pendentes:', err);
      }
    }

    loadInitialData();
  }, []);

  // Processa o buffer do arquivo com os filtros atuais
  const processSpreadsheet = (buffer: ArrayBuffer) => {
    try {
      setIsProcessingFile(true);
      setErrorMessage('');

      const result = parseSpreadsheetBuffer(buffer, {
        ignoredEducators,
        lessonMin,
        lessonMax,
        allLessons,
      });

      // Aplica verificação de duplicidades internas e históricas
      const duplicateAnalysis = analyzeDuplicates(result.eligibleItems, historicalMap);

      setItems(duplicateAnalysis.items);
      setInternalDuplicatesCount(duplicateAnalysis.internalDuplicatesCount);
      setHistoricalDuplicatesCount(duplicateAnalysis.historicalDuplicatesCount);
      setStep(3); // Avança para a tabela de inspeção
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao processar arquivo.');
    } finally {
      setIsProcessingFile(false);
    }
  };

  // Upload handler
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

  // Re-aplica filtros de aulas sem re-upload
  const handleApplyFilter = (min: number, max: number, all: boolean) => {
    setLessonMin(min);
    setLessonMax(max);
    setAllLessons(all);

    if (rawBuffer) {
      try {
        const result = parseSpreadsheetBuffer(rawBuffer, {
          ignoredEducators,
          lessonMin: min,
          lessonMax: max,
          allLessons: all,
        });

        const duplicateAnalysis = analyzeDuplicates(result.eligibleItems, historicalMap);
        setItems(duplicateAnalysis.items);
        setInternalDuplicatesCount(duplicateAnalysis.internalDuplicatesCount);
        setHistoricalDuplicatesCount(duplicateAnalysis.historicalDuplicatesCount);
      } catch (err: any) {
        setErrorMessage(err.message);
      }
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

  // Finalização e salvamento no Supabase
  const handleFinalizeOrder = async () => {
    if (items.length === 0) {
      alert('Não há itens válidos para gerar o pedido.');
      return;
    }

    try {
      setIsSaving(true);
      const unitId = process.env.NEXT_PUBLIC_DEFAULT_UNIT_ID || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
      const cleanTitle = formatOrderTitle(title);
      const now = new Date();

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
          total_items: items.length,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // 3. Grava itens do pedido
      const itemsToInsert = items.map((item, idx) => ({
        order_id: orderData.id,
        student_name: item.studentName,
        student_name_normalized: item.studentNameNormalized,
        subject_name: item.subjectName,
        subject_name_normalized: item.subjectNameNormalized,
        raw_subject_name: item.rawSubjectName,
        course_name: item.courseName || null,
        educator_name: item.educatorName || null,
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

      alert(`Pedido ${orderNumber} criado com sucesso com ${items.length} apostilas!`);
      router.push('/historico');
    } catch (err: any) {
      console.error('Erro ao finalizar pedido:', err);
      alert(`Erro ao salvar no banco: ${err.message || 'Verifique o Supabase.'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredItems = items.filter((item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.studentName.toLowerCase().includes(q) ||
      item.subjectName.toLowerCase().includes(q) ||
      (item.educatorName && item.educatorName.toLowerCase().includes(q))
    );
  });

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
            Importação inteligente, conferência de matérias, duplicidades e emissão oficial
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

      {/* ETAPA 1 & 2: Formulário de Entrada & Upload */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Título do Pedido */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block">
            1. Título do Pedido
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: ENTREGA DE MATERIAL - 1º PEDIDO OUTUBRO"
            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3b7d] font-medium"
          />
          <p className="text-[11px] text-slate-400">
            * O sistema preserva rigorosamente maiúsculas e minúsculas conforme digitado.
          </p>
        </div>

        {/* Upload de Planilha */}
        <div className="md:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-2">
            2. Upload da Planilha (.xls, .xlsx, .csv)
          </label>
          <div className="border-2 border-dashed border-slate-300 hover:border-[#0f3b7d] rounded-xl p-5 text-center cursor-pointer transition-colors relative bg-slate-50/50">
            <input
              type="file"
              accept=".xls,.xlsx,.csv,.txt"
              onChange={handleFileUpload}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="w-10 h-10 rounded-full bg-blue-50 text-[#0f3b7d] flex items-center justify-center">
                <Upload className="w-5 h-5" />
              </div>
              <p className="text-xs font-semibold text-slate-700">
                {fileName ? (
                  <span className="text-[#0f3b7d]">{fileName} (Carregado)</span>
                ) : (
                  'Arraste o relatório exportado aqui ou clique para selecionar'
                )}
              </p>
              <p className="text-[11px] text-slate-400">
                Suporta: Relatório de Entrega de Apostila e Controle Pedagógico
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ETAPA 3: Inspeção e Curadoria da Tabela */}
      {items.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-6">
          {/* Barra de Filtros e Ferramentas */}
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
                className={`px-3 py-1 rounded text-xs font-semibold border transition-colors ${
                  allLessons
                    ? 'bg-[#0f3b7d] text-white border-[#0f3b7d]'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {allLessons ? '✓ Todas as Aulas' : 'Todas as Aulas'}
              </button>
            </div>

            {/* Busca Rápida */}
            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrar aluno ou matéria..."
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0f3b7d]"
              />
            </div>
          </div>

          {/* Alertas de Duplicidade */}
          <div className="flex flex-wrap gap-3">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 text-[#0f3b7d] text-xs font-semibold border border-blue-100">
              <span>Total Aprovado:</span>
              <span className="bg-white px-2 py-0.5 rounded font-bold shadow-xs">
                {items.length} alunos
              </span>
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

          {/* Tabela de Inspeção */}
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Aluno</th>
                  <th className="py-2.5 px-3">Matéria Higienizada</th>
                  <th className="py-2.5 px-3">Educador</th>
                  <th className="py-2.5 px-3 text-center">Aula</th>
                  <th className="py-2.5 px-3">Turma / Horário</th>
                  <th className="py-2.5 px-3">Próxima Matéria</th>
                  <th className="py-2.5 px-3 text-center">Avisos</th>
                  <th className="py-2.5 px-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item, idx) => {
                  const hasWarning = item.isInternalDuplicate || item.isHistoricalDuplicate;

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
                      <td className="py-2.5 px-3 text-slate-600">{item.educatorName || '—'}</td>
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
                        {!hasWarning && <span className="text-emerald-600 font-bold text-[11px]">✓</span>}
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

          {/* Botão de Finalização */}
          <div className="pt-4 flex items-center justify-between border-t border-slate-100">
            <div className="text-xs text-slate-500">
              Total a gerar:{' '}
              <strong className="text-slate-900">{items.length} apostilas formatadas</strong>
            </div>

            <button
              type="button"
              disabled={isSaving || items.length === 0}
              onClick={handleFinalizeOrder}
              className="inline-flex items-center gap-2 bg-[#0f3b7d] hover:bg-[#0a2e68] text-white px-6 py-3 rounded-xl font-bold text-sm shadow-md transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Gravando no Supabase...' : 'Finalizar e Salvar Pedido'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
