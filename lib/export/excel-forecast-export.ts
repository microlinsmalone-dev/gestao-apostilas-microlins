// ==============================================================================
// GESTÃO DE APOSTILAS - MICROLINS POTIRENDABA
// Exportação Excel: lib/export/excel-forecast-export.ts
// Gera planilha oficial .xlsx com Abas de Previsão Mensal e Cronograma Detalhado
// ==============================================================================

import XLSX from 'xlsx-js-style';
import { ForecastMonthlySummary, ForecastStudentItem } from '../../types';

const thinBorder = {
  top: { style: 'thin', color: { rgb: 'D0D5DD' } },
  bottom: { style: 'thin', color: { rgb: 'D0D5DD' } },
  left: { style: 'thin', color: { rgb: 'D0D5DD' } },
  right: { style: 'thin', color: { rgb: 'D0D5DD' } },
};

const titleStyle = {
  font: { name: 'Calibri', sz: 14, bold: true, color: { rgb: '0F3B7D' } },
  alignment: { horizontal: 'center', vertical: 'center' },
  fill: { fgColor: { rgb: 'F0F4F8' } },
  border: thinBorder,
};

const headerStyle = {
  font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
  alignment: { horizontal: 'center', vertical: 'center' },
  fill: { fgColor: { rgb: '0F3B7D' } },
  border: thinBorder,
};

const subHeaderStyle = {
  font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: '1E293B' } },
  alignment: { horizontal: 'left', vertical: 'center' },
  fill: { fgColor: { rgb: 'E2E8F0' } },
  border: thinBorder,
};

const dataStyleLeft = {
  font: { name: 'Calibri', sz: 10 },
  alignment: { horizontal: 'left', vertical: 'center' },
  border: thinBorder,
};

const dataStyleCenter = {
  font: { name: 'Calibri', sz: 10 },
  alignment: { horizontal: 'center', vertical: 'center' },
  border: thinBorder,
};

const totalStyle = {
  font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: '0F3B7D' } },
  alignment: { horizontal: 'center', vertical: 'center' },
  fill: { fgColor: { rgb: 'E0E7FF' } },
  border: thinBorder,
};

/**
 * Constrói a aba 1: "Resumo Mensal por Matéria"
 */
function buildMonthlySummaryWorksheet(monthlySummaries: ForecastMonthlySummary[]): any {
  const ws: any = {};

  // Título
  ws['B2'] = { t: 's', v: 'MICROLINS POTIRENDABA — PREVISÃO DE APOSTILAS POR MÊS', s: titleStyle };
  ws['C2'] = { t: 's', v: '', s: titleStyle };
  ws['D2'] = { t: 's', v: '', s: titleStyle };
  ws['E2'] = { t: 's', v: '', s: titleStyle };

  let currentRow = 4;

  let grandTotal = 0;

  monthlySummaries.forEach((m) => {
    grandTotal += m.totalWorkbooks;

    // Cabeçalho do Mês
    ws[`B${currentRow}`] = { t: 's', v: `${m.monthLabel.toUpperCase()} — TOTAL: ${m.totalWorkbooks} APOSTILAS`, s: subHeaderStyle };
    ws[`C${currentRow}`] = { t: 's', v: '', s: subHeaderStyle };
    ws[`D${currentRow}`] = { t: 's', v: '', s: subHeaderStyle };
    ws[`E${currentRow}`] = { t: 's', v: '', s: subHeaderStyle };
    currentRow++;

    // Cabeçalhos de Coluna
    ws[`B${currentRow}`] = { t: 's', v: '#', s: headerStyle };
    ws[`C${currentRow}`] = { t: 's', v: 'Matéria / Título da Apostila', s: headerStyle };
    ws[`D${currentRow}`] = { t: 's', v: 'Quantidade Prevista', s: headerStyle };
    ws[`E${currentRow}`] = { t: 's', v: '% do Mês', s: headerStyle };
    currentRow++;

    if (m.subjectsBreakdown.length === 0) {
      ws[`B${currentRow}`] = { t: 's', v: '-', s: dataStyleCenter };
      ws[`C${currentRow}`] = { t: 's', v: 'Nenhuma solicitação prevista neste mês', s: dataStyleLeft };
      ws[`D${currentRow}`] = { t: 'n', v: 0, s: dataStyleCenter };
      ws[`E${currentRow}`] = { t: 's', v: '0%', s: dataStyleCenter };
      currentRow++;
    } else {
      m.subjectsBreakdown.forEach((subj, idx) => {
        const pct = m.totalWorkbooks > 0 ? `${Math.round((subj.count / m.totalWorkbooks) * 100)}%` : '0%';
        ws[`B${currentRow}`] = { t: 'n', v: idx + 1, s: dataStyleCenter };
        ws[`C${currentRow}`] = { t: 's', v: subj.subject, s: dataStyleLeft };
        ws[`D${currentRow}`] = { t: 'n', v: subj.count, s: dataStyleCenter };
        ws[`E${currentRow}`] = { t: 's', v: pct, s: dataStyleCenter };
        currentRow++;
      });
    }

    // Linha de subtotal
    ws[`B${currentRow}`] = { t: 's', v: '', s: totalStyle };
    ws[`C${currentRow}`] = { t: 's', v: `Subtotal ${m.monthLabel}`, s: totalStyle };
    ws[`D${currentRow}`] = { t: 'n', v: m.totalWorkbooks, s: totalStyle };
    ws[`E${currentRow}`] = { t: 's', v: '100%', s: totalStyle };
    currentRow += 2; // Espaço para o próximo mês
  });

  // Linha final de Total Geral
  ws[`B${currentRow}`] = { t: 's', v: 'TOTAL GERAL PREVISTO', s: titleStyle };
  ws[`C${currentRow}`] = { t: 's', v: '', s: titleStyle };
  ws[`D${currentRow}`] = { t: 'n', v: grandTotal, s: titleStyle };
  ws[`E${currentRow}`] = { t: 's', v: 'Apostilas', s: titleStyle };

  ws['!merges'] = [
    { s: { r: 1, c: 1 }, e: { r: 1, c: 4 } }, // Título B2:E2
  ];

  // Adiciona mesclagens dos cabeçalhos dos meses
  let mRow = 4;
  monthlySummaries.forEach((m) => {
    ws['!merges'].push({ s: { r: mRow - 1, c: 1 }, e: { r: mRow - 1, c: 4 } });
    const rowSpan = Math.max(1, m.subjectsBreakdown.length);
    mRow += rowSpan + 3;
  });

  // Mesclagem do total geral
  ws['!merges'].push({ s: { r: currentRow - 1, c: 1 }, e: { r: currentRow - 1, c: 2 } });

  ws['!cols'] = [{ wch: 4 }, { wch: 8 }, { wch: 45 }, { wch: 22 }, { wch: 15 }];
  ws['!ref'] = `A1:E${currentRow + 1}`;

  return ws;
}

/**
 * Constrói a aba 2: "Cronograma Detalhado por Aluno"
 */
function buildDetailedStudentsWorksheet(forecastItems: ForecastStudentItem[]): any {
  const ws: any = {};

  // Título
  ws['B2'] = { t: 's', v: 'CRONOGRAMA DETALHADO DE PREVISÃO POR ALUNO', s: titleStyle };
  ws['C2'] = { t: 's', v: '', s: titleStyle };
  ws['D2'] = { t: 's', v: '', s: titleStyle };
  ws['E2'] = { t: 's', v: '', s: titleStyle };
  ws['F2'] = { t: 's', v: '', s: titleStyle };
  ws['G2'] = { t: 's', v: '', s: titleStyle };
  ws['H2'] = { t: 's', v: '', s: titleStyle };
  ws['I2'] = { t: 's', v: '', s: titleStyle };

  // Cabeçalhos B4:I4
  ws['B4'] = { t: 's', v: 'Aluno', s: headerStyle };
  ws['C4'] = { t: 's', v: 'Matéria Solicitada', s: headerStyle };
  ws['D4'] = { t: 's', v: 'Etapa / Ciclo', s: headerStyle };
  ws['E4'] = { t: 's', v: 'Aula / Total', s: headerStyle };
  ws['F4'] = { t: 's', v: 'Ritmo Semanal', s: headerStyle };
  ws['G4'] = { t: 's', v: 'Matérias Restantes', s: headerStyle };
  ws['H4'] = { t: 's', v: 'Mês Estimado', s: headerStyle };
  ws['I4'] = { t: 's', v: 'Status da Demanda', s: headerStyle };

  let currentRow = 5;

  forecastItems.forEach((item) => {
    const statusLabel =
      item.status === 'imediato'
        ? 'Pedido Imediato'
        : item.status === 'projetado'
        ? 'Projetado'
        : 'Sem Demanda no Período';

    const stageLabel =
      item.stage === 'atual'
        ? 'Matéria Atual'
        : item.stage === 'proxima'
        ? 'Próxima Matéria'
        : 'Matéria Futura';

    ws[`B${currentRow}`] = { t: 's', v: item.studentName, s: dataStyleLeft };
    ws[`C${currentRow}`] = { t: 's', v: item.subjectName, s: dataStyleLeft };
    ws[`D${currentRow}`] = { t: 's', v: stageLabel, s: dataStyleCenter };
    ws[`E${currentRow}`] = { t: 's', v: `${item.currentLesson} / ${item.totalLessons}`, s: dataStyleCenter };
    ws[`F${currentRow}`] = {
      t: 's',
      v: item.isSpecial ? `${item.lessonsPerWeek}x/sem (Especial)` : `${item.lessonsPerWeek}x/sem`,
      s: dataStyleCenter,
    };
    ws[`G${currentRow}`] = { t: 'n', v: item.remainingSubjectsCount, s: dataStyleCenter };
    ws[`H${currentRow}`] = { t: 's', v: item.estimatedMonthLabel, s: dataStyleCenter };
    ws[`I${currentRow}`] = { t: 's', v: statusLabel, s: dataStyleCenter };
    currentRow++;
  });

  ws['!merges'] = [{ s: { r: 1, c: 1 }, e: { r: 1, c: 8 } }];

  ws['!cols'] = [
    { wch: 4 },
    { wch: 35 }, // Aluno
    { wch: 32 }, // Matéria
    { wch: 18 }, // Etapa
    { wch: 15 }, // Aula / Total
    { wch: 18 }, // Ritmo
    { wch: 18 }, // Restantes
    { wch: 22 }, // Mês Estimado
    { wch: 22 }, // Status
  ];
  ws['!ref'] = `A1:I${currentRow + 1}`;

  return ws;
}

/**
 * Gera e dispara o download do arquivo Excel com as duas abas oficiais
 */
export async function exportForecastToExcel(
  monthlySummaries: ForecastMonthlySummary[],
  forecastItems: ForecastStudentItem[],
  fileNamePrefix: string = 'PREVISAO_APOSTILAS_MICROLINS'
): Promise<void> {
  const wb = XLSX.utils.book_new();

  // 1. Aba: Resumo Mensal por Matéria
  const wsSummary = buildMonthlySummaryWorksheet(monthlySummaries);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumo Mensal por Matéria');

  // 2. Aba: Cronograma Detalhado por Aluno
  const wsStudents = buildDetailedStudentsWorksheet(forecastItems);
  XLSX.utils.book_append_sheet(wb, wsStudents, 'Cronograma por Aluno');

  const now = new Date();
  const dateStr = `${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}_${String(now.getDate()).padStart(2, '0')}`;
  const fileName = `${fileNamePrefix}_${dateStr}.xlsx`;

  XLSX.writeFile(wb, fileName);
}
