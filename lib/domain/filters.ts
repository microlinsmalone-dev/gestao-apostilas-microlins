// ==============================================================================
// GESTÃO DE APOSTILAS - MICROLINS POTIRENDABA
// Domain Service: lib/domain/filters.ts
// Regras de negócio de elegibilidade, exclusão de educadores e exclusão de matérias
// ==============================================================================

import { normalizeText } from './sanitizer';

export interface ContractFilterParams {
  statusContrato?: string;
  inadimplente?: string;
  entregaFisica?: string;
  tipoContrato?: string;
}

/**
 * Valida se o aluno atende aos critérios operacionais de contrato
 */
export function isEligibleContract(
  params: ContractFilterParams,
  expectedStatus = 'Ativo',
  expectedDelinquent = 'Não',
  expectedDelivery = 'Não',
  excludedContractType = 'Bolsista'
): boolean {
  const statusNorm = normalizeText(params.statusContrato);
  const expStatusNorm = normalizeText(expectedStatus);
  const inadNorm = normalizeText(params.inadimplente);
  const entFisNorm = normalizeText(params.entregaFisica);
  const tipoNorm = normalizeText(params.tipoContrato);
  const exclTipoNorm = normalizeText(excludedContractType);

  // Status de contrato deve ser Ativo
  if (statusNorm !== expStatusNorm) {
    return false;
  }

  // Não pode ser inadimplente ('Não', 'nao', 'n' ou vazio são válidos)
  const isNotDelinquent = inadNorm === 'nao' || inadNorm === 'n' || inadNorm === '';
  if (!isNotDelinquent && inadNorm !== normalizeText(expectedDelinquent)) {
    return false;
  }

  // Não pode ter tido entrega física prévia ('Não', 'nao', 'n' ou vazio são válidos)
  const isNotDelivered = entFisNorm === 'nao' || entFisNorm === 'n' || entFisNorm === '';
  if (!isNotDelivered && entFisNorm !== normalizeText(expectedDelivery)) {
    return false;
  }

  // Contrato do tipo Bolsista deve ser excluído
  if (tipoNorm.includes(exclTipoNorm)) {
    return false;
  }

  return true;
}

/**
 * Verifica se o aluno é um educador/funcionário cadastrado a ser ignorado
 */
export function isEducatorIgnored(studentName: string, ignoredEducators: string[]): boolean {
  if (!studentName) return false;
  const studentNorm = normalizeText(studentName);

  for (const educator of ignoredEducators) {
    const educNorm = normalizeText(educator);
    if (!educNorm) continue;
    if (studentNorm === educNorm || studentNorm.includes(educNorm) || educNorm.includes(studentNorm)) {
      return true;
    }
  }

  return false;
}

/**
 * Verifica se a matéria ou o curso corresponde a itens a ignorar (ex: Digitação)
 */
export function isSubjectIgnored(
  subjectName: string,
  courseName?: string,
  ignoredSubjects = ['Digitação', 'Digitacao']
): boolean {
  const subjNorm = normalizeText(subjectName);
  const courseNorm = normalizeText(courseName || '');

  for (const item of ignoredSubjects) {
    const itemNorm = normalizeText(item);
    if (!itemNorm) continue;
    if (subjNorm.includes(itemNorm) || courseNorm.includes(itemNorm)) {
      return true;
    }
  }

  return false;
}

/**
 * Verifica se a aula do aluno se enquadra na faixa selecionada
 */
export function isLessonInRange(lesson: number, min = 4, max = 6, allLessons = false): boolean {
  if (allLessons) return true;
  return lesson >= min && lesson <= max;
}
