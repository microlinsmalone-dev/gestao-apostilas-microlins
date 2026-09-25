'use client';

import { Suspense } from 'react';
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  History,
  Search,
  FileSpreadsheet,
  Printer,
  Edit3,
  RotateCcw,
  Trash2,
  Calendar,
  CheckCircle2,
  X,
  Save,
  Plus,
  ClipboardList
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase/client';
import { Order, OrderItem } from '../../types';
import { useDialog } from '../../components/ui/dialog';
import { cleanSubject, normalizeText } from '../../lib/domain/sanitizer';
import { createDuplicateFingerprint } from '../../lib/domain/duplicates';

function HistoricoContent() {
  const { showAlert, showConfirm, showToast } = useDialog();
  const searchParams = useSearchParams();
  const editIdParam = searchParams.get('edit');

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Order for Edit / Detail
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [activeItems, setActiveItems] = useState<OrderItem[]>([]);
  const [deletedItemIds, setDeletedItemIds] = useState<string[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Carrega lista de pedidos
  const loadOrders = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('sequence_num', { ascending: false });

      if (error) throw error;
      setOrders(data || []);

      if (editIdParam && data) {
        const target = data.find((o) => o.id === editIdParam);
        if (target) handleOpenOrder(target, true);
      }
    } catch (err) {
      console.warn('Erro ao carregar histórico:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [editIdParam]);

  // Abre detalhes e itens do pedido
  const handleOpenOrder = async (order: Order, editMode = false) => {
    setActiveOrder(order);
    setIsEditing(editMode);
    setDeletedItemIds([]);
    try {
      setIsLoadingItems(true);
      const { data, error } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', order.id)
        .order('source_row', { ascending: true });

      if (error) throw error;
      setActiveItems(data || []);
    } catch (err) {
      console.error('Erro ao buscar itens:', err);
    } finally {
      setIsLoadingItems(false);
    }
  };

  // Adiciona nova linha ao pedido em edição
  const handleAddNewItem = () => {
    if (!activeOrder) return;
    const newItem: OrderItem = {
      id: `new-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      order_id: activeOrder.id,
      student_name: '',
      student_name_normalized: '',
      subject_name: '',
      subject_name_normalized: '',
      raw_subject_name: '',
      course_name: null,
      educator_name: '',
      contract_number: null,
      current_lesson: 0,
      scheduled_day: null,
      scheduled_time: null,
      class_schedule: null,
      next_subject: null,
      phone: null,
      delivery_status: 'Entregue',
      delivery_date: new Date().toISOString().split('T')[0],
      release_status: 'Liberado',
      duplicate_fingerprint: '',
      is_internal_duplicate: false,
      is_historical_duplicate: false,
      historical_match_order_title: null,
      source_row: activeItems.length + 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setActiveItems((prev) => [...prev, newItem]);
  };

  // Remove linha durante a edição
  const handleRemoveActiveItem = (idx: number) => {
    const itemToRemove = activeItems[idx];
    if (itemToRemove && !itemToRemove.id.startsWith('new-')) {
      setDeletedItemIds((prev) => [...prev, itemToRemove.id]);
    }
    setActiveItems((prev) => prev.filter((_, i) => i !== idx));
  };

  // Salva edições in-place no pedido mantendo a data de criação original
  const handleSaveEdits = async () => {
    if (!activeOrder) return;
    try {
      setIsSaving(true);

      const validItems = activeItems.filter(
        (i) => i.student_name.trim() && i.subject_name.trim()
      );

      // 1. Atualiza o pedido
      const { error: orderErr } = await supabase
        .from('orders')
        .update({
          title: activeOrder.title.trim(),
          total_items: validItems.length,
          updated_at: new Date().toISOString(),
        })
        .eq('id', activeOrder.id);

      if (orderErr) throw orderErr;

      // 2. Remove itens excluídos pelo operador
      if (deletedItemIds.length > 0) {
        await supabase.from('order_items').delete().in('id', deletedItemIds);
      }

      // 3. Atualiza ou insere itens
      for (const item of validItems) {
        const fp = createDuplicateFingerprint(item.student_name, item.subject_name);
        const normStudent = normalizeText(item.student_name);
        const cleanSubj = cleanSubject(item.subject_name);
        const normSubj = normalizeText(cleanSubj);

        if (item.id.startsWith('new-')) {
          // Inserção de novo item
          await supabase.from('order_items').insert({
            order_id: activeOrder.id,
            student_name: item.student_name.trim(),
            student_name_normalized: normStudent,
            subject_name: item.subject_name.trim(),
            subject_name_normalized: normSubj,
            raw_subject_name: item.subject_name.trim(),
            educator_name: item.educator_name ? item.educator_name.trim() : null,
            delivery_date: item.delivery_date || null,
            delivery_status: item.delivery_status || 'Entregue',
            release_status: item.release_status || 'Liberado',
            current_lesson: Number(item.current_lesson) || 0,
            duplicate_fingerprint: fp,
            source_row: item.source_row || 1,
          });
        } else {
          // Atualização de item existente
          await supabase
            .from('order_items')
            .update({
              student_name: item.student_name.trim(),
              student_name_normalized: normStudent,
              subject_name: item.subject_name.trim(),
              subject_name_normalized: normSubj,
              educator_name: item.educator_name ? item.educator_name.trim() : null,
              delivery_date: item.delivery_date || null,
              delivery_status: item.delivery_status || 'Entregue',
              release_status: item.release_status || 'Liberado',
              current_lesson: Number(item.current_lesson) || 0,
              duplicate_fingerprint: fp,
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.id);
        }
      }

      showToast('Edição salva com sucesso no histórico!', 'success');
      setIsEditing(false);
      setDeletedItemIds([]);
      // Recarrega itens do pedido ativo
      handleOpenOrder(activeOrder, false);
      loadOrders();
    } catch (err: any) {
      showAlert(`Erro ao salvar: ${err.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Exclusão definitiva de pedido com confirmação
  const handleDeleteOrder = (order: Order) => {
    showConfirm({
      title: 'Excluir Pedido Definitivamente',
      message: `Tem certeza que deseja apagar o pedido "${order.title}" (${order.order_number})?\n\nEsta ação excluirá todos os itens vinculados e não poderá ser desfeita.`,
      confirmText: 'Sim, excluir pedido',
      cancelText: 'Cancelar',
      type: 'warning',
      onConfirm: async () => {
        try {
          const { error } = await supabase.from('orders').delete().eq('id', order.id);
          if (error) throw error;

          showToast(`Pedido ${order.order_number} excluído com sucesso.`, 'success');
          if (activeOrder?.id === order.id) {
            setActiveOrder(null);
          }
          loadOrders();
        } catch (err: any) {
          showAlert(`Erro ao excluir: ${err.message}`, 'error');
        }
      },
    });
  };

  // Exportação direta para Excel (.xlsx) usando SheetJS
  const handleExportExcel = (order: Order, itemsToExport: OrderItem[]) => {
    const data = itemsToExport.map((item) => {
      let formattedDate = '';
      if (item.delivery_date) {
        const parts = item.delivery_date.split('-');
        if (parts.length === 3) {
          formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
        } else {
          formattedDate = item.delivery_date;
        }
      }

      return {
        Aluno: item.student_name,
        Matéria: item.subject_name,
        Educador: item.educator_name || '',
        Data: formattedDate,
        Entrega: item.delivery_status || 'Entregue',
        Liberação: item.release_status || 'Liberado',
        'Aula Atual': item.current_lesson,
      };
    });

    // Adiciona 15 linhas extras em branco para assinaturas manuais
    for (let i = 0; i < 15; i++) {
      data.push({
        Aluno: '',
        Matéria: '',
        Educador: '',
        Data: '',
        Entrega: '',
        Liberação: '',
        'Aula Atual': 0,
      });
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pedido');

    const fileName = `${order.title.replace(/[\\/*?:"<>|]/g, '_')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const filteredOrders = orders.filter((o) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return o.title.toLowerCase().includes(q) || o.order_number.toLowerCase().includes(q);
  });

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <History className="w-6 h-6 text-[#0f3b7d]" />
            Histórico Consolidado de Pedidos
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Base oficial de pedidos arquivados, edição real in-place e reimpressão
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Busca */}
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pesquisar por título ou #ordem..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f3b7d]"
            />
          </div>

          {/* Botão Novo Pedido Manual */}
          <Link
            href="/novo-pedido-manual"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0f3b7d] text-white text-xs font-bold hover:bg-[#0a2e68] shadow-sm transition-all shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Lançar Pedido Manual</span>
          </Link>
        </div>
      </div>

      {/* Lista de Pedidos */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-xs">Carregando pedidos do histórico...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">Nenhum pedido encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Nº Ordem</th>
                  <th className="py-3 px-4">Título do Pedido</th>
                  <th className="py-3 px-4">Competência</th>
                  <th className="py-3 px-4 text-center">Apostilas</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-[#0f3b7d]">{order.order_number}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{order.title}</td>
                    <td className="py-3 px-4 text-slate-600">
                      {order.competence_month}/{order.competence_year}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-700">{order.total_items}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                        order.status === 'archived'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}>
                        {order.status === 'archived' ? 'Arquivado' : order.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenOrder(order, false)}
                          className="px-2.5 py-1 rounded bg-blue-50 text-[#0f3b7d] hover:bg-[#0f3b7d] hover:text-white font-semibold transition-colors"
                          title="Visualizar itens do pedido"
                        >
                          Ver
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenOrder(order, true)}
                          className="px-2.5 py-1 rounded bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white font-semibold transition-colors"
                          title="Editar pedido in-place"
                        >
                          <Edit3 className="w-3.5 h-3.5 inline" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteOrder(order)}
                          className="px-2 py-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Apagar pedido definitivamente"
                        >
                          <Trash2 className="w-3.5 h-3.5 inline" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal / Painel Lateral de Detalhes ou Edição do Pedido */}
      {activeOrder && (
        <div className="bg-white rounded-xl border border-slate-300 shadow-lg p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-[#0f3b7d]">
                  {activeOrder.order_number}
                </span>
                {isEditing ? (
                  <input
                    type="text"
                    value={activeOrder.title}
                    onChange={(e) => setActiveOrder({ ...activeOrder, title: e.target.value })}
                    className="font-bold text-slate-900 border border-slate-300 rounded px-2 py-1 text-sm w-80"
                  />
                ) : (
                  <h3 className="font-bold text-slate-900 text-sm">{activeOrder.title}</h3>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Competência: {activeOrder.competence_month}/{activeOrder.competence_year} •{' '}
                {activeItems.length} materiais cadastrados
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleExportExcel(activeOrder, activeItems)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Exportar Excel</span>
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Printer className="w-3.5 h-3.5 text-[#0f3b7d]" />
                <span>Imprimir / PDF</span>
              </button>

              {isEditing ? (
                <>
                  <button
                    type="button"
                    onClick={handleAddNewItem}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-300 text-xs font-bold hover:bg-emerald-100"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar Aluno</span>
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={handleSaveEdits}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#0f3b7d] text-white text-xs font-bold hover:bg-[#0a2e68]"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isSaving ? 'Salvando...' : 'Salvar Edições'}</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-300 text-xs font-semibold hover:bg-amber-100"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Editar Pedido</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setActiveOrder(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Tabela de Itens do Pedido Ativo */}
          {isLoadingItems ? (
            <div className="p-8 text-center text-slate-400 text-xs">Carregando itens do pedido...</div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    <th className="py-2.5 px-3 min-w-[200px]">Aluno</th>
                    <th className="py-2.5 px-3 min-w-[180px]">Matéria</th>
                    <th className="py-2.5 px-3 min-w-[150px]">Educador</th>
                    <th className="py-2.5 px-3 min-w-[120px]">Data Entrega</th>
                    <th className="py-2.5 px-3 min-w-[100px]">Entrega</th>
                    <th className="py-2.5 px-3 min-w-[100px]">Liberação</th>
                    <th className="py-2.5 px-3 text-center w-14">Aula</th>
                    {isEditing && <th className="py-2.5 px-3 text-right w-14">Ação</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeItems.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                      
                      {/* Aluno */}
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {isEditing ? (
                          <input
                            type="text"
                            value={item.student_name}
                            onChange={(e) => {
                              const copy = [...activeItems];
                              copy[idx].student_name = e.target.value;
                              setActiveItems(copy);
                            }}
                            className="border border-slate-300 rounded px-1.5 py-0.5 text-xs w-full"
                          />
                        ) : (
                          item.student_name
                        )}
                      </td>

                      {/* Matéria */}
                      <td className="py-2.5 px-3 text-slate-800">
                        {isEditing ? (
                          <input
                            type="text"
                            value={item.subject_name}
                            onChange={(e) => {
                              const copy = [...activeItems];
                              copy[idx].subject_name = e.target.value;
                              setActiveItems(copy);
                            }}
                            className="border border-slate-300 rounded px-1.5 py-0.5 text-xs w-full"
                          />
                        ) : (
                          item.subject_name
                        )}
                      </td>

                      {/* Educador */}
                      <td className="py-2.5 px-3 text-slate-600">
                        {isEditing ? (
                          <input
                            type="text"
                            value={item.educator_name || ''}
                            onChange={(e) => {
                              const copy = [...activeItems];
                              copy[idx].educator_name = e.target.value;
                              setActiveItems(copy);
                            }}
                            className="border border-slate-300 rounded px-1.5 py-0.5 text-xs w-full"
                          />
                        ) : (
                          item.educator_name || '—'
                        )}
                      </td>

                      {/* Data Entrega */}
                      <td className="py-2.5 px-3 text-slate-600">
                        {isEditing ? (
                          <input
                            type="date"
                            value={item.delivery_date || ''}
                            onChange={(e) => {
                              const copy = [...activeItems];
                              copy[idx].delivery_date = e.target.value;
                              setActiveItems(copy);
                            }}
                            className="border border-slate-300 rounded px-1.5 py-0.5 text-xs w-full"
                          />
                        ) : (
                          item.delivery_date
                            ? item.delivery_date.split('-').reverse().join('/')
                            : '—'
                        )}
                      </td>

                      {/* Entrega */}
                      <td className="py-2.5 px-3">
                        {isEditing ? (
                          <select
                            value={item.delivery_status || 'Entregue'}
                            onChange={(e) => {
                              const copy = [...activeItems];
                              copy[idx].delivery_status = e.target.value;
                              setActiveItems(copy);
                            }}
                            className="border border-slate-300 rounded px-1 py-0.5 text-xs w-full font-medium"
                          >
                            <option value="Entregue">Entregue</option>
                            <option value="Pendente">Pendente</option>
                            <option value="Não">Não</option>
                            <option value="Sim">Sim</option>
                          </select>
                        ) : (
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            item.delivery_status === 'Entregue' || item.delivery_status === 'Sim'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {item.delivery_status || 'Pendente'}
                          </span>
                        )}
                      </td>

                      {/* Liberação */}
                      <td className="py-2.5 px-3">
                        {isEditing ? (
                          <select
                            value={item.release_status || 'Liberado'}
                            onChange={(e) => {
                              const copy = [...activeItems];
                              copy[idx].release_status = e.target.value;
                              setActiveItems(copy);
                            }}
                            className="border border-slate-300 rounded px-1 py-0.5 text-xs w-full font-medium"
                          >
                            <option value="Liberado">Liberado</option>
                            <option value="Pendente">Pendente</option>
                            <option value="Assinado">Assinado</option>
                            <option value="Ok">Ok</option>
                          </select>
                        ) : (
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            item.release_status === 'Liberado' || item.release_status === 'Assinado' || item.release_status === 'Ok'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {item.release_status || 'Pendente'}
                          </span>
                        )}
                      </td>

                      {/* Aula */}
                      <td className="py-2.5 px-3 text-center font-bold text-[#0f3b7d]">
                        {isEditing ? (
                          <input
                            type="number"
                            value={item.current_lesson}
                            onChange={(e) => {
                              const copy = [...activeItems];
                              copy[idx].current_lesson = Number(e.target.value);
                              setActiveItems(copy);
                            }}
                            className="border border-slate-300 rounded px-1 py-0.5 text-xs w-12 text-center"
                          />
                        ) : (
                          item.current_lesson
                        )}
                      </td>

                      {/* Ação */}
                      {isEditing && (
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveActiveItem(idx)}
                            className="text-slate-400 hover:text-red-600 p-1"
                            title="Remover linha"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function HistoricoPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Carregando histórico...</div>}>
      <HistoricoContent />
    </Suspense>
  );
}
