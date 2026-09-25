'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FileText,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight,
  PlusCircle,
  History,
  GraduationCap,
  Sparkles,
  ExternalLink,
  ClipboardList
} from 'lucide-react';
import { supabase } from '../lib/supabase/client';
import { Order } from '../types';

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [ordersThisMonth, setOrdersThisMonth] = useState(0);
  const [systemStatus, setSystemStatus] = useState<'Livre' | 'Em Aberto' | 'Em Edição'>('Livre');
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        setLoading(true);
        // Busca pedidos
        const { data: orders, error } = await supabase
          .from('orders')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.warn('Erro ou modo offline do Supabase:', error.message);
          return;
        }

        if (orders) {
          setTotalOrders(orders.length);
          const totalWorkbooks = orders.reduce((acc, o) => acc + (o.total_items || 0), 0);
          setTotalItems(totalWorkbooks);

          const now = new Date();
          const curMonth = now.getMonth() + 1;
          const curYear = now.getFullYear();

          const monthCount = orders.filter(
            (o) => o.competence_month === curMonth && o.competence_year === curYear
          ).length;
          setOrdersThisMonth(monthCount);

          const hasEditing = orders.some((o) => o.status === 'editing');
          const hasOpen = orders.some((o) => o.status === 'open');

          if (hasEditing) setSystemStatus('Em Edição');
          else if (hasOpen) setSystemStatus('Em Aberto');
          else setSystemStatus('Livre');

          setRecentOrders(orders.slice(0, 5));
        }
      } catch (err) {
        console.error('Falha ao carregar indicadores:', err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto w-full">
      {/* Banner Superior Institucional */}
      <div className="bg-gradient-to-r from-[#0f3b7d] via-[#164894] to-[#0a2e68] rounded-2xl p-8 text-white shadow-lg border border-blue-900/40 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-blue-200 text-xs font-semibold backdrop-blur-sm mb-3">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Central Integrada de Materiais
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Microlins Potirendaba • Gestão de Apostilas
            </h1>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/novo-pedido-manual"
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white px-4 py-3 rounded-xl font-semibold text-sm backdrop-blur-sm shadow-sm transition-all transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <ClipboardList className="w-4 h-4" />
              <span>Lançamento Manual</span>
            </Link>
            <Link
              href="/nova-ordem"
              className="inline-flex items-center gap-2 bg-[#d91a2a] hover:bg-[#b31522] text-white px-5 py-3 rounded-xl font-semibold text-sm shadow-md transition-all transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Novo Pedido (Excel)</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Indicadores em Tempo Real (KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* KPI 1 */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total de Pedidos</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{loading ? '...' : totalOrders}</h3>
            <p className="text-[11px] text-slate-400 mt-1">Registrados no banco</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#0f3b7d] flex items-center justify-center font-bold">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Apostilas Solicitadas</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{loading ? '...' : totalItems}</h3>
            <p className="text-[11px] text-slate-400 mt-1">Total de materiais</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pedidos Este Mês</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{loading ? '...' : ordersThisMonth}</h3>
            <p className="text-[11px] text-slate-400 mt-1">Competência atual</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <Calendar className="w-6 h-6" />
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status do Sistema</p>
            <div className="mt-1">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                  systemStatus === 'Livre'
                    ? 'bg-emerald-100 text-emerald-800'
                    : systemStatus === 'Em Aberto'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    systemStatus === 'Livre'
                      ? 'bg-emerald-500'
                      : systemStatus === 'Em Aberto'
                      ? 'bg-blue-500'
                      : 'bg-amber-500'
                  }`}
                ></span>
                {systemStatus}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Pronto para operação</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
            <FileText className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Ações Rápidas em Grid */}
      <div>
        <h2 className="text-base font-bold text-slate-800 mb-4">Ações Rápidas</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/nova-ordem"
            className="p-5 bg-white rounded-xl border border-slate-200/80 hover:border-[#0f3b7d] hover:shadow-md transition-all flex items-start gap-4 group"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-[#0f3b7d] flex items-center justify-center shrink-0 group-hover:bg-[#0f3b7d] group-hover:text-white transition-colors">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-slate-900 group-hover:text-[#0f3b7d] transition-colors text-sm">
                Criar Novo Pedido
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Importe planilhas .xls do sistema, inspecione e filtre alunos.
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#0f3b7d] transition-colors mt-1" />
          </Link>

          <Link
            href="/historico"
            className="p-5 bg-white rounded-xl border border-slate-200/80 hover:border-[#0f3b7d] hover:shadow-md transition-all flex items-start gap-4 group"
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <History className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-slate-900 group-hover:text-emerald-700 transition-colors text-sm">
                Histórico Consolidado
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Consulte pedidos passados, edite in-place ou exporte para PDF e Excel.
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-700 transition-colors mt-1" />
          </Link>

          <Link
            href="/configuracoes/educadores"
            className="p-5 bg-white rounded-xl border border-slate-200/80 hover:border-[#0f3b7d] hover:shadow-md transition-all flex items-start gap-4 group"
          >
            <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center shrink-0 group-hover:bg-purple-600 group-hover:text-white transition-colors">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-slate-900 group-hover:text-purple-700 transition-colors text-sm">
                Gerenciar Educadores
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Cadastre nomes a serem ignorados para evitar educadores no pedido.
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-purple-700 transition-colors mt-1" />
          </Link>
        </div>
      </div>

      {/* Tabela de Pedidos Recentes */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Pedidos Recentes</h3>
            <p className="text-xs text-slate-400 mt-0.5">Últimos pedidos registrados no sistema</p>
          </div>
          <Link
            href="/historico"
            className="text-xs font-semibold text-[#0f3b7d] hover:underline inline-flex items-center gap-1"
          >
            Ver todos no Histórico <ExternalLink className="w-3 h-3" />
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            Nenhum pedido registrado até o momento. Clique em &quot;Novo Pedido&quot; para iniciar.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/75 text-slate-600 border-b border-slate-100 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Nº Ordem</th>
                  <th className="py-3 px-4">Título do Pedido</th>
                  <th className="py-3 px-4">Competência</th>
                  <th className="py-3 px-4 text-center">Itens</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-[#0f3b7d]">
                      {order.order_number}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">
                      {order.title}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {order.competence_month}/{order.competence_year}
                    </td>
                    <td className="py-3 px-4 text-center font-semibold text-slate-700">
                      {order.total_items}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {order.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        href={`/historico?edit=${order.id}`}
                        className="inline-flex items-center gap-1 text-[#0f3b7d] font-semibold hover:underline"
                      >
                        Abrir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
