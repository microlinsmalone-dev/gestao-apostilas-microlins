import React from 'react';
import { Order, OrderItem } from '../../types';

interface PrintableOrderSheetProps {
  order: Order;
  items: OrderItem[];
}

/**
 * Componente de Impressão Oficial de Pedidos de Apostilas
 * Reproduz fielmente a formatação do Modelo_Impressao.xlsx:
 * - Cabeçalho com caixa de título destacada e borda preta
 * - Tabela com as colunas: Aluno, Matéria, Educador, Data, Entrega, Liberação
 * - Linhas com bordas pretas finas de 1px
 * - 15 linhas extras em branco para anotações e assinaturas manuais
 * - Otimizado para A4 Paisagem (Landscape)
 */
export function PrintableOrderSheet({ order, items }: PrintableOrderSheetProps) {
  const cleanTitle = (order.title || 'ENTREGA DE MATERIAL').toUpperCase();
  const extraBlankRowsCount = 15;

  return (
    <div className="printable-order-sheet w-full bg-white text-black p-2 font-sans select-none">
      {/* 1. Cabeçalho Mesclado (Equivalente à célula B2:G2 do Excel) */}
      <div className="w-full border border-black py-2.5 px-4 text-center font-bold text-base md:text-lg tracking-wide uppercase mb-3 bg-white">
        {cleanTitle}
      </div>

      {/* 2. Tabela Oficial de Materiais (Linhas 4+ do Excel) */}
      <table className="w-full border-collapse border border-black text-xs" style={{ pageBreakInside: 'auto' }}>
        <thead style={{ display: 'table-header-group' }}>
          <tr className="bg-slate-100/50" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
            <th className="border border-black px-2 py-1.5 text-center font-bold uppercase text-[11px]" style={{ width: '32%' }}>
              Aluno
            </th>
            <th className="border border-black px-2 py-1.5 text-center font-bold uppercase text-[11px]" style={{ width: '32%' }}>
              Matéria
            </th>
            <th className="border border-black px-2 py-1.5 text-center font-bold uppercase text-[11px]" style={{ width: '14%' }}>
              Educador
            </th>
            <th className="border border-black px-2 py-1.5 text-center font-bold uppercase text-[11px]" style={{ width: '9%' }}>
              Data
            </th>
            <th className="border border-black px-2 py-1.5 text-center font-bold uppercase text-[11px]" style={{ width: '13%' }}>
              Entrega
            </th>
            <th className="border border-black px-2 py-1.5 text-center font-bold uppercase text-[11px]" style={{ width: '8%' }}>
              Liberação
            </th>
          </tr>
        </thead>
        <tbody>
          {/* Linhas preenchidas do pedido */}
          {items.map((item, idx) => {
            let formattedDate = '';
            if (item.delivery_date) {
              const parts = item.delivery_date.split('-');
              if (parts.length === 3) {
                formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
              } else {
                formattedDate = item.delivery_date;
              }
            }

            return (
              <tr key={item.id || idx} className="h-6">
                <td className="border border-black px-2 py-1 text-left font-semibold text-[11px] truncate max-w-[200px]">
                  {item.student_name}
                </td>
                <td className="border border-black px-2 py-1 text-left text-[11px] truncate max-w-[200px]">
                  {item.subject_name}
                </td>
                <td className="border border-black px-1.5 py-1 text-center text-[10px]">
                  {item.educator_name || '—'}
                </td>
                <td className="border border-black px-1 py-1 text-center text-[10px]">
                  {formattedDate}
                </td>
                <td className="border border-black px-1.5 py-1 text-center text-[10px]">
                  {item.delivery_status || ''}
                </td>
                <td className="border border-black px-1 py-1 text-center text-[10px]">
                  {item.release_status || ''}
                </td>
              </tr>
            );
          })}

          {/* Linhas adicionais em branco para anotações/assinaturas manuais */}
          {Array.from({ length: extraBlankRowsCount }).map((_, idx) => (
            <tr key={`blank-row-${idx}`} className="h-6">
              <td className="border border-black px-2 py-1">&nbsp;</td>
              <td className="border border-black px-2 py-1">&nbsp;</td>
              <td className="border border-black px-1.5 py-1">&nbsp;</td>
              <td className="border border-black px-1 py-1">&nbsp;</td>
              <td className="border border-black px-1.5 py-1">&nbsp;</td>
              <td className="border border-black px-1 py-1">&nbsp;</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
