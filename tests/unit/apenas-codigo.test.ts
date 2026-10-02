import { describe, it, expect } from 'vitest';
import { ApostilaDeliveryImportAdapter } from '../../lib/importers/apostila-delivery';
import { analyzeDuplicates, createDuplicateFingerprint } from '../../lib/domain/duplicates';
import { exportOrderToExcel, buildOrderWorkbook } from '../../lib/export/excel-order-export';
import * as XLSX from 'xlsx-js-style';

describe('Aba Apenas Código & Regras de Negócio', () => {
  const adapter = new ApostilaDeliveryImportAdapter();

  it('deve identificar aluno com Apenas Código quando Código Apostila estiver presente e Entrega Física for Não', () => {
    const rawRows = [
      {
        Aluno: 'DOUGLAS HENRIQUE CORDEIRO DOS SANTOS',
        Matéria: '161884_Adobe Illustrator - Creative Cloud',
        'Status Matéria': 'Ativo',
        'Status Contrato': 'Ativo',
        Inadimplente: 'Não',
        'Entrega Física': 'Não',
        'Tipo Contrato': 'Normal',
        'Aula Atual': 4,
        'Código Apostila': 'A2581125PTO200023514',
      },
      {
        Aluno: 'MARIA EDUARDA ROGÉRIO',
        Matéria: '161871_Excel 2021',
        'Status Matéria': 'Ativo',
        'Status Contrato': 'Ativo',
        Inadimplente: 'Não',
        'Entrega Física': 'Não',
        'Tipo Contrato': 'Normal',
        'Aula Atual': 4,
        'Código Apostila': '', // Sem código
      },
    ];

    const result = adapter.parse(rawRows, {
      lessonMin: 2,
      lessonMax: 6,
      allLessons: false,
    });

    expect(result.eligibleItems).toHaveLength(2);

    const douglas = result.eligibleItems.find((i) => i.studentName.includes('DOUGLAS'));
    expect(douglas).toBeDefined();
    expect(douglas?.isOnlyCode).toBe(true);
    expect(douglas?.codigoApostila).toBe('A2581125PTO200023514');

    const maria = result.eligibleItems.find((i) => i.studentName.includes('MARIA EDUARDA'));
    expect(maria).toBeDefined();
    expect(maria?.isOnlyCode).toBe(false);
    expect(maria?.codigoApostila).toBeUndefined();
  });

  it('deve aplicar verificação de duplicidades históricas e internas para itens de Apenas Código', () => {
    const douglasFingerprint = createDuplicateFingerprint(
      'DOUGLAS HENRIQUE CORDEIRO DOS SANTOS',
      'Adobe Illustrator - Creative Cloud'
    );

    const historicalMap = new Map<string, string>();
    historicalMap.set(douglasFingerprint, 'Pedido Setembro 2026');

    const rawRows = [
      // 1. Douglas (está no histórico)
      {
        Aluno: 'DOUGLAS HENRIQUE CORDEIRO DOS SANTOS',
        Matéria: '161884_Adobe Illustrator - Creative Cloud',
        'Status Matéria': 'Ativo',
        'Status Contrato': 'Ativo',
        Inadimplente: 'Não',
        'Entrega Física': 'Não',
        'Tipo Contrato': 'Normal',
        'Aula Atual': 4,
        'Código Apostila': 'A2581125PTO200023514',
      },
      // 2. Aluno duplicado internamente (aparece 2x)
      {
        Aluno: 'CARLOS SILVA',
        Matéria: 'Windows 11',
        'Status Matéria': 'Ativo',
        'Status Contrato': 'Ativo',
        Inadimplente: 'Não',
        'Entrega Física': 'Não',
        'Tipo Contrato': 'Normal',
        'Aula Atual': 3,
        'Código Apostila': 'COD123',
      },
      {
        Aluno: 'CARLOS SILVA',
        Matéria: 'Windows 11',
        'Status Matéria': 'Ativo',
        'Status Contrato': 'Ativo',
        Inadimplente: 'Não',
        'Entrega Física': 'Não',
        'Tipo Contrato': 'Normal',
        'Aula Atual': 3,
        'Código Apostila': 'COD123',
      },
    ];

    const parseResult = adapter.parse(rawRows, {
      lessonMin: 2,
      lessonMax: 6,
      allLessons: false,
    });

    const dupResult = analyzeDuplicates(parseResult.eligibleItems, historicalMap);

    expect(dupResult.historicalDuplicatesCount).toBe(1);
    expect(dupResult.internalDuplicatesCount).toBe(1);

    const douglas = dupResult.items.find((i) => i.studentName.includes('DOUGLAS'));
    expect(douglas?.isHistoricalDuplicate).toBe(true);
    expect(douglas?.historicalMatchOrderTitle).toBe('Pedido Setembro 2026');

    const carlosDuplicates = dupResult.items.filter((i) => i.studentName.includes('CARLOS'));
    expect(carlosDuplicates[1].isInternalDuplicate).toBe(true);
  });

  it('deve incluir o aluno MIGUEL ANTÔNIO GUERRA quando a aula mínima for ajustada para aula 2 ou 3', () => {
    const rawRows = [
      {
        Aluno: 'MIGUEL ANTÔNIO GUERRA',
        Matéria: '161878_Adobe Photoshop Creative Cloud - Módulo III',
        'Status Matéria': 'Ativo',
        'Status Contrato': 'Ativo',
        Inadimplente: 'Não',
        'Entrega Física': 'Não',
        'Tipo Contrato': 'Normal',
        'Aula Atual': 3,
      },
    ];

    // Com o corte padrão de 4 a 6 (antigo), ele era descartado:
    const resultPadrao4a6 = adapter.parse(rawRows, {
      lessonMin: 4,
      lessonMax: 6,
      allLessons: false,
    });
    expect(resultPadrao4a6.eligibleItems).toHaveLength(0);
    expect(resultPadrao4a6.filteredOutLessonsCount).toBe(1);

    // Com o ajuste para faixa a partir da aula 2 ou 3:
    const resultFaixaAjustada = adapter.parse(rawRows, {
      lessonMin: 2,
      lessonMax: 6,
      allLessons: false,
    });
    expect(resultFaixaAjustada.eligibleItems).toHaveLength(1);
    expect(resultFaixaAjustada.eligibleItems[0].studentName).toBe('MIGUEL ANTÔNIO GUERRA');
  });

  it('deve estruturar exportação Excel com abas Apostilas Físicas e Apenas Código', () => {
    const order: any = {
      id: 'ord_1',
      title: 'ENTREGA DE MATERIAL - 1º PEDIDO OUTUBRO',
      competence_month: 10,
      competence_year: 2026,
    };

    const items: any[] = [
      {
        student_name: 'JOÃO SILVA',
        subject_name: 'Windows 11',
        educator_name: 'Malone de Souza',
        isOnlyCode: false,
      },
      {
        student_name: 'DOUGLAS HENRIQUE',
        subject_name: 'Adobe Illustrator',
        educator_name: 'Malone de Souza',
        codigoApostila: 'A2581125PTO200023514',
        isOnlyCode: true,
      },
    ];

    const wb = buildOrderWorkbook(order, items);
    expect(wb).toBeDefined();
    expect(wb.SheetNames).toContain('Apostilas Físicas');
    expect(wb.SheetNames).toContain('Apenas Código');

    // Verifica que a aba Apenas Código contém Douglas Henrique e seu código
    const wsCode = wb.Sheets['Apenas Código'];
    expect(wsCode).toBeDefined();
    expect(wsCode['B5'].v).toBe('DOUGLAS HENRIQUE');
    expect(wsCode['G5'].v).toBe('A2581125PTO200023514');
  });
});
