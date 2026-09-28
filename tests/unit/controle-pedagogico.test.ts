// ==============================================================================
// GESTÃO DE APOSTILAS - MICROLINS POTIRENDABA
// Test: tests/unit/controle-pedagogico.test.ts
// Testes unitários do Controle Pedagógico e Sanitização de Primeiro Nome
// ==============================================================================

import { describe, it, expect } from 'vitest';
import { toFirstName } from '../../lib/domain/sanitizer';
import {
  buildPedagogicalScheduleAnalysis,
  lookupPedagogicalSchedule,
  enrichItemsWithPedagogicalSchedule
} from '../../lib/importers/controle-pedagogico-complementar';
import { ProcessedStudentItem } from '../../types';

describe('Sanitização: toFirstName', () => {
  it('deve extrair apenas o primeiro nome de nomes completos', () => {
    expect(toFirstName('Andrey Henrique de Arruda Rosaboni')).toBe('Andrey');
    expect(toFirstName('Antonio Fagner dos Santos Silva')).toBe('Antonio');
    expect(toFirstName('Malone de Souza')).toBe('Malone');
    expect(toFirstName('Pyetra Alves Vieira de Oliveira')).toBe('Pyetra');
  });

  it('deve lidar com nomes simples ou espaços vazios', () => {
    expect(toFirstName('Andrey')).toBe('Andrey');
    expect(toFirstName('  Malone  ')).toBe('Malone');
    expect(toFirstName('')).toBe('');
    expect(toFirstName(null)).toBe('');
    expect(toFirstName(undefined)).toBe('');
  });
});

describe('Controle Pedagógico Complementar (Próxima Matéria, Turma e Horário)', () => {
  const mockEntries = [
    {
      studentName: 'Gabriel Henrique Silva',
      contractNumber: '12345',
      nextSubject: 'Photoshop CC',
      classSchedule: 'Sábado 08:00 às 10:00',
      scheduledDay: 'Sábado',
      scheduledTime: '08:00 às 10:00',
      phone: '(17) 99999-1111',
    },
    {
      studentName: 'Ana Clara Souza',
      contractNumber: '67890',
      nextSubject: 'Excel Avançado',
      classSchedule: 'Quarta-feira 14:00 às 16:00',
      scheduledDay: 'Quarta-feira',
      scheduledTime: '14:00 às 16:00',
      phone: '(17) 98888-2222',
    },
  ];

  it('deve construir o índice por nome normalizado e por contrato', () => {
    const analysis = buildPedagogicalScheduleAnalysis(mockEntries);

    expect(analysis.totalRows).toBe(2);
    expect(analysis.byContract.has('12345')).toBe(true);
    expect(analysis.byContract.has('67890')).toBe(true);
    expect(analysis.byName.has('gabriel henrique silva')).toBe(true);
    expect(analysis.byName.has('ana clara souza')).toBe(true);
  });

  it('deve encontrar horários e próxima matéria por contrato e por nome', () => {
    const analysis = buildPedagogicalScheduleAnalysis(mockEntries);

    // Por contrato
    const match1 = lookupPedagogicalSchedule('Gabriel H. Silva', '12345', analysis);
    expect(match1).not.toBeNull();
    expect(match1?.nextSubject).toBe('Photoshop CC');
    expect(match1?.classSchedule).toBe('Sábado (08:00 às 10:00)');

    // Por nome (quando contrato não bate ou não fornecido)
    const match2 = lookupPedagogicalSchedule('Ana Clara Souza', undefined, analysis);
    expect(match2).not.toBeNull();
    expect(match2?.nextSubject).toBe('Excel Avançado');
    expect(match2?.classSchedule).toBe('Quarta-feira (14:00 às 16:00)');
  });

  it('deve enriquecer os itens da Entrega de Apostilas sem alterar as matérias atuais', () => {
    const analysis = buildPedagogicalScheduleAnalysis(mockEntries);

    const items: ProcessedStudentItem[] = [
      {
        id: '1',
        sourceRowNumber: 1,
        studentName: 'Gabriel Henrique Silva',
        studentNameNormalized: 'gabriel henrique silva',
        subjectName: 'Illustrator CC',
        subjectNameNormalized: 'illustrator cc',
        rawSubjectName: '123_Illustrator CC',
        currentLesson: 4,
        contractNumber: '12345',
        duplicateFingerprint: 'gabriel_illustrator',
        isInternalDuplicate: false,
        isHistoricalDuplicate: false,
        isExcluded: false,
      },
      {
        id: '2',
        sourceRowNumber: 2,
        studentName: 'Carlos Eduardo',
        studentNameNormalized: 'carlos eduardo',
        subjectName: 'Word',
        subjectNameNormalized: 'word',
        rawSubjectName: 'Word',
        currentLesson: 5,
        duplicateFingerprint: 'carlos_word',
        isInternalDuplicate: false,
        isHistoricalDuplicate: false,
        isExcluded: false,
      },
    ];

    const result = enrichItemsWithPedagogicalSchedule(items, analysis);

    expect(result.matchedCount).toBe(1);
    expect(result.items[0].nextSubject).toBe('Photoshop CC');
    expect(result.items[0].classSchedule).toBe('Sábado (08:00 às 10:00)');
    expect(result.items[0].phone).toBe('(17) 99999-1111');
    expect(result.items[0].subjectName).toBe('Illustrator CC'); // Não altera a apostila atual

    // Segundo aluno não estava no controle pedagógico
    expect(result.items[1].nextSubject).toBeUndefined();
    expect(result.items[1].classSchedule).toBeUndefined();
  });
});

describe('Detecção de Duplicidades em Modo Edição', () => {
  interface HistoricalEntry {
    orderId: string;
    orderTitle: string;
    educatorName?: string | null;
  }

  const historicalMap = new Map<string, HistoricalEntry[]>([
    [
      'kevyn lucas pereira|||windows 11',
      [
        {
          orderId: 'order-pedido-2',
          orderTitle: 'ENTREGA DE MATERIAL - 2º PEDIDO SETEMBRO',
          educatorName: 'Antonio Fagner dos Santos Silva',
        },
      ],
    ],
    [
      'georlando vicente lopes|||excel 2021',
      [
        {
          orderId: 'order-pedido-1',
          orderTitle: 'ENTREGA DE MATERIAL - 1º PEDIDO SETEMBRO',
          educatorName: 'Malone de Souza',
        },
        {
          orderId: 'order-pedido-2',
          orderTitle: 'ENTREGA DE MATERIAL - 2º PEDIDO SETEMBRO',
          educatorName: 'Antonio Fagner dos Santos Silva',
        },
      ],
    ],
  ]);

  it('não deve apontar duplicidade histórica para o próprio pedido que está sendo editado', () => {
    const currentOrderId = 'order-pedido-2';
    const fp = 'kevyn lucas pereira|||windows 11';

    const allMatches = historicalMap.get(fp) || [];
    const otherOrders = allMatches.filter((entry) => entry.orderId !== currentOrderId);

    // Como o único registro no histórico é do próprio pedido que estamos editando, não deve duplicar
    expect(otherOrders.length).toBe(0);
  });

  it('deve apontar duplicidade histórica e extrair o primeiro nome do educador se o registro for de OUTRO pedido', () => {
    const currentOrderId = 'order-pedido-2';
    const fp = 'georlando vicente lopes|||excel 2021';

    const allMatches = historicalMap.get(fp) || [];
    const otherOrders = allMatches.filter((entry) => entry.orderId !== currentOrderId);

    // O registro de order-pedido-1 é de outro pedido, então deve ser apontado
    expect(otherOrders.length).toBe(1);
    expect(otherOrders[0].orderTitle).toBe('ENTREGA DE MATERIAL - 1º PEDIDO SETEMBRO');
    expect(toFirstName(otherOrders[0].educatorName)).toBe('Malone');
  });
});

