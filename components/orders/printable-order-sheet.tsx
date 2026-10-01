import React from 'react';
import { Order, OrderItem } from '../../types';

interface PrintableOrderSheetProps {
  order: Order;
  items: OrderItem[];
}

/**
 * Componente de Impressão Oficial de Pedidos de Apostilas
 * Reproduz 100% fielmente a formatação do Modelo_Impressao.xlsx:
 * - Cabeçalho mesclado equivalente a B2:G2 com borda preta fina, Calibri 14pt negrito, centralizado
 * - Tabela oficial com as colunas: Aluno, Matéria, Educador, Data, Entrega, Liberação
 * - Proporções exatas das colunas do Excel: Aluno (28.2%), Matéria (28.2%), Educador (11.3%), Data (9.9%), Entrega (14.8%), Liberação (7.6%)
 * - Campos Data, Entrega e Liberação VAZIOS para preenchimento manual no momento da entrega do material
 * - Limite rigoroso de 26 linhas por folha (itens + linhas em branco = 26 linhas exatas)
 * - Altura ajustada (24px) para garantir encaixe perfeito em 1 página A4 Paisagem
 */
export function PrintableOrderSheet({ order, items }: PrintableOrderSheetProps) {
  const cleanTitle = (order.title || 'ENTREGA DE MATERIAL').toUpperCase();
  const linesPerPage = 26;
  const blankRowsCount = items.length <= linesPerPage
    ? linesPerPage - items.length
    : (linesPerPage - (items.length % linesPerPage)) % linesPerPage;

  return (
    <div
      className="printable-order-sheet w-full bg-white text-black p-1 select-none"
      style={{ fontFamily: 'Calibri, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
    >
      {/* 1. Cabeçalho Mesclado (Equivalente à célula B2:G2 do Excel) */}
      <div
        className="w-full border border-black text-center font-bold tracking-wide uppercase mb-2.5 bg-white flex items-center justify-center"
        style={{ height: '45px', fontSize: '14pt' }}
      >
        {cleanTitle}
      </div>

      {/* 2. Tabela Oficial de Materiais (Linhas 4+ do Excel) */}
      <table className="w-full border-collapse border border-black text-xs" style={{ pageBreakInside: 'auto', fontSize: '11pt' }}>
        <thead style={{ display: 'table-header-group' }}>
          <tr className="bg-slate-50" style={{ pageBreakInside: 'avoid', breakInside: 'avoid', height: '30px' }}>
            <th className="border border-black px-2 py-0.5 text-center font-bold" style={{ width: '28.2%' }}>
              Aluno
            </th>
            <th className="border border-black px-2 py-0.5 text-center font-bold" style={{ width: '28.2%' }}>
              Matéria
            </th>
            <th className="border border-black px-1.5 py-0.5 text-center font-bold" style={{ width: '11.3%' }}>
              Educador
            </th>
            <th className="border border-black px-1 py-0.5 text-center font-bold" style={{ width: '9.9%' }}>
              Data
            </th>
            <th className="border border-black px-1.5 py-0.5 text-center font-bold" style={{ width: '14.8%' }}>
              Entrega
            </th>
            <th className="border border-black px-1 py-0.5 text-center font-bold" style={{ width: '7.6%' }}>
              Liberação
            </th>
          </tr>
        </thead>
        <tbody>
          {/* Linhas preenchidas do pedido (Data, Entrega e Liberação ficam vazios para anotação à mão) */}
          {items.map((item, idx) => (
            <tr key={item.id || idx} style={{ height: '24px' }}>
              <td className="border border-black px-2 py-0 text-left font-semibold truncate max-w-[220px]">
                {item.student_name}
              </td>
              <td className="border border-black px-2 py-0 text-left truncate max-w-[220px]">
                {item.subject_name}
              </td>
              <td className="border border-black px-1.5 py-0 text-center">
                {item.educator_name || '—'}
              </td>
              <td className="border border-black px-1 py-0 text-center">
                &nbsp;
              </td>
              <td className="border border-black px-1.5 py-0 text-center">
                &nbsp;
              </td>
              <td className="border border-black px-1 py-0 text-center">
                &nbsp;
              </td>
            </tr>
          ))}

          {/* Linhas adicionais em branco para completar EXATAMENTE 26 linhas por folha */}
          {Array.from({ length: blankRowsCount }).map((_, idx) => (
            <tr key={`blank-row-${idx}`} style={{ height: '24px' }}>
              <td className="border border-black px-2 py-0">&nbsp;</td>
              <td className="border border-black px-2 py-0">&nbsp;</td>
              <td className="border border-black px-1.5 py-0">&nbsp;</td>
              <td className="border border-black px-1 py-0">&nbsp;</td>
              <td className="border border-black px-1.5 py-0">&nbsp;</td>
              <td className="border border-black px-1 py-0">&nbsp;</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
