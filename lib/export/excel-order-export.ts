import * as XLSX from 'xlsx-js-style';
import { Order, OrderItem } from '../../types';

/**
 * Utilitário oficial de exportação de pedidos para Excel (.xlsx)
 * baseado 100% na estrutura, formatação e estilos de Modelo_Impressao.xlsx:
 * - Cabeçalho mesclado em B2:G2 com o título do pedido em Calibri 14pt Negrito Centralizado com bordas
 * - Linha 4 com cabeçalhos: Aluno, Matéria, Educador, Data, Entrega, Liberação em Calibri 11pt Negrito com bordas
 * - Linhas de dados a partir da linha 5 com bordas pretas finas em todas as células
 * - Linhas extras em branco com bordas para anotações e assinaturas manuais
 * - Larguras de coluna e alturas de linha idênticas ao Modelo_Impressao.xlsx
 * - Configuração de página em A4 Paisagem (Landscape) com margens estreitas (0.5 cm)
 */

const thinBorder = {
  top: { style: 'thin', color: { rgb: '000000' } },
  bottom: { style: 'thin', color: { rgb: '000000' } },
  left: { style: 'thin', color: { rgb: '000000' } },
  right: { style: 'thin', color: { rgb: '000000' } },
};

const titleStyle = {
  font: { name: 'Calibri', sz: 14, bold: true },
  alignment: { horizontal: 'center', vertical: 'center' },
  border: thinBorder,
};

const headerStyle = {
  font: { name: 'Calibri', sz: 11, bold: true },
  alignment: { horizontal: 'center', vertical: 'center' },
  border: thinBorder,
};

const dataStyleLeft = {
  font: { name: 'Calibri', sz: 11 },
  alignment: { horizontal: 'left', vertical: 'center' },
  border: thinBorder,
};

const dataStyleCenter = {
  font: { name: 'Calibri', sz: 11 },
  alignment: { horizontal: 'center', vertical: 'center' },
  border: thinBorder,
};

export async function exportOrderToExcel(order: Order, items: OrderItem[]): Promise<void> {
  const cleanTitle = (order.title || 'ENTREGA DE MATERIAL').toUpperCase();
  const fileName = `${cleanTitle.replace(/[\\/*?:"<>|]/g, '_')}.xlsx`;

  const ws: any = {};

  // 1. Título em B2 (Mesclado de B2 até G2)
  ws['B2'] = { t: 's', v: cleanTitle, s: titleStyle };
  ws['C2'] = { t: 's', v: '', s: titleStyle };
  ws['D2'] = { t: 's', v: '', s: titleStyle };
  ws['E2'] = { t: 's', v: '', s: titleStyle };
  ws['F2'] = { t: 's', v: '', s: titleStyle };
  ws['G2'] = { t: 's', v: '', s: titleStyle };

  // 2. Cabeçalhos oficiais em B4:G4
  ws['B4'] = { t: 's', v: 'Aluno', s: headerStyle };
  ws['C4'] = { t: 's', v: 'Matéria', s: headerStyle };
  ws['D4'] = { t: 's', v: 'Educador', s: headerStyle };
  ws['E4'] = { t: 's', v: 'Data', s: headerStyle };
  ws['F4'] = { t: 's', v: 'Entrega', s: headerStyle };
  ws['G4'] = { t: 's', v: 'Liberação', s: headerStyle };

  // 3. Preenchimento dos itens e cálculo rigoroso de 26 linhas por folha
  const linesPerPage = 26;
  const totalDataRows = Math.max(linesPerPage, Math.ceil(items.length / linesPerPage) * linesPerPage);
  const startRow = 5;

  // Itens cadastrados: Aluno, Matéria e Educador preenchidos. Data, Entrega e Liberação VAZIOS para escrita à mão.
  items.forEach((item, idx) => {
    const rowNum = startRow + idx;
    ws[`B${rowNum}`] = { t: 's', v: item.student_name || '', s: dataStyleLeft };
    ws[`C${rowNum}`] = { t: 's', v: item.subject_name || '', s: dataStyleLeft };
    ws[`D${rowNum}`] = { t: 's', v: item.educator_name || '', s: dataStyleCenter };
    ws[`E${rowNum}`] = { t: 's', v: '', s: dataStyleCenter }; // Vazio com borda para preenchimento manual
    ws[`F${rowNum}`] = { t: 's', v: '', s: dataStyleCenter }; // Vazio com borda para preenchimento manual
    ws[`G${rowNum}`] = { t: 's', v: '', s: dataStyleCenter }; // Vazio com borda para preenchimento manual
  });

  // Linhas extras em branco para completar exatamente 26 linhas por folha
  for (let rowNum = startRow + items.length; rowNum < startRow + totalDataRows; rowNum++) {
    ws[`B${rowNum}`] = { t: 's', v: '', s: dataStyleLeft };
    ws[`C${rowNum}`] = { t: 's', v: '', s: dataStyleLeft };
    ws[`D${rowNum}`] = { t: 's', v: '', s: dataStyleCenter };
    ws[`E${rowNum}`] = { t: 's', v: '', s: dataStyleCenter };
    ws[`F${rowNum}`] = { t: 's', v: '', s: dataStyleCenter };
    ws[`G${rowNum}`] = { t: 's', v: '', s: dataStyleCenter };
  }

  // 4. Configurações estruturais idênticas ao Modelo_Impressao.xlsx
  const finalRow = startRow + totalDataRows - 1;
  ws['!ref'] = `B2:G${finalRow}`;
  ws['!merges'] = [{ s: { r: 1, c: 1 }, e: { r: 1, c: 6 } }];

  // Larguras exatas das colunas do modelo
  ws['!cols'] = [
    { wch: 9.14 },   // Coluna A (margem lateral da planilha)
    { wch: 40.71 },  // Coluna B (Aluno)
    { wch: 40.71 },  // Coluna C (Matéria)
    { wch: 16.29 },  // Coluna D (Educador)
    { wch: 14.29 },  // Coluna E (Data)
    { wch: 21.29 },  // Coluna F (Entrega)
    { wch: 10.86 },  // Coluna G (Liberação)
  ];

  // Alturas das linhas principais
  ws['!rows'] = [
    { hpt: 15 },    // Linha 1
    { hpt: 35.25 }, // Linha 2 (Título em destaque)
    { hpt: 15 },    // Linha 3 (Espaçamento)
    { hpt: 24.0 },  // Linha 4 (Cabeçalhos)
  ];

  // Configurações de impressão em A4 Paisagem
  ws['!pageSetup'] = {
    orientation: 'landscape',
    paperSize: 9, // A4
    fitToPage: true,
    scale: 94,
  };

  // Margens estreitas (0.5 cm)
  ws['!margins'] = {
    left: 0.196,
    right: 0.196,
    top: 0.196,
    bottom: 0.196,
    header: 0.315,
    footer: 0.315,
  };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Planilha1');

  // Dispara o download diretamente no navegador
  XLSX.writeFile(wb, fileName);
}
