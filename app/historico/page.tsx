'use client';

import { Suspense } from 'react';
import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  History,
  Search,
  FileSpreadsheet,
  RotateCcw,
  Trash2,
  Calendar,
  CheckCircle2,
  X,
  Plus,
  ClipboardList,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Pencil
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase/client';
import { Order, OrderItem } from '../../types';
import { useDialog } from '../../components/ui/dialog';
import { exportOrderToExcel } from '../../lib/export/excel-order-export';

type SortField = 'title' | 'competence' | 'total_items' | 'status' | 'educator';
type SortDirection = 'asc' | 'desc';

interface OrderWithEducator extends Order {
  dominant_educator?: string;
}

function HistoricoContent() {
  const { showAlert, showConfirm, showToast } = useDialog();
  const searchParams = useSearchParams();
  const router = useRouter();
  const editIdParam = searchParams.get('edit');

  const [orders, setOrders] = useState<OrderWithEducator[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Sorting
  const [sortField, setSortField] = useState<SortField>('title');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Selected Order for Detail
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [activeItems, setActiveItems] = useState<OrderItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [detailTab, setDetailTab] = useState<'physical' | 'onlyCode'>('physical');

  const physicalDetailItems = useMemo(() => {
    return activeItems.filter(
      (it) => it.delivery_status !== 'Apenas Código' && !it.release_status?.startsWith('Código:')
    );
  }, [activeItems]);

  const onlyCodeDetailItems = useMemo(() => {
    return activeItems.filter(
      (it) => it.delivery_status === 'Apenas Código' || it.release_status?.startsWith('Código:')
    );
  }, [activeItems]);

  const displayedDetailItems = detailTab === 'onlyCode' ? onlyCodeDetailItems : physicalDetailItems;

  // Carrega lista de pedidos com educador predominante
  const loadOrders = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('sequence_num', { ascending: false });

      if (error) throw error;

      // Para cada pedido, busca o educador predominante
      const ordersWithEducator: OrderWithEducator[] = [];

      if (data && data.length > 0) {
        // Busca todos os itens de todos os pedidos de uma vez para performance
        const orderIds = data.map((o) => o.id);
        const { data: allItems } = await supabase
          .from('order_items')
          .select('order_id, educator_name')
          .in('order_id', orderIds);

        // Agrupa educadores por pedido e acha o predominante
        const educatorMap = new Map<string, string>();
        if (allItems) {
          const grouped = new Map<string, Map<string, number>>();
          allItems.forEach((item) => {
            if (!item.educator_name) return;
            if (!grouped.has(item.order_id)) {
              grouped.set(item.order_id, new Map());
            }
            const edCount = grouped.get(item.order_id)!;
            edCount.set(item.educator_name, (edCount.get(item.educator_name) || 0) + 1);
          });

          grouped.forEach((edCounts, orderId) => {
            let maxName = '';
            let maxCount = 0;
            edCounts.forEach((count, name) => {
              if (count > maxCount) {
                maxCount = count;
                maxName = name;
              }
            });
            if (maxName) educatorMap.set(orderId, maxName);
          });
        }

        data.forEach((order) => {
          ordersWithEducator.push({
            ...order,
            dominant_educator: educatorMap.get(order.id) || '',
          });
        });
      }

      setOrders(ordersWithEducator);

      if (editIdParam && data) {
        const target = ordersWithEducator.find((o) => o.id === editIdParam);
        if (target) handleOpenOrder(target);
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

  // Abre detalhes e itens do pedido para visualização (somente leitura)
  const handleOpenOrder = async (order: Order) => {
    setActiveOrder(order);
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

  // Editar pedido na tela de lançamento manual (carrega os dados lá)
  const handleEditInManualPage = (order: Order) => {
    router.push(`/novo-pedido-manual?edit=${order.id}`);
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

  // Exportação oficial para Excel (.xlsx) baseado no Modelo_Impressao.xlsx
  const handleExportExcel = async (order: Order, itemsToExport: OrderItem[]) => {
    try {
      showToast('Gerando planilha no modelo oficial...', 'info');
      await exportOrderToExcel(order, itemsToExport);
      showToast('Planilha exportada com sucesso!', 'success');
    } catch (err: any) {
      console.error('Erro ao exportar Excel:', err);
      showAlert(`Falha ao exportar planilha: ${err.message}`, 'error');
    }
  };

  // Sorting handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Sort icon renderer
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-300 ml-1 inline" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-[#0f3b7d] ml-1 inline" />
    ) : (
      <ArrowDown className="w-3 h-3 text-[#0f3b7d] ml-1 inline" />
    );
  };

  // Filtered and sorted orders
  const sortedOrders = useMemo(() => {
    let filtered = orders.filter((o) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        o.title.toLowerCase().includes(q) ||
        o.order_number.toLowerCase().includes(q) ||
        (o.dominant_educator && o.dominant_educator.toLowerCase().includes(q))
      );
    });

    filtered.sort((a, b) => {
      let valA: string | number = '';
      let valB: string | number = '';

      switch (sortField) {
        case 'title':
          valA = a.title.toLowerCase();
          valB = b.title.toLowerCase();
          break;
        case 'competence':
          valA = a.competence_year * 100 + a.competence_month;
          valB = b.competence_year * 100 + b.competence_month;
          break;
        case 'total_items':
          valA = a.total_items;
          valB = b.total_items;
          break;
        case 'status':
          valA = a.status;
          valB = b.status;
          break;
        case 'educator':
          valA = (a.dominant_educator || '').toLowerCase();
          valB = (b.dominant_educator || '').toLowerCase();
          break;
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [orders, searchQuery, sortField, sortDirection]);

  return (
    <>
      <div className="no-print p-8 space-y-6 max-w-7xl mx-auto w-full">
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
              placeholder="Pesquisar por título ou educador..."
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
        ) : sortedOrders.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">Nenhum pedido encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider">
                <tr>
                  <th
                    className="py-3 px-4 cursor-pointer hover:text-[#0f3b7d] transition-colors select-none"
                    onClick={() => handleSort('title')}
                  >
                    <span className="inline-flex items-center">
                      Título do Pedido
                      <SortIcon field="title" />
                    </span>
                  </th>
                  <th
                    className="py-3 px-4 cursor-pointer hover:text-[#0f3b7d] transition-colors select-none"
                    onClick={() => handleSort('competence')}
                  >
                    <span className="inline-flex items-center">
                      Competência
                      <SortIcon field="competence" />
                    </span>
                  </th>
                  <th
                    className="py-3 px-4 text-center cursor-pointer hover:text-[#0f3b7d] transition-colors select-none"
                    onClick={() => handleSort('total_items')}
                  >
                    <span className="inline-flex items-center justify-center">
                      Apostilas
                      <SortIcon field="total_items" />
                    </span>
                  </th>
                  <th
                    className="py-3 px-4 cursor-pointer hover:text-[#0f3b7d] transition-colors select-none"
                    onClick={() => handleSort('educator')}
                  >
                    <span className="inline-flex items-center">
                      Educador
                      <SortIcon field="educator" />
                    </span>
                  </th>
                  <th
                    className="py-3 px-4 cursor-pointer hover:text-[#0f3b7d] transition-colors select-none"
                    onClick={() => handleSort('status')}
                  >
                    <span className="inline-flex items-center">
                      Status
                      <SortIcon field="status" />
                    </span>
                  </th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900">{order.title}</td>
                    <td className="py-3 px-4 text-slate-600">
                      {order.competence_month}/{order.competence_year}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-700">{order.total_items}</td>
                    <td className="py-3 px-4 text-slate-600">
                      {order.dominant_educator ? (
                        <span className="text-xs text-slate-700">
                          {order.dominant_educator}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">—</span>
                      )}
                    </td>
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
                          onClick={() => handleOpenOrder(order)}
                          className="px-2.5 py-1 rounded bg-blue-50 text-[#0f3b7d] hover:bg-[#0f3b7d] hover:text-white font-semibold transition-colors"
                          title="Visualizar itens do pedido"
                        >
                          Ver
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEditInManualPage(order)}
                          className="px-2.5 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white font-semibold transition-colors"
                          title="Editar no Pedido Manual"
                        >
                          <Pencil className="w-3.5 h-3.5 inline" />
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

      {/* Modal / Painel de Detalhes do Pedido (Somente Leitura) */}
      {activeOrder && (
        <div className="bg-white rounded-xl border border-slate-300 shadow-lg p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">{activeOrder.title}</h3>
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
                onClick={() => handleEditInManualPage(activeOrder)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0f3b7d] text-white text-xs font-bold hover:bg-[#0a2e68] shadow-sm transition-colors"
                title="Editar este pedido na tela de Pedido Manual"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Editar Pedido</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveOrder(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Abas de Visualização (Físico vs Apenas Código) se houver itens de código */}
          {onlyCodeDetailItems.length > 0 && (
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
              <button
                type="button"
                onClick={() => setDetailTab('physical')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  detailTab === 'physical'
                    ? 'bg-[#0f3b7d] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Apostilas Físicas ({physicalDetailItems.length})
              </button>
              <button
                type="button"
                onClick={() => setDetailTab('onlyCode')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  detailTab === 'onlyCode'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                }`}
              >
                Apenas Código ({onlyCodeDetailItems.length})
              </button>
            </div>
          )}

          {/* Tabela de Itens do Pedido Ativo (100% Somente Leitura) */}
          {isLoadingItems ? (
            <div className="p-8 text-center text-slate-400 text-xs">Carregando itens do pedido...</div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3 w-12 text-center">#</th>
                    <th className="py-2.5 px-3 min-w-[240px]">Aluno</th>
                    <th className="py-2.5 px-3 min-w-[220px]">Matéria</th>
                    <th className="py-2.5 px-3 min-w-[180px]">Educador</th>
                    {detailTab === 'onlyCode' && (
                      <th className="py-2.5 px-3 min-w-[180px]">Código da Apostila</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedDetailItems.map((item, idx) => {
                    const code =
                      item.release_status?.startsWith('Código:')
                        ? item.release_status.replace('Código:', '').trim()
                        : item.delivery_status === 'Apenas Código'
                        ? item.release_status || 'Código Liberado'
                        : '—';

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{item.student_name}</td>
                        <td className="py-2.5 px-3 text-slate-800">{item.subject_name}</td>
                        <td className="py-2.5 px-3 text-slate-600">{item.educator_name || '—'}</td>
                        {detailTab === 'onlyCode' && (
                          <td className="py-2.5 px-3 font-mono text-amber-700 font-medium">
                            {code}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      </div>
    </>
  );
}

export default function HistoricoPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Carregando histórico...</div>}>
      <HistoricoContent />
    </Suspense>
  );
}
