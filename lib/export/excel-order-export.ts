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

function buildOrderWorksheet(title: string, itemsList: any[], isCodeOnly = false): any {
  const cleanTitle = (title || 'ENTREGA DE MATERIAL').toUpperCase();
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
  ws['G4'] = { t: 's', v: isCodeOnly ? 'Código Apostila' : 'Liberação', s: headerStyle };

  // 3. Preenchimento dos itens e cálculo rigoroso de 26 linhas por folha
  const linesPerPage = 26;
  const totalDataRows = Math.max(linesPerPage, Math.ceil(Math.max(1, itemsList.length) / linesPerPage) * linesPerPage);
  const startRow = 5;

  itemsList.forEach((item, idx) => {
    const rowNum = startRow + idx;
    const studentName = item.student_name || item.studentName || '';
    const subjectName = item.subject_name || item.subjectName || '';
    const educatorName = item.educator_name || item.educatorName || '';
    const code =
      item.codigoApostila ||
      (item.release_status?.startsWith('Código:')
        ? item.release_status.replace('Código:', '').trim()
        : isCodeOnly && item.release_status && item.release_status !== 'Pendente'
        ? item.release_status
        : '');

    ws[`B${rowNum}`] = { t: 's', v: studentName, s: dataStyleLeft };
    ws[`C${rowNum}`] = { t: 's', v: subjectName, s: dataStyleLeft };
    ws[`D${rowNum}`] = { t: 's', v: educatorName, s: dataStyleCenter };
    ws[`E${rowNum}`] = { t: 's', v: item.delivery_date || item.deliveryDate || '', s: dataStyleCenter };
    ws[`F${rowNum}`] = { t: 's', v: item.delivery_status || item.deliveryStatus || '', s: dataStyleCenter };
    ws[`G${rowNum}`] = { t: 's', v: isCodeOnly ? (code || '') : (item.release_status || item.releaseStatus || ''), s: dataStyleCenter };
  });

  // Linhas extras em branco para completar exatamente 26 linhas por folha
  for (let rowNum = startRow + itemsList.length; rowNum < startRow + totalDataRows; rowNum++) {
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
    { wch: isCodeOnly ? 24.0 : 12.0 },  // Coluna G (Liberação / Código)
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

  return ws;
}

export function buildOrderWorkbook(
  order: Order,
  items: (OrderItem | any)[],
  onlyCodeItemsParam?: (OrderItem | any)[]
): any {
  const cleanTitle = (order.title || 'ENTREGA DE MATERIAL').toUpperCase();

  // Identifica itens de Apenas Código vs Apostilas Físicas
  let physicalItems: any[] = [];
  let codeItems: any[] = [];

  if (onlyCodeItemsParam && onlyCodeItemsParam.length > 0) {
    physicalItems = items.filter((it: any) => !it.isExcluded);
    codeItems = onlyCodeItemsParam.filter((it: any) => !it.isExcluded);
  } else {
    items.forEach((item: any) => {
      if (item.isExcluded) return;
      const isOnlyCode =
        item.isOnlyCode === true ||
        item.delivery_status === 'Apenas Código' ||
        (item.release_status && String(item.release_status).startsWith('Código:'));
      if (isOnlyCode) {
        codeItems.push(item);
      } else {
        physicalItems.push(item);
      }
    });
  }

  const wb = XLSX.utils.book_new();

  // 1. Aba Principal: Apostilas Físicas (Fiel ao Modelo_Impressao.xlsx)
  const wsPhysical = buildOrderWorksheet(cleanTitle, physicalItems, false);
  XLSX.utils.book_append_sheet(wb, wsPhysical, 'Apostilas Físicas');

  // 2. Aba Secundária: Apenas Código (se houver alunos apenas com código ou para controle geral)
  const wsCode = buildOrderWorksheet(`${cleanTitle} - APENAS CÓDIGO`, codeItems, true);
  XLSX.utils.book_append_sheet(wb, wsCode, 'Apenas Código');

  return wb;
}

export async function exportOrderToExcel(
  order: Order,
  items: (OrderItem | any)[],
  onlyCodeItemsParam?: (OrderItem | any)[]
): Promise<void> {
  const cleanTitle = (order.title || 'ENTREGA DE MATERIAL').toUpperCase();
  const fileName = `${cleanTitle.replace(/[\\/*?:"<>|]/g, '_')}.xlsx`;
  const wb = buildOrderWorkbook(order, items, onlyCodeItemsParam);

  // Dispara o download diretamente no navegador
  XLSX.writeFile(wb, fileName);
}
