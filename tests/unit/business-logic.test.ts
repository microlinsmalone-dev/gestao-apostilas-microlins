// ==============================================================================
// GESTÃO DE APOSTILAS - MICROLINS POTIRENDABA
// Test: tests/unit/business-logic.test.ts
// Testes unitários das regras de negócio (espelho exato do test_business_logic.py)
// ==============================================================================

import { describe, it, expect } from 'vitest';
import { cleanSubject, normalizeText, formatOrderTitle } from '../../lib/domain/sanitizer';
import { isEducatorIgnored, isSubjectIgnored, isEligibleContract, isLessonInRange } from '../../lib/domain/filters';
import { createDuplicateFingerprint, analyzeDuplicates } from '../../lib/domain/duplicates';
import { ApostilaDeliveryImportAdapter } from '../../lib/importers/apostila-delivery';
import { ProcessedStudentItem } from '../../types';

describe('1. Sanitização e Título', () => {
  it('deve remover prefixo de código da matéria mantendo o restante intacto', () => {
    expect(cleanSubject('161869_Windows 11')).toBe('Windows 11');
    expect(cleanSubject('878_Redes - Tecnologias Wireless')).toBe('Redes - Tecnologias Wireless');
    expect(cleanSubject('Microsoft Word 2016')).toBe('Microsoft Word 2016');
  });

  it('deve normalizar texto sem acentos e em minúsculas', () => {
    expect(normalizeText('João da Silva')).toBe('joao da silva');
    expect(normalizeText('DIGITAÇÃO')).toBe('digitacao');
    expect(normalizeText('  Espaços   Múltiplos  ')).toBe('espacos multiplos');
  });

  it('deve preservar exatamente maiúsculas e minúsculas do título digitado', () => {
    const titles = [
      'setembro 3',
      'ENTREGA DE MATERIAL - 1º PEDIDO SETEMBRO',
      'Entrega de Apostilas - Turma A',
    ];
    titles.forEach((t) => {
      expect(formatOrderTitle(t)).toBe(t);
    });
  });
});

describe('2. Filtros de Negócio e Exclusões', () => {
  const educators = [
    'Malone de Souza',
    'Antonio Fagner dos Santos Silva',
    'Pyetra Alves Vieira de Oliveira',
    'Andrey',
  ];

  it('deve identificar educadores cadastrados para exclusão', () => {
    expect(isEducatorIgnored('Malone de Souza', educators)).toBe(true);
    expect(isEducatorIgnored('malone', educators)).toBe(true);
    expect(isEducatorIgnored('Pyetra Alves', educators)).toBe(true);
    expect(isEducatorIgnored('João Silva', educators)).toBe(false);
  });

  it('deve identificar matérias de Digitação para exclusão', () => {
    expect(isSubjectIgnored('161869_Digitação')).toBe(true);
    expect(isSubjectIgnored('Digitacao Avançada')).toBe(true);
    expect(isSubjectIgnored('DIGITACAO')).toBe(true);
    expect(isSubjectIgnored('Windows 11', 'Curso de Digitação')).toBe(true);
    expect(isSubjectIgnored('Windows 11', 'Operador de Micro')).toBe(false);
  });

  it('deve validar regras de contrato (Ativo, Não inadimplente, Não entregue, Não Bolsista)', () => {
    expect(
      isEligibleContract({
        statusContrato: 'Ativo',
        inadimplente: 'Não',
        entregaFisica: 'Não',
        tipoContrato: 'Dinâmica',
      })
    ).toBe(true);

    // Rejeita Inativo
    expect(
      isEligibleContract({
        statusContrato: 'Inativo',
        inadimplente: 'Não',
        entregaFisica: 'Não',
        tipoContrato: 'Dinâmica',
      })
    ).toBe(false);

    // Rejeita Inadimplente
    expect(
      isEligibleContract({
        statusContrato: 'Ativo',
        inadimplente: 'Sim',
        entregaFisica: 'Não',
        tipoContrato: 'Dinâmica',
      })
    ).toBe(false);

    // Rejeita Bolsista
    expect(
      isEligibleContract({
        statusContrato: 'Ativo',
        inadimplente: 'Não',
        entregaFisica: 'Não',
        tipoContrato: 'Bolsista 100%',
      })
    ).toBe(false);
  });

  it('deve filtrar faixa de aulas corretamente', () => {
    expect(isLessonInRange(4, 4, 6, false)).toBe(true);
    expect(isLessonInRange(5, 4, 6, false)).toBe(true);
    expect(isLessonInRange(6, 4, 6, false)).toBe(true);
    expect(isLessonInRange(2, 4, 6, false)).toBe(false);
    expect(isLessonInRange(8, 4, 6, false)).toBe(false);
    expect(isLessonInRange(16, 4, 6, true)).toBe(true); // allLessons = true
  });
});

describe('3. Detecção de Duplicidades', () => {
  it('deve gerar fingerprint determinístico para aluno e matéria', () => {
    const fp1 = createDuplicateFingerprint('João da Silva', '161869_Windows 11');
    const fp2 = createDuplicateFingerprint('joao da silva', '161869_windows 11');
    expect(fp1).toBe(fp2);
  });

  it('deve detectar duplicidades internas e históricas', () => {
    const mockItems: ProcessedStudentItem[] = [
      {
        id: '1',
        studentName: 'Lucas Ferreira',
        studentNameNormalized: 'lucas ferreira',
        subjectName: 'Excel Avançado',
        subjectNameNormalized: 'excel avancado',
        rawSubjectName: '161870_Excel Avançado',
        currentLesson: 5,
        duplicateFingerprint: 'lucas ferreira|||excel avancado',
        isInternalDuplicate: false,
        isHistoricalDuplicate: false,
        isExcluded: false,
        sourceRowNumber: 2,
      },
      {
        id: '2',
        studentName: 'Lucas Ferreira',
        studentNameNormalized: 'lucas ferreira',
        subjectName: 'Excel Avançado', // Repetido no mesmo pedido (duplicidade interna)
        subjectNameNormalized: 'excel avancado',
        rawSubjectName: '161870_Excel Avançado',
        currentLesson: 5,
        duplicateFingerprint: 'lucas ferreira|||excel avancado',
        isInternalDuplicate: false,
        isHistoricalDuplicate: false,
        isExcluded: false,
        sourceRowNumber: 3,
      },
      {
        id: '3',
        studentName: 'Mariana Lima',
        studentNameNormalized: 'mariana lima',
        subjectName: 'Windows 11', // Consta no histórico
        subjectNameNormalized: 'windows 11',
        rawSubjectName: 'Windows 11',
        currentLesson: 4,
        duplicateFingerprint: 'mariana lima|||windows 11',
        isInternalDuplicate: false,
        isHistoricalDuplicate: false,
        isExcluded: false,
        sourceRowNumber: 4,
      },
    ];

    const historicalMap = new Map<string, string>();
    historicalMap.set('mariana lima|||windows 11', 'ENTREGA DE MATERIAL - AGOSTO');

    const result = analyzeDuplicates(mockItems, historicalMap);

    expect(result.internalDuplicatesCount).toBe(1);
    expect(result.historicalDuplicatesCount).toBe(1);
    expect(result.items[1].isInternalDuplicate).toBe(true);
    expect(result.items[2].isHistoricalDuplicate).toBe(true);
    expect(result.items[2].historicalMatchOrderTitle).toBe('ENTREGA DE MATERIAL - AGOSTO');
  });
});

describe('4. Adaptador de Importação e Caso Real (Ana Clara)', () => {
  it('deve processar linhas respeitando a curadoria de múltiplas matérias e exclusão de Digitação', () => {
    const adapter = new ApostilaDeliveryImportAdapter();
    const rawRows = [
      {
        'Aluno': 'Ana Clara da Silva Sousa',
        'Status Contrato': 'Ativo',
        'Inadimplente': 'Não',
        'Entrega Física': 'Não',
        'Tipo Contrato': 'Dinâmica',
        'Aula Atual': 5,
        'Matéria': '161800_Auxiliar Odontológico - Saúde Bucal',
        'Formação': 'CAPACITAÇÃO',
      },
      {
        'Aluno': 'Ana Clara da Silva Sousa',
        'Status Contrato': 'Ativo',
        'Inadimplente': 'Não',
        'Entrega Física': 'Não',
        'Tipo Contrato': 'Dinâmica',
        'Aula Atual': 4,
        'Matéria': '161801_Operador de Caixa',
        'Formação': 'CAPACITAÇÃO',
      },
      {
        'Aluno': 'Ana Clara da Silva Sousa',
        'Status Contrato': 'Ativo',
        'Inadimplente': 'Não',
        'Entrega Física': 'Não',
        'Tipo Contrato': 'Dinâmica',
        'Aula Atual': 4,
        'Matéria': '161802_Digitação', // Deve ser ignorado
        'Formação': 'CAPACITAÇÃO',
      },
      {
        'Aluno': 'Malone de Souza', // Deve ser ignorado por ser educador
        'Status Contrato': 'Ativo',
        'Inadimplente': 'Não',
        'Entrega Física': 'Não',
        'Tipo Contrato': 'Dinâmica',
        'Aula Atual': 5,
        'Matéria': '161869_Windows 11',
      },
    ];

    const result = adapter.parse(rawRows, {
      ignoredEducators: ['Malone de Souza'],
      lessonMin: 4,
      lessonMax: 6,
    });

    expect(result.filteredOutSubjectsCount).toBe(1); // Digitação
    expect(result.filteredOutEducatorsCount).toBe(1); // Malone de Souza
    expect(result.eligibleItems.length).toBe(2);

    const subjects = result.eligibleItems.map(i => i.subjectName);
    expect(subjects).toContain('Auxiliar Odontológico - Saúde Bucal');
    expect(subjects).toContain('Operador de Caixa');
    expect(subjects).not.toContain('Digitação');
  });

  it('deve processar corretamente itens manuais de listas impressas', () => {
    const rawStudent = '  Carlos Eduardo Lima  ';
    const rawSubject = '161869_Excel 2021';

    const normalizedStudent = normalizeText(rawStudent);
    const cleanedSubject = cleanSubject(rawSubject);
    const normalizedSubject = normalizeText(cleanedSubject);
    const fp = createDuplicateFingerprint(rawStudent, cleanedSubject);

    expect(normalizedStudent).toBe('carlos eduardo lima');
    expect(cleanedSubject).toBe('Excel 2021');
    expect(normalizedSubject).toBe('excel 2021');
    expect(fp).toBe('carlos eduardo lima|||excel 2021');
  });
});
