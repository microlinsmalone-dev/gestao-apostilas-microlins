import * as XLSX from 'xlsx';
import { Order, OrderItem } from '../../types';

/**
 * Utilitário oficial de exportação de pedidos para Excel (.xlsx)
 * baseado na estrutura fiel de Modelo_Impressao.xlsx:
 * - Cabeçalho mesclado em B2:G2 com o título do pedido
 * - Linha 4 com cabeçalhos: Aluno, Matéria, Educador, Data, Entrega, Liberação
 * - Linhas de dados a partir da linha 5
 * - Linhas extras em branco para assinaturas manuais
 * - Configuração de página em A4 Paisagem (Landscape) com margens estreitas
 */

export async function exportOrderToExcel(order: Order, items: OrderItem[]): Promise<void> {
  const cleanTitle = (order.title || 'ENTREGA DE MATERIAL').toUpperCase();
  const fileName = `${cleanTitle.replace(/[\\/*?:"<>|]/g, '_')}.xlsx`;

  try {
    // 1. Tenta carregar o template original oficial
    const response = await fetch('/Modelo_Impressao.xlsx');
    if (!response.ok) {
      throw new Error(`Falha ao obter modelo base: status ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const wb = XLSX.read(arrayBuffer, { type: 'array', cellStyles: true });
    const sheetName = wb.SheetNames[0] || 'Planilha1';
    const ws = wb.Sheets[sheetName];

    // 2. Atualiza o título na célula B2 (mesclada B2:G2)
    const baseTitleStyle = ws['B2']?.s;
    ws['B2'] = { t: 's', v: cleanTitle, s: baseTitleStyle };

    // 3. Estilo base das células de dados (pega da linha 5 do modelo se existir)
    const baseDataStyle = ws['B5']?.s;

    // 4. Preenche as linhas a partir da linha 5 (1-based row = 5)
    const startRow = 5;
    items.forEach((item, idx) => {
      const rowNum = startRow + idx;
      let formattedDate = '';
      if (item.delivery_date) {
        const parts = item.delivery_date.split('-');
        if (parts.length === 3) {
          formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
        } else {
          formattedDate = item.delivery_date;
        }
      }

      ws[`B${rowNum}`] = { t: 's', v: item.student_name || '', s: baseDataStyle };
      ws[`C${rowNum}`] = { t: 's', v: item.subject_name || '', s: baseDataStyle };
      ws[`D${rowNum}`] = { t: 's', v: item.educator_name || '', s: baseDataStyle };
      ws[`E${rowNum}`] = { t: 's', v: formattedDate, s: baseDataStyle };
      ws[`F${rowNum}`] = { t: 's', v: item.delivery_status || '', s: baseDataStyle };
      ws[`G${rowNum}`] = { t: 's', v: item.release_status || '', s: baseDataStyle };
    });

    // 5. Adiciona 15 linhas extras em branco com bordas para assinaturas manuais
    const totalDataRows = items.length;
    const extraBlankRows = 15;
    for (let i = 0; i < extraBlankRows; i++) {
      const rowNum = startRow + totalDataRows + i;
      ws[`B${rowNum}`] = { t: 's', v: '', s: baseDataStyle };
      ws[`C${rowNum}`] = { t: 's', v: '', s: baseDataStyle };
      ws[`D${rowNum}`] = { t: 's', v: '', s: baseDataStyle };
      ws[`E${rowNum}`] = { t: 's', v: '', s: baseDataStyle };
      ws[`F${rowNum}`] = { t: 's', v: '', s: baseDataStyle };
      ws[`G${rowNum}`] = { t: 's', v: '', s: baseDataStyle };
    }

    // 6. Atualiza o range total do worksheet para que o Excel mostre todas as linhas
    const finalRow = startRow + totalDataRows + extraBlankRows - 1;
    ws['!ref'] = `A1:G${finalRow}`;

    // 7. Salva e inicia download
    XLSX.writeFile(wb, fileName);
  } catch (err) {
    console.warn('Usando gerador programático de Excel:', err);
    exportOrderToExcelProgrammatic(order, items, fileName, cleanTitle);
  }
}

/**
 * Gerador programático autônomo (caso o arquivo estático não seja acessível)
 * replica exatamente as medidas, colunas e configurações do Modelo_Impressao.xlsx
 */
function exportOrderToExcelProgrammatic(
  order: Order,
  items: OrderItem[],
  fileName: string,
  cleanTitle: string
): void {
  // Matriz de dados (AOA)
  // Linha 1: vazia
  // Linha 2: Coluna B tem o título
  // Linha 3: vazia
  // Linha 4: Cabeçalhos (B4: Aluno, C4: Matéria, D4: Educador, E4: Data, F4: Entrega, G4: Liberação)
  const aoa: any[][] = [
    [], // Linha 1
    ['', cleanTitle, '', '', '', '', ''], // Linha 2 (B2 terá o título mesclado)
    [], // Linha 3
    ['', 'Aluno', 'Matéria', 'Educador', 'Data', 'Entrega', 'Liberação'], // Linha 4
  ];

  // Linhas de dados
  items.forEach((item) => {
    let formattedDate = '';
    if (item.delivery_date) {
      const parts = item.delivery_date.split('-');
      if (parts.length === 3) {
        formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
      } else {
        formattedDate = item.delivery_date;
      }
    }

    aoa.push([
      '',
      item.student_name || '',
      item.subject_name || '',
      item.educator_name || '',
      formattedDate,
      item.delivery_status || '',
      item.release_status || '',
    ]);
  });

  // 15 linhas extras em branco
  for (let i = 0; i < 15; i++) {
    aoa.push(['', '', '', '', '', '', '']);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Configurações exatas extraídas do Modelo_Impressao.xlsx:
  // Larguras das colunas:
  ws['!cols'] = [
    { wch: 9.14 },   // Coluna A (margem esquerda)
    { wch: 40.71 },  // Coluna B (Aluno)
    { wch: 40.71 },  // Coluna C (Matéria)
    { wch: 16.29 },  // Coluna D (Educador)
    { wch: 14.29 },  // Coluna E (Data)
    { wch: 21.29 },  // Coluna F (Entrega)
    { wch: 10.86 },  // Coluna G (Liberação)
  ];

  // Mesclagem B2:G2 para o título do pedido
  ws['!merges'] = [
    { s: { r: 1, c: 1 }, e: { r: 1, c: 6 } }
  ];

  // Alturas das linhas
  ws['!rows'] = [
    { hpt: 15 },    // Linha 1
    { hpt: 35.25 }, // Linha 2 (Título)
    { hpt: 15 },    // Linha 3
    { hpt: 24 },    // Linha 4 (Cabeçalhos)
  ];

  // Configurações de impressão em A4 Paisagem
  (ws as any)['!pageSetup'] = {
    orientation: 'landscape',
    paperSize: 9, // A4
    fitToPage: true,
    scale: 94,
  };

  // Margens estreitas (0.5 cm)
  (ws as any)['!margins'] = {
    left: 0.196,
    right: 0.196,
    top: 0.196,
    bottom: 0.196,
    header: 0.315,
    footer: 0.315,
  };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pedido');
  XLSX.writeFile(wb, fileName);
}
