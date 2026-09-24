'use client';

import React, { useState } from 'react';
import { Sparkles, RefreshCw, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { supabase } from '../../../lib/supabase/client';

export default function HigienizacaoPage() {
  const [analyzing, setAnalyzing] = useState(false);
  const [resultMessage, setResultMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'success' | 'warning'>('idle');

  const handleRunConsolidation = async () => {
    try {
      setAnalyzing(true);
      setResultMessage('');

      // Busca todos os pedidos e itens
      const { data: orders, error: ordersErr } = await supabase
        .from('orders')
        .select('id, title, order_number');

      if (ordersErr) throw ordersErr;

      const { data: items, error: itemsErr } = await supabase
        .from('order_items')
        .select('id, order_id, student_name_normalized, subject_name_normalized');

      if (itemsErr) throw itemsErr;

      // Detecta pedidos com exatamente o mesmo título e mesma lista de alunos
      const orderSignatures = new Map<string, string>(); // signature -> first_order_id
      const duplicateOrderIds: string[] = [];

      (orders || []).forEach((order) => {
        const orderItems = (items || []).filter((i) => i.order_id === order.id);
        const signature = `${order.title.toLowerCase().trim()}:::${orderItems
          .map((i) => `${i.student_name_normalized}_${i.subject_name_normalized}`)
          .sort()
          .join('|')}`;

        if (orderSignatures.has(signature)) {
          duplicateOrderIds.push(order.id);
        } else {
          orderSignatures.set(signature, order.id);
        }
      });

      if (duplicateOrderIds.length > 0) {
        // Remove pedidos duplicados
        const { error: delErr } = await supabase
          .from('orders')
          .delete()
          .in('id', duplicateOrderIds);

        if (delErr) throw delErr;

        setStatus('warning');
        setResultMessage(
          `Higienização concluída: ${duplicateOrderIds.length} pedido(s) duplicado(s) identificado(s) e consolidados com sucesso!`
        );
      } else {
        setStatus('success');
        setResultMessage(
          'Base 100% íntegra! Nenhuma duplicação acidental de pedidos foi encontrada no banco de dados.'
        );
      }
    } catch (err: any) {
      alert(`Erro na consolidação: ${err.message}`);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-4xl mx-auto w-full">
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-[#0f3b7d]" />
          Ferramentas de Higienização da Base
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Auditoria preventiva e consolidação de registros redundantes no banco de dados
        </p>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#0f3b7d] flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">
              Consolidação de Pedidos Duplicados no Histórico
            </h2>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Esta ferramenta analisa todas as ordens e itens gravados no Supabase para identificar pedidos com o mesmo título e exatamente os mesmos alunos arquivados mais de uma vez. Ela preserva a primeira via oficial e purga redundâncias acidentais.
            </p>
          </div>
        </div>

        <div className="pt-2">
          <button
            type="button"
            disabled={analyzing}
            onClick={handleRunConsolidation}
            className="inline-flex items-center gap-2 bg-[#0f3b7d] hover:bg-[#0a2e68] text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${analyzing ? 'animate-spin' : ''}`} />
            <span>{analyzing ? 'Analisando banco de dados...' : 'Executar Varredura e Consolidação'}</span>
          </button>
        </div>

        {resultMessage && (
          <div
            className={`p-4 rounded-xl text-xs flex items-center gap-2.5 border ${
              status === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
          >
            {status === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            )}
            <span className="font-medium">{resultMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
}
