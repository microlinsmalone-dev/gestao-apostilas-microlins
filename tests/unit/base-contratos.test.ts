import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  parseBaseContratosBuffer,
  buildContractBaseAnalysis,
  lookupEducatorInBase,
} from '../../lib/importers/base-contratos';

describe('Base de Contratos - Mapeamento e Cruzamento de Educadores', () => {
  it('deve indexar e cruzar registros corretamente por contrato e nome', () => {
    const rawRows = [
      {
        Nome: 'Adrian da Silva Souza',
        Educador: 'Antonio Fagner dos Santos Silva',
        Contrato: '5088581',
        Formações: '26760_INFORMÁTICA ESSENCIAL [DINÂMICA]',
        'Tipo Contrato': 'Bolsista',
      },
      {
        Nome: 'Adrian da Silva Souza',
        Educador: 'Malone de Souza',
        Contrato: '5100508',
        Formações: '26801_DESENVOLVIMENTO DE GAMES [DINÂMICA]',
        'Tipo Contrato': 'Normal',
      },
      {
        Nome: 'Alexia Valentina de Assis Silva',
        Educador: 'Maria Eduarda Gaglianone',
        Contrato: '5100063',
        Formações: 'Annual Book',
        'Tipo Contrato': 'Normal',
      },
    ];

    const base = buildContractBaseAnalysis(rawRows);
    expect(base.entries.length).toBe(3);
    expect(base.educators).toEqual([
      'Antonio Fagner dos Santos Silva',
      'Malone de Souza',
      'Maria Eduarda Gaglianone',
    ]);

    // 1. Busca exata por contrato
    expect(
      lookupEducatorInBase(
        { studentName: 'Adrian da Silva Souza', contractNumber: '5088581' },
        base
      )
    ).toBe('Antonio Fagner dos Santos Silva');

    expect(
      lookupEducatorInBase(
        { studentName: 'Adrian da Silva Souza', contractNumber: '5100508' },
        base
      )
    ).toBe('Malone de Souza');

    // 2. Busca por nome (aluno único)
    expect(
      lookupEducatorInBase(
        { studentName: 'Alexia Valentina de Assis Silva' },
        base
      )
    ).toBe('Maria Eduarda Gaglianone');

    // 3. Busca por nome com desempate por curso
    expect(
      lookupEducatorInBase(
        { studentName: 'Adrian da Silva Souza', courseName: 'DESENVOLVIMENTO DE GAMES' },
        base
      )
    ).toBe('Malone de Souza');
  });

  it('deve carregar com sucesso o arquivo real Análise Base de Contratos.xls se existir', () => {
    const filePath = path.resolve(process.cwd(), 'Análise Base de Contratos.xls');
    if (fs.existsSync(filePath)) {
      const buffer = fs.readFileSync(filePath);
      const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
      const base = parseBaseContratosBuffer(arrayBuffer);

      expect(base.totalRows).toBeGreaterThan(200);
      expect(base.educators).toContain('Malone de Souza');
      expect(base.educators).toContain('Antonio Fagner dos Santos Silva');
      expect(base.educators).toContain('Maria Eduarda Gaglianone');

      // Testa cruzamento de um contrato real do arquivo
      const educator = lookupEducatorInBase(
        { studentName: 'Adrian da Silva Souza', contractNumber: '5100508' },
        base
      );
      expect(educator).toBe('Malone de Souza');
    }
  });

  it('deve filtrar Status Matéria Ativo e cruzar 100% dos alunos elegíveis no relatório real', async () => {
    const { parseSpreadsheetBuffer } = await import('../../lib/importers');
    const baseFilePath = path.resolve(process.cwd(), 'Análise Base de Contratos.xls');
    const delivFilePath = path.resolve(process.cwd(), 'SistemaAntigo/Modelo Real de Entrega de Apostila.xls');

    if (fs.existsSync(baseFilePath) && fs.existsSync(delivFilePath)) {
      const baseBuffer = fs.readFileSync(baseFilePath);
      const base = parseBaseContratosBuffer(
        baseBuffer.buffer.slice(baseBuffer.byteOffset, baseBuffer.byteOffset + baseBuffer.byteLength)
      );

      const delivBuffer = fs.readFileSync(delivFilePath);
      const parsed = parseSpreadsheetBuffer(
        delivBuffer.buffer.slice(delivBuffer.byteOffset, delivBuffer.byteOffset + delivBuffer.byteLength),
        {
          lessonMin: 4,
          lessonMax: 6,
          allLessons: false,
          ignoredSubjects: ['Digitação', 'Digitacao'],
          excludedContractTypes: ['Bolsista'],
        }
      );

      // Garante que matérias não-ativas foram filtradas
      expect(parsed.eligibleItems.length).toBe(33);

      // Garante que todos os alunos elegíveis foram cruzados com os educadores
      let matchedCount = 0;
      parsed.eligibleItems.forEach((item) => {
        const ed = lookupEducatorInBase(
          {
            studentName: item.studentName,
            contractNumber: item.contractNumber,
            courseName: item.courseName,
            rawSubjectName: item.rawSubjectName,
          },
          base
        );
        if (ed) matchedCount++;
      });

      // 33 de 33 alunos cruzados com sucesso (100%)
      expect(matchedCount).toBe(33);
    }
  });
});
