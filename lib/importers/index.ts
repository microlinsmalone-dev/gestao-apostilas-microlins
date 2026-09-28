// ==============================================================================
// GESTÃO DE APOSTILAS - MICROLINS POTIRENDABA
// Importers: lib/importers/index.ts
// Orquestrador de importação com detecção de layout e processamento universal
// ==============================================================================

import * as XLSX from 'xlsx';
import { ImportAdapter, ImportOptions, ImportParseResult } from './types';
import { ApostilaDeliveryImportAdapter } from './apostila-delivery';
import { PedagogicalControlImportAdapter } from './pedagogical-control';

export * from './types';
export * from './apostila-delivery';
export * from './pedagogical-control';
export * from './base-contratos';
export * from './controle-pedagogico-complementar';

const adapters: ImportAdapter[] = [
  new ApostilaDeliveryImportAdapter(),
  new PedagogicalControlImportAdapter(),
];

/**
 * Lê o buffer de um arquivo (.xls, .xlsx, .csv) e executa o adaptador compatível
 */
export function parseSpreadsheetBuffer(
  buffer: ArrayBuffer | Uint8Array,
  options: ImportOptions
): ImportParseResult & { rawRows: Record<string, unknown>[] } {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('O arquivo enviado não contém nenhuma planilha.');
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });

  if (rawData.length === 0) {
    throw new Error('A planilha está vazia.');
  }

  const headers = Object.keys(rawData[0]);
  const matchedAdapter = adapters.find(a => a.canHandle(headers));

  if (!matchedAdapter) {
    throw new Error(
      `Formato de relatório não reconhecido. Cabeçalhos encontrados: ${headers.join(', ')}. ` +
      'Certifique-se de enviar o "Relatório de Entrega de Apostila" ou "Controle Pedagógico".'
    );
  }

  const result = matchedAdapter.parse(rawData, options);
  return { ...result, rawRows: rawData };
}

/**
 * Processa linhas brutas já carregadas em memória aplicando novos filtros sem necessitar de re-upload
 */
export function parseSpreadsheetRows(
  rawData: Record<string, unknown>[],
  options: ImportOptions
): ImportParseResult & { rawRows: Record<string, unknown>[] } {
  if (!rawData || rawData.length === 0) {
    throw new Error('A lista de registros está vazia.');
  }

  const headers = Object.keys(rawData[0]);
  const matchedAdapter = adapters.find(a => a.canHandle(headers));

  if (!matchedAdapter) {
    throw new Error(
      `Formato de relatório não reconhecido. Cabeçalhos encontrados: ${headers.join(', ')}.`
    );
  }

  const result = matchedAdapter.parse(rawData, options);
  return { ...result, rawRows: rawData };
}
