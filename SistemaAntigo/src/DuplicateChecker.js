/**
 * ==============================================================================
 * GESTÃO DE APOSTILAS - MICROLINS
 * Arquivo: DuplicateChecker.js
 * Descrição: Motor de identificação de apostilas repetidas (no pedido atual e no histórico)
 * ==============================================================================
 */

/**
 * Função acionada pelo menu para verificar duplicidades na folha ativa
 */
function verificarDuplicidadesAtual() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = (typeof obterAbaPedidoAtiva === 'function')
    ? obterAbaPedidoAtiva()
    : ss.getActiveSheet();

  const nomeDash = CONFIG.SHEETS.DASHBOARD || 'Dashboard';
  const NOMES_SISTEMA = [CONFIG.SHEETS.BD_HISTORICO, CONFIG.SHEETS.CONFIGURACOES, nomeDash];

  if (!sheet || NOMES_SISTEMA.includes(sheet.getName()) || sheet.getLastRow() < 5) {
    SpreadsheetApp.getUi().alert(
      'Verificação de Duplicidades',
      'Nenhuma folha de pedido aberta com registros para verificar duplicidades.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    return;
  }

  const duplicidades = verificarDuplicidadesFolha(sheet);

  if (duplicidades.length === 0) {
    const props = PropertiesService.getDocumentProperties();
    const editandoId = props.getProperty('EDITANDO_ID_PEDIDO');
    const msg = editandoId
      ? 'Nenhuma duplicidade encontrada na folha em edição.\n\nℹ️ Os registros originais deste pedido foram desconsiderados da análise para evitar falsos positivos.'
      : 'Nenhuma duplicidade encontrada na lista atual.';
    SpreadsheetApp.getUi().alert('Verificação de Duplicidades', msg, SpreadsheetApp.getUi().ButtonSet.OK);
  } else {
    abrirDialogoDuplicidades(duplicidades);
  }
}

/**
 * Executa a análise profunda de duplicidades comparando com o pedido atual e o banco histórico
 * @param {Sheet} sheet - Aba do Google Sheets
 * @param {string} [idPedidoIgnorar] - ID opcional de pedido a desconsiderar da checagem (ex: pedido que está sendo editado)
 * @returns {Array<Object>} Lista de duplicidades encontradas
 */
function verificarDuplicidadesFolha(sheet, idPedidoIgnorar) {
  const ultimaLinha = sheet.getLastRow();
  if (ultimaLinha < 5) return [];

  // Lê todas as linhas preenchidas da coluna Aluno (A) e Matéria (B)
  const rangeDados = sheet.getRange(5, 1, ultimaLinha - 4, 2);
  const valores = rangeDados.getValues();

  // Identifica se a folha está em modo de edição de um pedido do histórico
  const props = PropertiesService.getDocumentProperties();
  let idIgnorar = idPedidoIgnorar || props.getProperty('EDITANDO_ID_PEDIDO') || '';
  const tituloEditando = props.getProperty('EDITANDO_TITULO_PEDIDO') || '';

  // Se a aba for uma aba de backup físico, ignora o próprio ID correspondente
  const nomeAba = sheet.getName();
  if (!idIgnorar && (nomeAba.startsWith('Bkp_') || nomeAba.startsWith('Backup_'))) {
    idIgnorar = 'PED_BKP_' + nomeAba.replace(/[^a-zA-Z0-9_]/g, '');
  }

  // Carrega a base consolidada de histórico, omitindo os registros do pedido que está sendo editado
  const historico = (typeof carregarHistoricoConsolidado === 'function')
    ? carregarHistoricoConsolidado(idIgnorar)
    : new Map();

  const duplicidades = [];
  const registrosLocaisVistos = new Map();
  const totalLinhas = valores.length;

  const bgs = Array.from({ length: totalLinhas }, () => new Array(6).fill('#ffffff'));
  const colors = Array.from({ length: totalLinhas }, () => new Array(6).fill('#000000'));
  const notes = Array.from({ length: totalLinhas }, () => ['']);
  let houveAlteracao = false;

  const fnNorm = (typeof normalizarTexto === 'function')
    ? normalizarTexto
    : ((str) => String(str || '').toLowerCase().trim());

  for (let i = 0; i < totalLinhas; i++) {
    const numLinha = 5 + i;
    const aluno = String(valores[i][0] || '').trim();
    const materia = String(valores[i][1] || '').trim();

    // Linha em branco (pula)
    if (!aluno || !materia) continue;

    const chave = `${fnNorm(aluno)}|||${fnNorm(materia)}`;

    // 1. Checagem Interna (duplicado dentro da própria folha)
    if (registrosLocaisVistos.has(chave)) {
      const linhaAnterior = registrosLocaisVistos.get(chave);
      const motivo = `Repetido neste pedido (Linha ${linhaAnterior})`;
      duplicidades.push({
        linha: numLinha,
        aluno: aluno,
        materia: materia,
        tipo: 'interno',
        origem: `Mesmo pedido (Linha ${linhaAnterior})`,
        dataOrigem: 'Hoje'
      });
      bgs[i].fill(CONFIG.ESTILOS.DUPLICATE_BG);
      colors[i].fill(CONFIG.ESTILOS.DUPLICATE_TEXT);
      notes[i][0] = `Duplicidade identificada:\n${motivo}`;
      houveAlteracao = true;
      continue;
    }
    registrosLocaisVistos.set(chave, numLinha);

    // 2. Checagem Histórica (já pedido em pedidos anteriores no banco)
    if (historico.has(chave)) {
      const itemHistorico = historico.get(chave);

      // Trava de segurança: se o item corresponder ao próprio pedido em edição, ignora!
      if (idIgnorar && (itemHistorico.idPedido === idIgnorar || String(itemHistorico.idPedido).includes(idIgnorar))) {
        continue;
      }
      if (tituloEditando && itemHistorico.tituloPedido && itemHistorico.tituloPedido.toLowerCase() === tituloEditando.toLowerCase()) {
        continue;
      }

      const motivo = `Já solicitado em "${itemHistorico.tituloPedido}" (${itemHistorico.dataArquivo})`;
      duplicidades.push({
        linha: numLinha,
        aluno: aluno,
        materia: materia,
        tipo: 'historico',
        origem: itemHistorico.tituloPedido || 'Pedido Anterior',
        dataOrigem: itemHistorico.dataArquivo || 'Data desconhecida'
      });
      bgs[i].fill(CONFIG.ESTILOS.DUPLICATE_BG);
      colors[i].fill(CONFIG.ESTILOS.DUPLICATE_TEXT);
      notes[i][0] = `Duplicidade identificada:\n${motivo}`;
      houveAlteracao = true;
    }
  }

  // Aplica estilos e notas em lote único para altíssima performance
  const rangeTotal = sheet.getRange(5, 1, totalLinhas, 6);
  rangeTotal.setBackgrounds(bgs);
  rangeTotal.setFontColors(colors);
  sheet.getRange(5, 1, totalLinhas, 1).setNotes(notes);

  return duplicidades;
}

/**
 * Destaca visualmente a linha duplicada com fundo vermelho suave e nota explicativa
 */
function destacarLinhaDuplicada(sheet, linha, motivo) {
  const range = sheet.getRange(linha, 1, 1, 6);
  range.setBackground(CONFIG.ESTILOS.DUPLICATE_BG);
  range.setFontColor(CONFIG.ESTILOS.DUPLICATE_TEXT);
  sheet.getRange(linha, 1).setNote(`Duplicidade identificada:\n${motivo}`);
}

/**
 * Remove o destaque visual de uma linha
 */
function limparDestaqueLinha(sheet, linha) {
  const range = sheet.getRange(linha, 1, 1, 6);
  range.setBackground('#ffffff');
  range.setFontColor('#000000');
  sheet.getRange(linha, 1).clearNote();
}

/**
 * Remove as linhas duplicadas selecionadas da planilha com trava de concorrência e backup preventivo
 * @param {number[]} linhasParaRemover - Números de linha (ex: [5, 8, 12])
 */
function removerLinhasDuplicadasDaFolha(linhasParaRemover, nomeAbaAlvo) {
  if (!linhasParaRemover || linhasParaRemover.length === 0) return;

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const sheet = obterAbaPedidoAtiva(nomeAbaAlvo);
    if (!sheet) throw new Error('Folha de pedido não encontrada.');


    // Ordena em ordem decrescente para não alterar os índices durante a remoção
    const linhasOrdenadas = [...linhasParaRemover].sort((a, b) => b - a);

    for (const linha of linhasOrdenadas) {
      if (linha >= 5 && linha <= sheet.getLastRow()) {
        sheet.deleteRow(linha);
      }
    }

    // Adiciona novas linhas em branco ao final para manter a estética para anotações manuais
    formatarLinhasEmBranco(sheet, sheet.getLastRow() + 1, linhasParaRemover.length);

    // Executa nova conferência
    const duplicidadesRestantes = verificarDuplicidadesFolha(sheet);
    Logger.log(`[DuplicateChecker] ${linhasParaRemover.length} linha(s) duplicada(s) removida(s). Restantes: ${duplicidadesRestantes.length}`);
  } catch (err) {
    Logger.log(`[DuplicateChecker] Erro ao remover duplicidades: ${err.message}`);
    throw err;
  } finally {
    lock.releaseLock();
  }
}
