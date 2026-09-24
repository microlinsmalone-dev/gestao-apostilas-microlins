// ==============================================================================
// GESTÃO DE APOSTILAS - MICROLINS POTIRENDABA
// Domain Service: lib/domain/sanitizer.ts
// Higienização de matérias e normalização unificada de textos
// ==============================================================================

/**
 * Remove códigos numéricos de prefixo com sublinhado (ex: "161869_Windows 11" -> "Windows 11")
 * Preserva integralmente maiúsculas, minúsculas e pontuação interna.
 */
export function cleanSubject(subject: string | null | undefined): string {
  if (!subject || typeof subject !== 'string') return '';
  return subject.replace(/^\d+_\s*/, '').trim();
}

/**
 * Normaliza textos para comparação e busca insensíveis a acentos, caixa alta e espaçamentos múltiplos.
 */
export function normalizeText(text: string | null | undefined): string {
  if (!text || typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Preserva o título do pedido exatamente como fornecido pelo operador (sem toUpperCase forçado)
 */
export function formatOrderTitle(title: string | null | undefined, defaultTitle = 'ENTREGA DE MATERIAL - PEDIDO'): string {
  if (!title || typeof title !== 'string') return defaultTitle;
  const trimmed = title.trim();
  return trimmed || defaultTitle;
}
