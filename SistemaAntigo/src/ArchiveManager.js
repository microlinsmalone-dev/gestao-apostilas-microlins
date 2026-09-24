/**
 * ==============================================================================
 * GESTÃO DE APOSTILAS - MICROLINS
 * Arquivo: ArchiveManager.js
 * Descrição: Persistência inteligente de histórico na base oculta _BD_Historico
 * ==============================================================================
 */

/**
 * Garante que as abas essenciais do sistema existam e estejam configuradas
 */
function inicializarAbasSistema() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) return null;

  // 1. Base Oculta de Histórico (_BD_Historico)
  let sheetHistorico = ss.getSheetByName(CONFIG.SHEETS.BD_HISTORICO);
  if (!sheetHistorico) {
    sheetHistorico = ss.insertSheet(CONFIG.SHEETS.BD_HISTORICO);
  }
  garantirDimensoesSheet_(sheetHistorico, 10, 9);

  const cabecalhos = [
    'ID_Pedido',
    'Data_Arquivamento',
    'Titulo_Pedido',
    'Aluno',
    'Materia',
    'Educador',
    'Data_Entrega',
    'Entrega',
    'Liberacao'
  ];

  if (sheetHistorico.getLastRow() < 1) {
    sheetHistorico.getRange(1, 1, 1, cabecalhos.length).setValues([cabecalhos]);
    sheetHistorico.getRange(1, 1, 1, cabecalhos.length).setFontWeight('bold');
  }
  try {
    sheetHistorico.hideSheet();
  } catch (eHide) {}

  // 2. Aba de Configurações (Configuracoes)
  let sheetConfig = ss.getSheetByName(CONFIG.SHEETS.CONFIGURACOES);
  if (!sheetConfig) {
    sheetConfig = ss.insertSheet(CONFIG.SHEETS.CONFIGURACOES);
    formatarAbaConfiguracoes(sheetConfig);
  } else {
    // Se a aba existir mas estiver no modelo antigo simples, atualiza para o novo padrão visual
    try {
      if (sheetConfig.getRange('A1').getValue() === 'Educadores / Nomes a Ignorar') {
        formatarAbaConfiguracoes(sheetConfig);
      }
    } catch (eCfg) {}
  }

  return sheetConfig;
}

/**
 * Formata a aba de Configurações com a identidade visual nobre da Microlins Potirendaba
 * @param {Sheet} [sheetConfig] 
 */
function formatarAbaConfiguracoes(sheetConfig) {
  if (!sheetConfig) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) return;
    sheetConfig = ss.getSheetByName(CONFIG.SHEETS.CONFIGURACOES) || ss.insertSheet(CONFIG.SHEETS.CONFIGURACOES);
  }

  garantirDimensoesSheet_(sheetConfig, 15, 6);
  sheetConfig.clear();
  sheetConfig.clearFormats();

  // Dimensões das colunas
  sheetConfig.setColumnWidth(1, 320); // A - Educador
  sheetConfig.setColumnWidth(2, 140); // B - Data de Cadastro
  sheetConfig.setColumnWidth(3, 110); // C - Status
  sheetConfig.setColumnWidth(4, 30);  // D - Respiro
  sheetConfig.setColumnWidth(5, 340); // E - Instruções

  // Linha 1 de respiro
  sheetConfig.setRowHeight(1, 14);

  // Linha 2 - Banner Corporativo Microlins Potirendaba
  const banner = sheetConfig.getRange('A2:C2');
  banner.merge();
  banner.setValue('MICROLINS POTIRENDABA • PAINEL DE CONFIGURAÇÕES');
  banner.setBackground(CONFIG.ESTILOS.MICROLINS_BLUE);
  banner.setFontColor('#ffffff');
  banner.setFontFamily('Arial');
  banner.setFontSize(11);
  banner.setFontWeight('bold');
  banner.setHorizontalAlignment('center');
  banner.setVerticalAlignment('middle');
  sheetConfig.setRowHeight(2, 38);

  // Linha 3 de respiro
  sheetConfig.setRowHeight(3, 10);

  // Linha 4 - Título da Seção
  const secTitle = sheetConfig.getRange('A4:C4');
  secTitle.merge();
  secTitle.setValue('EDUCADORES E NOMES A IGNORAR NA IMPORTAÇÃO');
  secTitle.setBackground('#eef3fc');
  secTitle.setFontColor(CONFIG.ESTILOS.MICROLINS_BLUE_DARK);
  secTitle.setFontFamily('Arial');
  secTitle.setFontSize(10);
  secTitle.setFontWeight('bold');
  secTitle.setHorizontalAlignment('left');
  secTitle.setVerticalAlignment('middle');
  sheetConfig.setRowHeight(4, 26);

  // Linha 5 - Cabeçalhos da Tabela
  const cabecalhos = [['Educador / Nome a Ignorar', 'Data de Cadastro', 'Status']];
  const rangeHeader = sheetConfig.getRange('A5:C5');
  rangeHeader.setValues(cabecalhos);
  rangeHeader.setBackground(CONFIG.ESTILOS.HEADER_BG);
  rangeHeader.setFontColor(CONFIG.ESTILOS.MICROLINS_BLUE);
  rangeHeader.setFontFamily('Arial');
  rangeHeader.setFontSize(9);
  rangeHeader.setFontWeight('bold');
  rangeHeader.setVerticalAlignment('middle');
  rangeHeader.setBorder(true, true, true, true, true, true, '#cbd5e1', SpreadsheetApp.BorderStyle.SOLID);
  sheetConfig.getRange('A5').setHorizontalAlignment('left');
  sheetConfig.getRange('B5').setHorizontalAlignment('center');
  sheetConfig.getRange('C5').setHorizontalAlignment('center');
  sheetConfig.setRowHeight(5, 26);

  // Linhas 6+ - Educadores Padrão
  const dataHoje = Utilities.formatDate(new Date(), 'GMT-3', 'dd/MM/yyyy');
  const educadoresMatriz = CONFIG.DEFAULT_EDUCADORES_IGNORADOS.map(nome => [nome, dataHoje, 'Ativo']);
  const rangeDados = sheetConfig.getRange(6, 1, educadoresMatriz.length, 3);
  rangeDados.setValues(educadoresMatriz);
  rangeDados.setFontFamily('Arial');
  rangeDados.setFontSize(9);
  rangeDados.setVerticalAlignment('middle');
  rangeDados.setBorder(true, true, true, true, true, true, '#cbd5e1', SpreadsheetApp.BorderStyle.SOLID);

  sheetConfig.getRange(6, 1, educadoresMatriz.length, 1).setHorizontalAlignment('left');
  sheetConfig.getRange(6, 2, educadoresMatriz.length, 1).setHorizontalAlignment('center');
  sheetConfig.getRange(6, 3, educadoresMatriz.length, 1).setHorizontalAlignment('center');
  sheetConfig.getRange(6, 3, educadoresMatriz.length, 1).setFontWeight('bold');
  sheetConfig.getRange(6, 3, educadoresMatriz.length, 1).setFontColor(CONFIG.ESTILOS.MICROLINS_BLUE);

  for (let r = 6; r < 6 + educadoresMatriz.length; r++) {
    sheetConfig.setRowHeight(r, 24);
  }

  // Cartão Lateral de Orientação (E4:E8)
  const cardAjuda = sheetConfig.getRange('E4:E8');
  cardAjuda.merge();
  cardAjuda.setValue(
    '📌 COMO FUNCIONA ESTA REGRA:\n\n' +
    '• Registros com os nomes cadastrados nesta lista são desconsiderados automaticamente durante a importação.\n\n' +
    '• Evita que cadastros de testes, professores ou coordenadores entrem na lista de materiais.\n\n' +
    '• Você pode adicionar novos nomes a qualquer momento.'
  );
  cardAjuda.setBackground('#f8fafd');
  cardAjuda.setFontColor('#334155');
  cardAjuda.setFontFamily('Arial');
  cardAjuda.setFontSize(8.5);
  cardAjuda.setWrap(true);
  cardAjuda.setVerticalAlignment('top');
  cardAjuda.setBorder(true, true, true, true, false, false, '#cbd5e1', SpreadsheetApp.BorderStyle.SOLID);
}

/**
 * Garante que uma aba possua linhas e colunas suficientes antes de operações de gravação
 * @param {Sheet} sheet - Aba alvo
 * @param {number} linhasNecessarias - Quantidade de linhas necessárias
 * @param {number} colunasNecessarias - Quantidade de colunas necessárias
 */
function garantirDimensoesSheet_(sheet, linhasNecessarias, colunasNecessarias) {
  if (!sheet) return;
  try {
    const maxRows = sheet.getMaxRows();
    if (maxRows < linhasNecessarias) {
      sheet.insertRowsAfter(maxRows, linhasNecessarias - maxRows);
    }
    const maxCols = sheet.getMaxColumns();
    if (maxCols < colunasNecessarias) {
      sheet.insertColumnsAfter(maxCols, colunasNecessarias - maxCols);
    }
  } catch (eDim) {
    Logger.log(`[ArchiveManager] Aviso ao ajustar dimensões da aba: ${eDim.message}`);
  }
}

/**
 * Fallback seguro para sanitização de nomes de abas (respeita limite de 30 caracteres do Google Sheets)
 * @param {string} nome - Nome a sanitizar
 * @returns {string} Nome válido para aba do Google Sheets
 */
function sanitizarNomeAbaLocal_(nome) {
  if (typeof sanitizarNomeAba === 'function') {
    return sanitizarNomeAba(nome);
  }
  return String(nome || 'Folha')
    .replace(/[\\/?*[\]:]/g, ' ')
    .replace(/\s+/g, ' ')
    .substring(0, 30)
    .trim() || 'Folha';
}

/**
 * Fallback seguro para normalização de textos (remoção de acentos e minúsculas)
 * @param {string} texto
 * @returns {string}
 */
function normalizarTextoLocal_(texto) {
  if (typeof normalizarTexto === 'function') {
    return normalizarTexto(texto);
  }
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Cria uma cópia de segurança oculta da aba fornecida antes de operações destrutivas
 * @param {Sheet} sheet - Aba de origem
 * @param {string} [prefixo='Bkp'] - Prefixo identificador para o nome do backup
 * @returns {Sheet|null} Aba de backup criada ou null em caso de falha não crítica
 */
function criarBackupAba_(sheet, prefixo) {
  // Desativado: o armazenamento é 100% centralizado e seguro no _BD_Historico,
  // evitando a proliferação de abas Bkp_ ocultas na planilha.
  return null;
}

/**
 * Extrai registros válidos de alunos de qualquer aba de pedido ou backup com tolerância a cabeçalhos e linhas
 * @param {Sheet} sheet - Aba a ser inspecionada
 * @returns {Array<Object>} Lista de alunos encontrados
 */
function extrairLinhasAlunosDeAba_(sheet) {
  if (!sheet) return [];
  const maxRows = sheet.getMaxRows();
  const maxCols = sheet.getMaxColumns();
  const lastRow = Math.min(sheet.getLastRow(), maxRows);
  if (lastRow < 2) return [];

  const lastCol = sheet.getLastColumn() || maxCols;
  const colsParaLer = Math.min(Math.max(lastCol, 1), maxCols);
  if (colsParaLer < 1) return [];

  const valores = sheet.getRange(1, 1, lastRow, colsParaLer).getValues();
  const itens = [];

  let startRow = 1;
  // Procura dinamicamente linha de cabeçalho (Aluno/Nome) nas primeiras 6 linhas
  for (let r = 0; r < Math.min(valores.length, 6); r++) {
    const c0 = String(valores[r][0] || '').trim().toLowerCase();
    const c1 = String(valores[r][1] || '').trim().toLowerCase();
    if (c0 === 'aluno' || c0 === 'nome' || c1 === 'matéria' || c1 === 'materia') {
      startRow = r + 1; // 0-indexed: a linha seguinte a do cabeçalho
      break;
    }
  }

  // Se não achou cabeçalho explícito e tem >= 5 linhas (padrão Microlins onde linha 4 é cabeçalho), começa na 5 (índice 4)
  if (startRow === 1 && valores.length >= 5) {
    startRow = 4;
  }

  for (let i = startRow; i < valores.length; i++) {
    const row = valores[i];
    const aluno = String(row[0] || '').trim();
    const materia = String(row[1] || '').trim();

    if (!aluno || !materia) continue;
    const alunoNorm = aluno.toLowerCase();
    if (alunoNorm === 'aluno' || alunoNorm === 'nome') continue;
    if (alunoNorm.includes('entrega de material') || alunoNorm.includes('microlins')) continue;

    const educador = String(row[2] || '').trim();
    const dataEntrega = (row[3] instanceof Date)
      ? Utilities.formatDate(row[3], 'GMT-3', 'dd/MM/yyyy')
      : String(row[3] || '').trim();
    const entrega = String(row[4] || '').trim();
    const liberacao = (row.length > 5) ? String(row[5] || '').trim() : '';

    itens.push({
      aluno,
      materia,
      educador,
      dataEntrega,
      entrega,
      liberacao
    });
  }

  return itens;
}

/**
 * Localiza todas as abas de backup existentes na planilha e sincroniza seus pedidos
 * no banco _BD_Historico caso ainda não tenham sido catalogados.
 * @returns {Object} Resumo de sincronização
 */
function sincronizarBackupsParaHistorico_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) return { sincronizados: 0, totalAdicionados: 0 };
  inicializarAbasSistema();
  const sheetBD = ss.getSheetByName(CONFIG.SHEETS.BD_HISTORICO);
  if (!sheetBD) return { sincronizados: 0, totalAdicionados: 0 };

  // 1. Identificar IDs já presentes no banco para evitar duplicidades
  const idsExistentes = new Set();
  const ultimaLinhaBD = sheetBD.getLastRow();

  if (ultimaLinhaBD > 1) {
    garantirDimensoesSheet_(sheetBD, ultimaLinhaBD, 9);
    const dadosBD = sheetBD.getRange(2, 1, ultimaLinhaBD - 1, 1).getValues();
    for (const r of dadosBD) {
      const id = String(r[0] || '').trim();
      if (id) idsExistentes.add(id);
    }
  }

  // 2. Localizar todas as abas que correspondam a backups
  const todasAbas = ss.getSheets();
  const abasBackup = todasAbas.filter(s => {
    const nome = s.getName();
    return (
      nome.startsWith(CONFIG.BACKUP.PREFIXO_PEDIDO) ||
      nome.startsWith(CONFIG.BACKUP.PREFIXO_SOBRESCRITA) ||
      nome.startsWith('Bkp_') ||
      nome.startsWith('Backup_') ||
      nome.includes('Bkp')
    );
  });

  if (abasBackup.length === 0) {
    return { sincronizados: 0, totalAdicionados: 0 };
  }

  const linhasParaInserir = [];
  let sincronizados = 0;

  for (const bkpSheet of abasBackup) {
    const nomeAba = bkpSheet.getName();
    const idPedido = 'PED_BKP_' + nomeAba.replace(/[^a-zA-Z0-9_]/g, '');
    if (idsExistentes.has(idPedido)) continue;

    const itensValidos = extrairLinhasAlunosDeAba_(bkpSheet);
    if (itensValidos.length === 0) continue;

    // Título do pedido (Linha 2, Coluna A ou nome da aba)
    let titulo = '';
    try {
      titulo = String(bkpSheet.getRange('A2').getValue() || '').trim();
    } catch (e) {}
    if (!titulo || (titulo.toLowerCase().includes('entrega de material') && titulo.length < 5)) {
      titulo = nomeAba.replace(/^[Bkp_Backup_]+/i, '').trim() || nomeAba;
    }

    // Deriva a data a partir do nome da aba (ex: Bkp_Pedido_20260917_133000)
    let dataFormatada = '';
    const matchData = nomeAba.match(/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})?/);
    if (matchData) {
      const seg = matchData[6] ? `:${matchData[6]}` : '';
      dataFormatada = `${matchData[3]}/${matchData[2]}/${matchData[1]} ${matchData[4]}:${matchData[5]}${seg}`;
    } else {
      dataFormatada = Utilities.formatDate(new Date(), 'GMT-3', 'dd/MM/yyyy HH:mm');
    }

    for (const item of itensValidos) {
      linhasParaInserir.push([
        idPedido,
        dataFormatada,
        titulo,
        item.aluno,
        item.materia,
        item.educador,
        item.dataEntrega,
        item.entrega,
        item.liberacao
      ]);
    }

    idsExistentes.add(idPedido);
    sincronizados++;
  }

  if (linhasParaInserir.length > 0) {
    const proximaLinha = sheetBD.getLastRow() + 1;
    garantirDimensoesSheet_(sheetBD, proximaLinha + linhasParaInserir.length, 9);
    sheetBD.getRange(proximaLinha, 1, linhasParaInserir.length, 9).setValues(linhasParaInserir);
    try {
      CacheService.getScriptCache().remove(CONFIG.CACHE.HISTORICO_KEY);
    } catch (eCache) {}
    Logger.log(`[ArchiveManager] Sincronização concluída: ${sincronizados} pedido(s) (${linhasParaInserir.length} registros) migrados de abas de backup para o _BD_Historico.`);
  }

  return {
    sincronizados: sincronizados,
    totalAdicionados: linhasParaInserir.length
  };
}

/**
 * Extrai e persiste os registros de uma folha de pedido diretamente no _BD_Historico
 * @param {Sheet} sheet - Aba contendo os pedidos
 * @param {string} [tituloOpcional] - Título opcional
 * @returns {Object|null} Resumo dos registros arquivados ou null se vazia
 */
function salvarRegistrosFolhaNoHistorico_(sheet, tituloOpcional) {
  if (!sheet || sheet.getLastRow() < 5) return null;

  const nomeAba = sheet.getName();
  const nomeDash = CONFIG.SHEETS.DASHBOARD || 'Dashboard';
  const NOMES_SISTEMA = [CONFIG.SHEETS.BD_HISTORICO, CONFIG.SHEETS.CONFIGURACOES, nomeDash];
  if (NOMES_SISTEMA.includes(nomeAba) || nomeAba.startsWith('Bkp_') || nomeAba.startsWith('Backup_')) {
    Logger.log(`[ArchiveManager] BLOQUEADO: Tentativa de arquivar aba proibida no histórico: "${nomeAba}"`);
    return null;
  }

  // Proteção contra cabeçalho do Dashboard em A2 ou B2
  let a2Val = '';
  try {
    a2Val = String(sheet.getRange('A2').getValue() || sheet.getRange('B2').getValue() || '').toUpperCase();
  } catch (eA2) {}
  if (a2Val.includes('DASHBOARD') || a2Val.includes('CENTRAL DE GESTÃO') || a2Val.includes('PAINEL DE CONTROLE') || a2Val.includes('POTIRENDABA')) {
    Logger.log(`[ArchiveManager] BLOQUEADO: Célula A2/B2 é cabeçalho de Dashboard ("${a2Val}"). Arquivamento abortado.`);
    return null;
  }

  const ultimaLinha = sheet.getLastRow();
  const valores = sheet.getRange(5, 1, ultimaLinha - 4, 6).getValues();
  const registrosParaSalvar = [];

  const titulo = (tituloOpcional && String(tituloOpcional).trim().length > 0)
    ? String(tituloOpcional).trim()
    : (typeof obterTituloPedidoAtual === 'function' ? obterTituloPedidoAtual(sheet) : sheet.getName());

  if (typeof ehRegistroDashboard_ === 'function' && ehRegistroDashboard_(titulo, '')) {
    Logger.log(`[ArchiveManager] BLOQUEADO: Título identificado como elemento de Dashboard: "${titulo}"`);
    return null;
  }

  const idPedido = 'PED_' + Utilities.formatDate(new Date(), 'GMT-3', 'yyyyMMdd_HHmmss');
  const dataArquivamento = Utilities.formatDate(new Date(), 'GMT-3', 'dd/MM/yyyy HH:mm');

  for (const row of valores) {
    const aluno = String(row[0] || '').trim();
    const materia = String(row[1] || '').trim();
    if (!aluno || !materia) continue;

    // Se for algum elemento de interface ou botão do Dashboard, ignora
    if (typeof ehRegistroDashboard_ === 'function' && (ehRegistroDashboard_(titulo, aluno) || ehRegistroDashboard_(materia, ''))) {
      continue;
    }

    const educador = String(row[2] || '').trim();
    const dataEntrega = (row[3] instanceof Date)
      ? Utilities.formatDate(row[3], 'GMT-3', 'dd/MM/yyyy') 
      : String(row[3] || '').trim();
    const entrega = String(row[4] || '').trim();
    const liberacao = String(row[5] || '').trim();

    registrosParaSalvar.push([
      idPedido,
      dataArquivamento,
      titulo,
      aluno,
      materia,
      educador,
      dataEntrega,
      entrega,
      liberacao
    ]);
  }

  if (registrosParaSalvar.length === 0) {
    return null;
  }


  // Grava no banco oculto _BD_Historico
  inicializarAbasSistema();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetBD = ss.getSheetByName(CONFIG.SHEETS.BD_HISTORICO);
  const proximaLinha = sheetBD.getLastRow() + 1;
  garantirDimensoesSheet_(sheetBD, proximaLinha + registrosParaSalvar.length, 9);
  sheetBD.getRange(proximaLinha, 1, registrosParaSalvar.length, 9).setValues(registrosParaSalvar);
  Logger.log(`[ArchiveManager] Gravados ${registrosParaSalvar.length} registros no _BD_Historico com ID: ${idPedido} (Título: "${titulo}")`);

  // Invalida cache de histórico
  try {
    CacheService.getScriptCache().remove(CONFIG.CACHE.HISTORICO_KEY);
    Logger.log('[ArchiveManager] Cache de histórico invalidado com sucesso.');
  } catch (eCache) {
    Logger.log(`[ArchiveManager] Aviso ao invalidar cache: ${eCache.message}`);
  }

  return {
    sucesso: true,
    idPedido: idPedido,
    titulo: titulo,
    totalRegistros: registrosParaSalvar.length
  };
}

/**
 * Prompt para arquivar o pedido da folha ativa no banco de dados
 */
function arquivarPedidoPrompt() {
  const ui = SpreadsheetApp.getUi();
  const titulo = (typeof obterTituloPedidoAtual === 'function')
    ? obterTituloPedidoAtual()
    : 'Pedido Atual';

  const confirmacao = ui.alert(
    'Arquivar Pedido',
    `Deseja arquivar os registros de "${titulo}" no banco de dados consolidado?\n\nOs registros serão preservados para controle de duplicidades e consultas futuras.`,
    ui.ButtonSet.YES_NO
  );

  if (confirmacao === ui.Button.YES) {
    try {
      const resultado = arquivarPedidoAtual();
      ui.alert(
        'Pedido Arquivado',
        `O pedido "${titulo}" foi arquivado com sucesso.\nTotal de registros: ${resultado.totalRegistros}.`,
        ui.ButtonSet.OK
      );
    } catch (err) {
      ui.alert('Erro ao Arquivar', err.message, ui.ButtonSet.OK);
    }
  }
}

/**
 * Grava todos os registros da folha atual no banco consolidado _BD_Historico com trava de concorrência e backup prévio
 * @param {string} [nomeAbaAlvo] - Nome da folha de pedido alvo (opcional)
 * @returns {Object} Resumo da operação de arquivamento
 */
function arquivarPedidoAtual(nomeAbaAlvo) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    Logger.log(`[ArchiveManager] Lock adquirido para arquivamento de pedido (alvo: ${nomeAbaAlvo || 'auto'}).`);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = (typeof obterAbaPedidoAtiva === 'function')
      ? obterAbaPedidoAtiva(nomeAbaAlvo)
      : (nomeAbaAlvo ? ss.getSheetByName(nomeAbaAlvo) : ss.getActiveSheet());

    if (!sheet) {
      throw new Error('Nenhuma folha de pedido encontrada para arquivar.');
    }

    const nomeDash = CONFIG.SHEETS.DASHBOARD || 'Dashboard';
    const NOMES_SISTEMA = [CONFIG.SHEETS.BD_HISTORICO, CONFIG.SHEETS.CONFIGURACOES, nomeDash];
    if (NOMES_SISTEMA.includes(sheet.getName())) {
      throw new Error(`A aba "${sheet.getName()}" é uma aba do sistema e não pode ser arquivada como pedido.`);
    }

    // 1. Verifica se está em modo de edição explícito OU se o pedido já existe no histórico com o mesmo título
    const props = PropertiesService.getDocumentProperties();
    let editandoId = props.getProperty('EDITANDO_ID_PEDIDO');

    const tituloAtual = (typeof obterTituloPedidoAtual === 'function')
      ? obterTituloPedidoAtual(sheet)
      : String(sheet.getRange('A2').getValue() || sheet.getName()).trim();

    // Se não houver editandoId nas propriedades, verifica se já existe um pedido no histórico com o mesmo título
    if (!editandoId) {
      const sheetBD = ss.getSheetByName(CONFIG.SHEETS.BD_HISTORICO);
      if (sheetBD && sheetBD.getLastRow() > 1) {
        const dadosBD = sheetBD.getRange(2, 1, sheetBD.getLastRow() - 1, 3).getValues();
        for (const r of dadosBD) {
          const titBD = String(r[2] || '').trim();
          if (titBD && titBD.toLowerCase() === tituloAtual.toLowerCase()) {
            editandoId = String(r[0] || '').trim();
            Logger.log(`[ArchiveManager] Pedido com mesmo título identificado no histórico: "${titBD}" (${editandoId}). Salvando como atualização.`);
            break;
          }
        }
      }
    }

    if (editandoId) {
      Logger.log(`[ArchiveManager] Folha associada ao pedido existente (${editandoId}). Salvando alterações diretamente no pedido original.`);
      return salvarEdicaoPedidoHistorico(sheet, editandoId);
    }

    const resSalvar = salvarRegistrosFolhaNoHistorico_(sheet);
    if (!resSalvar || resSalvar.totalRegistros === 0) {
      throw new Error(`A folha "${sheet.getName()}" não contém registros preenchidos de alunos para arquivar.`);
    }

    // Se for a folha padrão "Pedido Atual", limpa e prepara antes de focar no Dashboard
    const nomePadrao = CONFIG.SHEETS.PEDIDO_PADRAO;
    if (sheet.getName() === nomePadrao) {
      sheet.clear();
      sheet.clearFormats();
      if (typeof prepararFolhaPedido === 'function') {
        prepararFolhaPedido('ENTREGA DE MATERIAL - NOVO PEDIDO', true, sheet);
      }
    }

    // Ativa o Dashboard para permitir ocultar a folha de pedido no Google Sheets
    let sheetDash = ss.getSheetByName(nomeDash);
    if (sheetDash) {
      sheetDash.showSheet();
      ss.setActiveSheet(sheetDash);
    }

    if (sheet.getName() === nomePadrao) {
      try {
        sheet.hideSheet();
      } catch (eHide) {}
    } else {
      // Se for outra folha temporária arquivada, deleta com segurança
      try {
        ss.deleteSheet(sheet);
      } catch (eDel) {
        sheet.hideSheet();
      }
    }

    // Atualiza os indicadores do Dashboard rapidamente sem reconstrução total
    try {
      if (typeof gerarOuAtualizarDashboard === 'function') {
        gerarOuAtualizarDashboard(true, false);
      }
      if (typeof recolherAbasParaDashboard === 'function') {
        recolherAbasParaDashboard();
      }
    } catch (eDash) {
      Logger.log(`[ArchiveManager] Aviso ao atualizar Dashboard após arquivamento: ${eDash.message}`);
    }

    Logger.log(`[ArchiveManager] Pedido "${resSalvar.titulo}" arquivado com sucesso no _BD_Historico.`);

    return {
      sucesso: true,
      idPedido: resSalvar.idPedido,
      titulo: resSalvar.titulo,
      totalRegistros: resSalvar.totalRegistros,
      novaAba: nomePadrao
    };
  } catch (err) {
    Logger.log(`[ArchiveManager] Erro em arquivarPedidoAtual: ${err.message}`);
    throw err;
  } finally {
    try {
      lock.releaseLock();
    } catch (eRel) {}
    Logger.log('[ArchiveManager] Lock de arquivamento liberado.');
  }
}

/**
 * Carrega a base consolidada de histórico em um Map com suporte a CacheService para conferência ultra-rápida de duplicidades
 * @param {string} [idPedidoIgnorar] - ID de pedido a desconsiderar na busca de duplicidades (ex: pedido que está sendo editado)
 * @returns {Map<string, Object>} Chave "aluno|||materia" -> dados do pedido
 */
function carregarHistoricoConsolidado(idPedidoIgnorar) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheetBD = ss.getSheetByName(CONFIG.SHEETS.BD_HISTORICO);
  const historico = new Map();

  if (!sheetBD || sheetBD.getLastRow() <= 1) {
    try {
      sincronizarBackupsParaHistorico_();
    } catch (eSync) {
      Logger.log(`[ArchiveManager] Aviso ao sincronizar backups no histórico: ${eSync.message}`);
    }
    sheetBD = ss.getSheetByName(CONFIG.SHEETS.BD_HISTORICO);
    if (!sheetBD || sheetBD.getLastRow() <= 1) {
      return historico;
    }
  }

  // Se não houver ID a ignorar, tenta carregar do cache para resposta instantânea
  if (!idPedidoIgnorar) {
    const cache = CacheService.getScriptCache();
    const cacheKey = CONFIG.CACHE.HISTORICO_KEY;
    try {
      const cachedData = cache.get(cacheKey);
      if (cachedData) {
        Logger.log('[ArchiveManager] Histórico carregado instantaneamente do CacheService.');
        const entries = JSON.parse(cachedData);
        for (const item of entries) {
          if (Array.isArray(item)) {
            if (item.length >= 4 && typeof item[0] === 'string') {
              historico.set(item[0], {
                idPedido: item[1],
                dataArquivo: item[2],
                tituloPedido: item[3]
              });
            } else if (item.length === 2) {
              historico.set(item[0], item[1]);
            }
          }
        }
        return historico;
      }
    } catch (eCache) {
      Logger.log(`[ArchiveManager] Falha na leitura do cache: ${eCache.message}`);
    }
  }

  // Lê Colunas: [ID_Pedido, Data_Arquivamento, Titulo_Pedido, Aluno, Materia, Educador, Data_Entrega, Entrega, Liberacao]
  const ultimaLinha = sheetBD.getLastRow();
  garantirDimensoesSheet_(sheetBD, ultimaLinha, 9);
  const valores = sheetBD.getRange(2, 1, ultimaLinha - 1, 9).getValues();
  const idFiltro = idPedidoIgnorar ? String(idPedidoIgnorar).trim() : '';

  for (const row of valores) {
    const idPedido = String(row[0] || '').trim();
    const dataArquivo = row[1];
    const tituloPedido = String(row[2] || '').trim();
    const aluno = String(row[3] || '').trim();
    const materia = String(row[4] || '').trim();

    if (!aluno || !materia) continue;

    // Se este registro pertencer ao pedido que está sendo ignorado/editado, não adiciona ao mapa
    if (idFiltro && (idPedido === idFiltro || idPedido.includes(idFiltro) || idFiltro.includes(idPedido))) {
      continue;
    }

    const chave = `${normalizarTextoLocal_(aluno)}|||${normalizarTextoLocal_(materia)}`;
    // Mantém o registro
    if (!historico.has(chave)) {
      historico.set(chave, {
        idPedido,
        dataArquivo,
        tituloPedido,
        educador: row[5],
        dataEntrega: row[6]
      });
    }
  }

  // Persiste em cache somente se for a consulta global completa (sem filtro de pedido)
  if (!idPedidoIgnorar) {
    try {
      const cache = CacheService.getScriptCache();
      const miniEntries = [];
      for (const [chave, val] of historico.entries()) {
        miniEntries.push([chave, val.idPedido, val.dataArquivo, val.tituloPedido]);
      }
      const jsonStr = JSON.stringify(miniEntries);
      if (jsonStr.length < 95000) {
        cache.put(CONFIG.CACHE.HISTORICO_KEY, jsonStr, CONFIG.CACHE.TTL_SEGUNDOS);
        Logger.log(`[ArchiveManager] Histórico compacto de ${historico.size} itens persistido no CacheService (${jsonStr.length} bytes).`);
      } else {
        Logger.log(`[ArchiveManager] Tamanho do histórico (${jsonStr.length} bytes) excede cota de 95KB; mantido seguro em memória.`);
      }
    } catch (ePut) {
      Logger.log(`[ArchiveManager] Aviso: Não foi possível salvar em cache: ${ePut.message}`);
    }
  }

  return historico;
}

/**
 * Converte strings de data brasileiras (dd/MM/yyyy ou dd/MM/yyyy HH:mm) em timestamp numérico
 * para ordenação cronológica estrita (ano -> mês -> dia -> hora -> minuto).
 * @param {string} dataStr - Ex: "15/08/2026 14:00" ou "15/08/2026"
 * @param {string} [mesNomeFallback] - Mês de competência caso a data não possua dia/mês
 * @param {string} [anoFallback] - Ano de competência
 * @returns {number} Timestamp numérico em milissegundos
 */
function parseDataBrParaTimestamp_(dataStr, mesNomeFallback, anoFallback) {
  if (dataStr) {
    const m = String(dataStr).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?/);
    if (m) {
      const dia = parseInt(m[1], 10);
      const mes = parseInt(m[2], 10) - 1;
      const ano = parseInt(m[3], 10);
      const hora = m[4] !== undefined ? parseInt(m[4], 10) : 0;
      const min = m[5] !== undefined ? parseInt(m[5], 10) : 0;
      return new Date(ano, mes, dia, hora, min).getTime();
    }
  }

  // Fallback se possuir mês/ano de competência
  if (mesNomeFallback && anoFallback) {
    const meses = ['janeiro', 'fevereiro', 'março', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    const idx = meses.indexOf(String(mesNomeFallback).toLowerCase());
    if (idx !== -1) {
      return new Date(parseInt(anoFallback, 10), idx, 1).getTime();
    }
  }

  return 0;
}

/**
 * Lista todos os pedidos arquivados consolidados no _BD_Historico com enriquecimento
 * de metadados: Nº de Ordem, Mês/Ano, Qtd. Materiais e Educadores envolvidos.
 * Não duplica pedidos com abas de backup.
 * @returns {Array<Object>} Lista de pedidos consolidados ordenados do mais recente ao mais antigo
 */
function listarPedidosArquivados() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) return [];

  // 1. Sincroniza previamente qualquer backup órfão que ainda esteja pendente
  try {
    sincronizarBackupsParaHistorico_();
  } catch (eSync) {
    Logger.log(`[ArchiveManager] Aviso ao sincronizar backups em listarPedidosArquivados: ${eSync.message}`);
  }

  // Purga proativa de eventuais registros corrompidos de Dashboard do BD_Historico
  try {
    limparRegistrosCorrompidosHistorico();
  } catch (eClean) {}

  const sheetBD = ss.getSheetByName(CONFIG.SHEETS.BD_HISTORICO);
  const pedidosAgrupados = new Map();

  const mesesNomes = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  // 2. Lê pedidos gravados no _BD_Historico
  if (sheetBD && sheetBD.getLastRow() > 1) {
    garantirDimensoesSheet_(sheetBD, sheetBD.getLastRow(), 9);
    const valores = sheetBD.getRange(2, 1, sheetBD.getLastRow() - 1, 9).getValues();

    for (const row of valores) {
      const idPedido = String(row[0] || '').trim();
      const dataRaw = row[1];
      const titulo = String(row[2] || '').trim() || 'Pedido Arquivado';
      const aluno = String(row[3] || '').trim();
      const educador = String(row[5] || '').trim();

      if (!idPedido) continue;
      if (ehRegistroDashboard_(titulo, aluno)) continue;

      // 1. Verifica se o título do pedido declara explicitamente um mês de competência (ex: AGOSTO, SETEMBRO...)
      let mesCompetenciaTitulo = '';
      let mesNumCompetencia = '';
      const titUpper = titulo.toUpperCase();
      for (let i = 0; i < mesesNomes.length; i++) {
        if (titUpper.includes(mesesNomes[i].toUpperCase())) {
          mesCompetenciaTitulo = mesesNomes[i];
          mesNumCompetencia = String(i + 1).padStart(2, '0');
          break;
        }
      }

      // 2. Extrai data/ano original da coluna do banco
      let dataFormatada = '';
      let ano = '';
      let mesNum = '';
      let mesNome = '';

      if (dataRaw instanceof Date) {
        dataFormatada = Utilities.formatDate(dataRaw, 'GMT-3', 'dd/MM/yyyy HH:mm');
        ano = Utilities.formatDate(dataRaw, 'GMT-3', 'yyyy');
        mesNum = Utilities.formatDate(dataRaw, 'GMT-3', 'MM');
        mesNome = mesesNomes[dataRaw.getMonth()] || '';
      } else {
        dataFormatada = String(dataRaw || '').trim();
        const m = dataFormatada.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (m) {
          mesNum = m[2];
          ano = m[3];
          const idx = parseInt(mesNum, 10) - 1;
          mesNome = mesesNomes[idx] || '';
        }
      }

      // 3. Se o título declara um mês (ex: AGOSTO), o mês de competência é o do título!
      if (mesCompetenciaTitulo) {
        mesNome = mesCompetenciaTitulo;
        mesNum = mesNumCompetencia;
      }

      // 4. Se o título declara um ano explícito (ex: 2025, 2026)
      const matchAno = titulo.match(/\b(20\d{2})\b/);
      if (matchAno) {
        ano = matchAno[1];
      } else if (!ano) {
        ano = String(new Date().getFullYear());
      }

      if (!pedidosAgrupados.has(idPedido)) {
        pedidosAgrupados.set(idPedido, {
          idPedido: idPedido,
          data: dataFormatada,
          titulo: titulo,
          ano: ano,
          mesNum: mesNum,
          mesNome: mesNome,
          mesAno: (mesNome && ano) ? `${mesNome} / ${ano}` : (dataFormatada || 'Histórico'),
          totalAlunos: 0,
          origem: 'BD_Historico',
          educadoresSet: new Set()
        });
      }

      const pedido = pedidosAgrupados.get(idPedido);
      if (aluno) pedido.totalAlunos++;
      if (educador && educador !== '-' && educador.toLowerCase() !== 'nenhum') {
        pedido.educadoresSet.add(educador);
      }
    }
  }

  // 3. Converte para lista, calcula Nº de Ordem cronológico e finaliza os campos
  const listaPedidos = Array.from(pedidosAgrupados.values());

  // Ordena cronologicamente crescente para atribuir Nº de Ordem sequencial (#001, #002...)
  listaPedidos.sort((a, b) => {
    const tA = parseDataBrParaTimestamp_(a.data, a.mesNome, a.ano);
    const tB = parseDataBrParaTimestamp_(b.data, b.mesNome, b.ano);
    if (tA !== tB) return tA - tB;
    return String(a.idPedido || '').localeCompare(String(b.idPedido || ''));
  });

  for (let idx = 0; idx < listaPedidos.length; idx++) {
    const num = idx + 1;
    listaPedidos[idx].numOrdem = `#${String(num).padStart(3, '0')}`;
    listaPedidos[idx].numOrdemClean = String(num);
    const edArray = Array.from(listaPedidos[idx].educadoresSet);
    listaPedidos[idx].educadores = edArray;
    listaPedidos[idx].educadoresStr = edArray.length > 0 ? edArray.join(', ') : 'Não informado';
    delete listaPedidos[idx].educadoresSet;
  }

  // Ordena do mais recente ao mais antigo para visualização na tela
  listaPedidos.sort((a, b) => {
    const tA = parseDataBrParaTimestamp_(a.data, a.mesNome, a.ano);
    const tB = parseDataBrParaTimestamp_(b.data, b.mesNome, b.ano);
    if (tB !== tA) return tB - tA;
    return String(b.idPedido || '').localeCompare(String(a.idPedido || ''));
  });

  Logger.log(`[ArchiveManager] Listados ${listaPedidos.length} pedidos consolidados do histórico.`);
  return listaPedidos;
}

/**
 * Higieniza a planilha removendo com total segurança todas as abas antigas de backup (Bkp_*, Backup_*)
 * após assegurar que todos os registros estejam 100% gravados no _BD_Historico.
 * @returns {Object} Resumo da operação de limpeza
 */
function limparAbasBackupAntigas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) return { sucesso: false, removidas: 0 };

  // 1. Sincroniza qualquer registro pendente antes de apagar qualquer aba
  const resSync = sincronizarBackupsParaHistorico_();

  const sheets = ss.getSheets();
  let removidas = 0;
  const nomesRemovidos = [];

  for (const s of sheets) {
    const nome = s.getName();
    if (
      nome.startsWith('Bkp_') ||
      nome.startsWith('Backup_') ||
      (nome.includes('Bkp') && nome !== CONFIG.SHEETS.BD_HISTORICO)
    ) {
      try {
        ss.deleteSheet(s);
        removidas++;
        nomesRemovidos.push(nome);
      } catch (eDel) {
        Logger.log(`[ArchiveManager] Aviso ao remover aba "${nome}": ${eDel.message}`);
      }
    }
  }

  // 2. Atualiza o Dashboard e recolhe
  try {
    if (typeof gerarOuAtualizarDashboard === 'function') {
      gerarOuAtualizarDashboard(true);
    }
    if (typeof recolherAbasParaDashboard === 'function') {
      recolherAbasParaDashboard();
    }
  } catch (eDash) {}

  const msg = `Limpeza concluída! ${removidas} aba(s) de backup antiga(s) foram removidas. Seus dados estão 100% seguros no histórico.`;
  try {
    ss.toast(msg, 'Higienização de Planilha', 5);
  } catch (eToast) {}

  return {
    sucesso: true,
    sincronizados: resSync.sincronizados,
    totalAdicionados: resSync.totalAdicionados,
    removidas: removidas,
    nomesRemovidos: nomesRemovidos
  };
}

/**
 * Abre um pedido arquivado para edição direta nas células do Google Sheets,
 * permitindo corrigir alunos, matérias, educadores ou adicionar/remover linhas.
 * @param {string} idPedido - ID do pedido a ser editado
 * @returns {Object} Detalhes do pedido carregado para edição
 */
function abrirPedidoParaEdicao(idPedido) {
  if (!idPedido) throw new Error('ID do pedido não informado para edição.');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  inicializarAbasSistema();

  const sheetBD = ss.getSheetByName(CONFIG.SHEETS.BD_HISTORICO);
  if (!sheetBD || sheetBD.getLastRow() <= 1) {
    throw new Error('Banco de histórico vazio.');
  }

  const ultimaLinhaBD = sheetBD.getLastRow();
  const dados = sheetBD.getRange(2, 1, ultimaLinhaBD - 1, 9).getValues();

  const registrosPedido = [];
  let tituloPedido = '';
  let dataOriginal = '';

  for (const row of dados) {
    if (String(row[0] || '').trim() === String(idPedido).trim()) {
      if (!tituloPedido) tituloPedido = String(row[2] || '').trim();
      if (!dataOriginal) dataOriginal = row[1];
      registrosPedido.push({
        aluno: row[3],
        materia: row[4],
        educador: row[5],
        dataEntrega: row[6],
        entrega: row[7],
        liberacao: row[8]
      });
    }
  }

  if (registrosPedido.length === 0) {
    throw new Error(`Pedido com ID "${idPedido}" não foi encontrado no histórico.`);
  }

  // Prepara a folha de trabalho "Pedido Atual"
  const nomeAba = CONFIG.SHEETS.PEDIDO_PADRAO;
  let sheet = ss.getSheetByName(nomeAba);
  if (!sheet) {
    sheet = ss.insertSheet(nomeAba);
  }
  sheet.showSheet();
  ss.setActiveSheet(sheet);

  // Registra metadados de edição nas propriedades antes de preparar a folha
  const props = PropertiesService.getDocumentProperties();
  props.setProperty('EDITANDO_ID_PEDIDO', idPedido);
  props.setProperty('EDITANDO_TITULO_PEDIDO', tituloPedido);
  if (dataOriginal instanceof Date) {
    props.setProperty('EDITANDO_DATA_ORIGINAL', Utilities.formatDate(dataOriginal, 'GMT-3', 'dd/MM/yyyy HH:mm'));
  } else {
    props.setProperty('EDITANDO_DATA_ORIGINAL', String(dataOriginal || ''));
  }

  // Prepara a folha com o layout oficial e o título do pedido (sem auto-arquivamento)
  if (typeof prepararFolhaPedido === 'function') {
    prepararFolhaPedido(tituloPedido, true, sheet, true);
  }

  // Preenche os registros dos alunos a partir da linha 5
  const linhasParaPreencher = registrosPedido.map(r => [
    r.aluno || '',
    r.materia || '',
    r.educador || '',
    r.dataEntrega || '',
    r.entrega || '',
    r.liberacao || ''
  ]);

  if (linhasParaPreencher.length > 0) {
    garantirDimensoesSheet_(sheet, 5 + linhasParaPreencher.length + CONFIG.LINHAS_EXTRAS_MANUAIS, 7);
    const range = sheet.getRange(5, 1, linhasParaPreencher.length, 6);
    range.setValues(linhasParaPreencher);
    range.setFontFamily('Arial');
    range.setFontSize(9);
    range.setVerticalAlignment('middle');
    range.setBorder(true, true, true, true, true, true, CONFIG.ESTILOS.BORDER_COLOR, SpreadsheetApp.BorderStyle.SOLID);
  }

  // Exibe toast orientando o usuário
  ss.toast(`Pedido "${tituloPedido}" pronto para edição! Corrija os alunos/matérias e clique em "Salvar Edição no Histórico" no menu quando terminar.`, 'Modo Edição Ativo', 8);

  return {
    sucesso: true,
    idPedido: idPedido,
    titulo: tituloPedido,
    totalItens: registrosPedido.length
  };
}

/**
 * Salva as alterações feitas na folha de edição diretamente de volta ao _BD_Historico,
 * preservando o mesmo ID_Pedido e data original de arquivamento, e colapsando duplicatas.
 * @param {Sheet} [sheetAlvo] - Folha alvo da edição (opcional)
 * @param {string} [idPedidoAlvo] - ID do pedido a atualizar (opcional)
 * @returns {Object} Resultado da operação
 */
function salvarEdicaoPedidoHistorico(sheetAlvo, idPedidoAlvo) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const props = PropertiesService.getDocumentProperties();

    let sheetAtual = sheetAlvo || ss.getSheetByName(CONFIG.SHEETS.PEDIDO_PADRAO);
    if (!sheetAtual || sheetAtual.getLastRow() < 5) {
      sheetAtual = (typeof obterAbaPedidoAtiva === 'function') ? obterAbaPedidoAtiva() : null;
    }
    if (!sheetAtual || sheetAtual.getLastRow() < 5) {
      throw new Error('A folha de edição não contém registros de alunos para salvar.');
    }

    const titulo = (typeof obterTituloPedidoAtual === 'function')
      ? obterTituloPedidoAtual(sheetAtual)
      : String(sheetAtual.getRange('A2').getValue() || 'Pedido Atualizado').trim();

    let idPedido = idPedidoAlvo || props.getProperty('EDITANDO_ID_PEDIDO');

    // Se o ID não estiver registrado em propriedades, busca no histórico pelo título da folha
    const sheetBD = ss.getSheetByName(CONFIG.SHEETS.BD_HISTORICO);
    if (!sheetBD) throw new Error('Aba _BD_Historico não encontrada.');

    if (!idPedido && sheetBD.getLastRow() > 1) {
      const dadosBD = sheetBD.getRange(2, 1, sheetBD.getLastRow() - 1, 3).getValues();
      for (const r of dadosBD) {
        const titBD = String(r[2] || '').trim();
        if (titBD && titBD.toLowerCase() === titulo.toLowerCase()) {
          idPedido = String(r[0] || '').trim();
          Logger.log(`[ArchiveManager] Pedido associado pelo título idêntico: "${titBD}" (ID: ${idPedido}).`);
          break;
        }
      }
    }

    if (!idPedido) {
      throw new Error('Nenhum pedido histórico correspondente foi encontrado para atualizar.');
    }

    const dataOriginal = props.getProperty('EDITANDO_DATA_ORIGINAL') || Utilities.formatDate(new Date(), 'GMT-3', 'dd/MM/yyyy HH:mm');

    // Lê os dados corrigidos da folha
    const ultimaLinha = sheetAtual.getLastRow();
    const valores = sheetAtual.getRange(5, 1, ultimaLinha - 4, 6).getValues();
    const novosRegistros = [];

    for (const row of valores) {
      const aluno = String(row[0] || '').trim();
      const materia = String(row[1] || '').trim();
      if (!aluno || !materia) continue;

      const educador = String(row[2] || '').trim();
      const dataEntrega = (row[3] instanceof Date)
        ? Utilities.formatDate(row[3], 'GMT-3', 'dd/MM/yyyy')
        : String(row[3] || '').trim();
      const entrega = String(row[4] || '').trim();
      const liberacao = String(row[5] || '').trim();

      novosRegistros.push([
        idPedido,
        dataOriginal,
        titulo,
        aluno,
        materia,
        educador,
        dataEntrega,
        entrega,
        liberacao
      ]);
    }

    if (novosRegistros.length === 0) {
      throw new Error('Nenhum aluno válido encontrado na folha para atualizar o histórico.');
    }

    // Lê todo o BD_Historico para substituir com segurança o bloco do pedido e eliminar duplicatas do mesmo título
    const totalBD = sheetBD.getLastRow();
    const linhasMantidas = [];

    if (totalBD > 1) {
      garantirDimensoesSheet_(sheetBD, totalBD, 9);
      const dadosBD = sheetBD.getRange(2, 1, totalBD - 1, 9).getValues();
      for (const r of dadosBD) {
        const rId = String(r[0] || '').trim();
        const rTit = String(r[2] || '').trim().toLowerCase();

        // Remove registros do ID sendo editado e também qualquer versão com o mesmo título exato
        const matchId = (rId === String(idPedido).trim() || rId.includes(String(idPedido).trim()));
        const matchTitulo = (titulo && rTit === titulo.toLowerCase());

        if (!matchId && !matchTitulo) {
          linhasMantidas.push(r);
        }
      }
    }

    // Acrescenta as novas linhas editadas
    for (const nr of novosRegistros) {
      linhasMantidas.push(nr);
    }

    // Reescreve os dados no _BD_Historico
    sheetBD.getRange(2, 1, Math.max(1, totalBD), 9).clearContent();
    if (linhasMantidas.length > 0) {
      garantirDimensoesSheet_(sheetBD, 1 + linhasMantidas.length, 9);
      sheetBD.getRange(2, 1, linhasMantidas.length, 9).setValues(linhasMantidas);
    }

    // Limpa estado de edição
    props.deleteProperty('EDITANDO_ID_PEDIDO');
    props.deleteProperty('EDITANDO_TITULO_PEDIDO');
    props.deleteProperty('EDITANDO_DATA_ORIGINAL');

    // Executa consolidação preventiva de duplicidades
    try {
      consolidarPedidosDuplicadosHistorico();
    } catch (eConsol) {}

    // Invalida cache de histórico
    try {
      CacheService.getScriptCache().remove(CONFIG.CACHE.HISTORICO_KEY);
    } catch (eCache) {}

    // Ativa o Dashboard primeiro para que o Google Sheets permita ocultar a folha de trabalho
    const nomeDash = CONFIG.SHEETS.DASHBOARD || 'Dashboard';
    let sheetDash = ss.getSheetByName(nomeDash);
    if (sheetDash) {
      sheetDash.showSheet();
      ss.setActiveSheet(sheetDash);
    }

    // Limpa a folha de trabalho e oculta
    sheetAtual.clear();
    sheetAtual.clearFormats();
    try {
      sheetAtual.hideSheet();
    } catch (eHide) {
      Logger.log('[ArchiveManager] Aviso ao ocultar folha de edição salva: ' + eHide.message);
    }

    // Atualiza o Dashboard e foca nele sem recriar do zero
    try {
      if (typeof gerarOuAtualizarDashboard === 'function') {
        gerarOuAtualizarDashboard(true, false);
      }
      if (typeof recolherAbasParaDashboard === 'function') {
        recolherAbasParaDashboard();
      }
    } catch (eDash) {}

    ss.toast(`Edição do pedido "${titulo}" salva com sucesso no histórico! (${novosRegistros.length} materiais atualizados)`, 'Histórico Atualizado', 6);

    return {
      sucesso: true,
      idPedido: idPedido,
      titulo: titulo,
      totalAlunos: novosRegistros.length
    };
  } finally {
    try {
      lock.releaseLock();
    } catch (eRel) {}
  }
}

/**
 * Cancela o modo de edição em andamento sem alterar o histórico e retorna ao Dashboard
 */
function cancelarEdicaoPedido() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const props = PropertiesService.getDocumentProperties();
  props.deleteProperty('EDITANDO_ID_PEDIDO');
  props.deleteProperty('EDITANDO_TITULO_PEDIDO');
  props.deleteProperty('EDITANDO_DATA_ORIGINAL');

  // 1. Ativa o Dashboard primeiro (Google Sheets não permite ocultar a aba que estiver ativa)
  const nomeDash = CONFIG.SHEETS.DASHBOARD || 'Dashboard';
  let sheetDash = ss.getSheetByName(nomeDash);
  if (sheetDash) {
    sheetDash.showSheet();
    ss.setActiveSheet(sheetDash);
  }

  // 2. Limpa e oculta a folha de pedido
  const sheetAtual = ss.getSheetByName(CONFIG.SHEETS.PEDIDO_PADRAO);
  if (sheetAtual) {
    sheetAtual.clear();
    sheetAtual.clearFormats();
    try {
      sheetAtual.hideSheet();
    } catch (eHide) {
      Logger.log('[ArchiveManager] Aviso ao ocultar folha de edição cancelada: ' + eHide.message);
    }
  }

  // 3. Atualiza o Dashboard rapidamente e recolhe abas
  try {
    if (typeof gerarOuAtualizarDashboard === 'function') {
      gerarOuAtualizarDashboard(true, false);
    }
    if (typeof recolherAbasParaDashboard === 'function') {
      recolherAbasParaDashboard();
    }
  } catch (eDash) {}

  if (ss) ss.toast('Edição cancelada. Nenhuma alteração foi salva no histórico.', 'Cancelado', 4);
}

/**
 * Altera manualmente a data, mês e ano de competência de um pedido arquivado no _BD_Historico.
 * Essencial para catalogar pedidos passados (ex: pedidos de Agosto registrados em Setembro).
 * @param {string} idPedido - ID do pedido a atualizar
 * @param {string} novaData - Data formatada (ex: 15/08/2026 14:00 ou 15/08/2026)
 * @param {string} [novoTitulo] - Título atualizado opcional
 * @returns {Object} Resultado da atualização
 */
function atualizarDataCompetenciaPedido(idPedido, novaData, novoTitulo) {
  if (!idPedido || !novaData) {
    throw new Error('ID do pedido e nova data são obrigatórios.');
  }
  idPedido = String(idPedido).trim();
  novaData = String(novaData).trim();

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  inicializarAbasSistema();

  const sheetBD = ss.getSheetByName(CONFIG.SHEETS.BD_HISTORICO);
  if (!sheetBD || sheetBD.getLastRow() <= 1) {
    throw new Error('Banco de histórico vazio.');
  }

  const totalLinhas = sheetBD.getLastRow();
  garantirDimensoesSheet_(sheetBD, totalLinhas, 9);
  const range = sheetBD.getRange(2, 1, totalLinhas - 1, 9);
  const dados = range.getValues();
  let atualizados = 0;

  const idClean = idPedido.replace('SHEET_BKP_', '').replace('PED_BKP_', '').replace(/[^a-zA-Z0-9_]/g, '');

  for (let i = 0; i < dados.length; i++) {
    const idLinha = String(dados[i][0] || '').trim();
    const matchDireto = idLinha === idPedido;
    const matchDerivado = idLinha.replace('PED_BKP_', '').replace('SHEET_BKP_', '').replace(/[^a-zA-Z0-9_]/g, '') === idClean;

    if (matchDireto || matchDerivado) {
      dados[i][1] = novaData;
      if (novoTitulo && String(novoTitulo).trim()) {
        dados[i][2] = String(novoTitulo).trim();
      }
      atualizados++;
    }
  }

  if (atualizados > 0) {
    range.setValues(dados);
    try {
      CacheService.getScriptCache().remove(CONFIG.CACHE.HISTORICO_KEY);
    } catch (eCache) {}
    try {
      if (typeof gerarOuAtualizarDashboard === 'function') {
        gerarOuAtualizarDashboard(false, false);
      }
    } catch (eDash) {}
  }

  return {
    sucesso: true,
    idPedido: idPedido,
    novaData: novaData,
    novoTitulo: novoTitulo || '',
    linhasAtualizadas: atualizados
  };
}

/**
 * Localiza pedidos duplicados no _BD_Historico (mesmo título e mesmos alunos arquivados)
 * e consolida em apenas uma via limpa, removendo duplicações acidentais.
 * @returns {Object} Resumo da consolidação
 */
function consolidarPedidosDuplicadosHistorico() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) return { duplicatasRemovidas: 0 };
  inicializarAbasSistema();

  const sheetBD = ss.getSheetByName(CONFIG.SHEETS.BD_HISTORICO);
  if (!sheetBD || sheetBD.getLastRow() <= 1) return { duplicatasRemovidas: 0 };

  const totalLinhas = sheetBD.getLastRow();
  garantirDimensoesSheet_(sheetBD, totalLinhas, 9);
  const dados = sheetBD.getRange(2, 1, totalLinhas - 1, 9).getValues();

  // Agrupa linhas por ID_Pedido
  const pedidosPorId = new Map();
  for (const r of dados) {
    const pid = String(r[0] || '').trim();
    if (!pid) continue;
    if (!pedidosPorId.has(pid)) pedidosPorId.set(pid, []);
    pedidosPorId.get(pid).push(r);
  }

  const assinaturasVistas = new Map();
  const idsParaRemover = new Set();

  for (const [pid, linhas] of pedidosPorId.entries()) {
    const titulo = String(linhas[0][2] || '').trim().toLowerCase();
    const alunos = linhas.map(l => String(l[3] || '').trim().toLowerCase()).sort().join('|||');
    const assinatura = `${titulo}:::${alunos}`;

    // Purga registros com marca de interface do Dashboard
    if (ehRegistroDashboard_(titulo, alunos)) {
      idsParaRemover.add(pid);
      Logger.log(`[ArchiveManager] Registro acidental de Dashboard marcado para exclusão: ${pid}`);
      continue;
    }

    if (assinaturasVistas.has(assinatura)) {
      idsParaRemover.add(pid);
      Logger.log(`[ArchiveManager] Pedido duplicado removido: ${pid} (duplicata de ${assinaturasVistas.get(assinatura)})`);
    } else {
      assinaturasVistas.set(assinatura, pid);
    }
  }

  if (idsParaRemover.size > 0) {
    const linhasLimpas = dados.filter(r => !idsParaRemover.has(String(r[0] || '').trim()));
    sheetBD.getRange(2, 1, totalLinhas - 1, 9).clearContent();
    if (linhasLimpas.length > 0) {
      garantirDimensoesSheet_(sheetBD, 1 + linhasLimpas.length, 9);
      sheetBD.getRange(2, 1, linhasLimpas.length, 9).setValues(linhasLimpas);
    }
    try {
      CacheService.getScriptCache().remove(CONFIG.CACHE.HISTORICO_KEY);
    } catch (eCache) {}
    try {
      gerarOuAtualizarDashboard(true, false);
      recolherAbasParaDashboard();
    } catch (eDash) {}
    if (ss) ss.toast(`Consolidação concluída: ${idsParaRemover.size} pedido(s) duplicado(s) removido(s).`, 'Histórico Limpo', 5);
  }

  return {
    sucesso: true,
    duplicatasRemovidas: idsParaRemover.size
  };
}

/**
 * Restaura um pedido arquivado em uma nova aba dedicada para conferência ou reimpressão.
 * Suporta tanto registros do _BD_Historico quanto abas físicas de backup.
 * @param {string} idPedido - ID do pedido ou identificador da aba de backup
 * @returns {Object} Informações sobre a aba criada e registros restaurados
 */
function restaurarPedidoEmNovaAba(idPedido) {
  if (!idPedido) {
    throw new Error('ID do pedido não informado para restauração.');
  }
  idPedido = String(idPedido).trim();
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Tenta restaurar diretamente a partir da aba física de backup, se existir
  let bkpSheet = null;
  if (idPedido.startsWith('SHEET_BKP_')) {
    const rawName = idPedido.replace('SHEET_BKP_', '');
    bkpSheet = ss.getSheetByName(rawName);
  } else if (idPedido.startsWith('PED_BKP_')) {
    const rawClean = idPedido.replace('PED_BKP_', '');
    for (const s of ss.getSheets()) {
      if (s.getName().replace(/[^a-zA-Z0-9_]/g, '') === rawClean) {
        bkpSheet = s;
        break;
      }
    }
  }

  if (bkpSheet) {
    let titulo = '';
    try {
      titulo = String(bkpSheet.getRange('A2').getValue() || '').trim();
    } catch (e) {}
    if (!titulo) titulo = bkpSheet.getName();

    const nomeAba = sanitizarNomeAbaLocal_(`Histórico - ${titulo}`);
    const abaExistente = ss.getSheetByName(nomeAba);
    if (abaExistente) {
      criarBackupAba_(abaExistente, CONFIG.BACKUP.PREFIXO_SOBRESCRITA);
      try {
        ss.deleteSheet(abaExistente);
      } catch (eDel) {
        abaExistente.setName(sanitizarNomeAbaLocal_(nomeAba + '_Old'));
      }
    }

    const copia = bkpSheet.copyTo(ss);
    copia.setName(nomeAba);
    copia.showSheet();
    ss.setActiveSheet(copia);

    const totalItens = Math.max(0, copia.getLastRow() - 4);
    Logger.log(`[ArchiveManager] Backup "${bkpSheet.getName()}" restaurado com sucesso na nova aba "${nomeAba}".`);
    return {
      sucesso: true,
      nomeAba: nomeAba,
      totalItens: totalItens
    };
  }

  // 2. Se não for aba física direta, restaura a partir dos registros do _BD_Historico
  const sheetBD = ss.getSheetByName(CONFIG.SHEETS.BD_HISTORICO);
  if (!sheetBD || sheetBD.getLastRow() <= 1) {
    throw new Error('Banco de histórico vazio e nenhuma aba de backup correspondente encontrada.');
  }

  garantirDimensoesSheet_(sheetBD, sheetBD.getLastRow(), 9);
  const valores = sheetBD.getRange(2, 1, sheetBD.getLastRow() - 1, 9).getValues();
  const linhasFiltradas = valores.filter(r => String(r[0] || '').trim() === idPedido);

  if (linhasFiltradas.length === 0) {
    throw new Error(`Pedido "${idPedido}" não encontrado no histórico.`);
  }

  const titulo = linhasFiltradas[0][2] || 'Pedido Restaurado';
  const nomeAba = sanitizarNomeAbaLocal_(`Histórico - ${titulo}`);

  // Se já existir aba com esse nome, cria backup preventivo antes de substituir
  const abaExistente = ss.getSheetByName(nomeAba);
  if (abaExistente) {
    criarBackupAba_(abaExistente, CONFIG.BACKUP.PREFIXO_SOBRESCRITA);
    try {
      ss.deleteSheet(abaExistente);
    } catch (eDel) {
      abaExistente.setName(sanitizarNomeAbaLocal_(nomeAba + '_Old'));
    }
    Logger.log(`[ArchiveManager] Aba existente "${nomeAba}" substituída com backup preventivo.`);
  }

  const novaAba = ss.insertSheet(nomeAba);
  ss.setActiveSheet(novaAba);

  // Prepara estrutura visual
  if (typeof prepararFolhaPedido === 'function') {
    prepararFolhaPedido(titulo, true);
  }
  try {
    novaAba.setName(nomeAba);
  } catch (eName) {}

  // Insere os dados restaurados
  const dadosInserir = linhasFiltradas.map(r => [
    r[3], // Aluno
    r[4], // Matéria
    r[5], // Educador
    r[6], // Data Entrega
    r[7], // Entrega
    r[8]  // Liberação
  ]);

  garantirDimensoesSheet_(novaAba, 5 + dadosInserir.length + 10, 7);
  novaAba.getRange(5, 1, dadosInserir.length, 6).setValues(dadosInserir);
  if (typeof formatarLinhasEmBranco === 'function') {
    formatarLinhasEmBranco(novaAba, 5, dadosInserir.length);
    formatarLinhasEmBranco(novaAba, 5 + dadosInserir.length, 10);
  }

  Logger.log(`[ArchiveManager] Pedido "${titulo}" restaurado na aba "${nomeAba}" (${dadosInserir.length} registros).`);

  return {
    sucesso: true,
    nomeAba: nomeAba,
    totalItens: dadosInserir.length
  };
}

/**
 * Edita o título de um pedido arquivado, atualizando no _BD_Historico
 * e na célula A2 da aba física de backup (se existir).
 * @param {string} idPedido - ID do pedido a ser editado
 * @param {string} novoTitulo - Novo título para o pedido
 * @returns {Object} Resultado da edição
 */
function editarTituloPedidoHistorico(idPedido, novoTitulo) {
  if (!idPedido) throw new Error('ID do pedido não informado.');
  novoTitulo = String(novoTitulo || '').trim();
  if (!novoTitulo) throw new Error('O título do pedido não pode ser vazio.');

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let abaAtualizada = null;

  // 1. Atualiza na aba física correspondente, se houver
  let bkpSheet = null;
  if (idPedido.startsWith('SHEET_BKP_')) {
    const rawName = idPedido.replace('SHEET_BKP_', '');
    bkpSheet = ss.getSheetByName(rawName);
  } else if (idPedido.startsWith('PED_BKP_')) {
    const rawClean = idPedido.replace('PED_BKP_', '');
    for (const s of ss.getSheets()) {
      if (s.getName().replace(/[^a-zA-Z0-9_]/g, '') === rawClean) {
        bkpSheet = s;
        break;
      }
    }
  }

  if (bkpSheet) {
    abaAtualizada = bkpSheet.getName();
    try {
      bkpSheet.getRange('A2').setValue(novoTitulo);
      Logger.log(`[ArchiveManager] Título atualizado na aba física "${abaAtualizada}" para "${novoTitulo}".`);
    } catch (e) {}
  }

  // 2. Atualiza no _BD_Historico
  inicializarAbasSistema();
  const sheetBD = ss.getSheetByName(CONFIG.SHEETS.BD_HISTORICO);
  let linhasAtualizadas = 0;

  if (sheetBD && sheetBD.getLastRow() > 1) {
    const totalLinhas = sheetBD.getLastRow();
    garantirDimensoesSheet_(sheetBD, totalLinhas, 9);
    const dados = sheetBD.getRange(2, 1, totalLinhas - 1, 9).getValues();
    const idClean = idPedido.replace('SHEET_BKP_', '').replace(/[^a-zA-Z0-9_]/g, '');

    for (let i = 0; i < dados.length; i++) {
      const idLinha = String(dados[i][0] || '').trim();
      const matchDireto = idLinha === idPedido;
      const matchDerivado = idLinha.replace('PED_BKP_', '') === idClean;
      const matchAba = abaAtualizada && idLinha.includes(abaAtualizada.replace(/[^a-zA-Z0-9_]/g, ''));

      if (matchDireto || matchDerivado || matchAba) {
        dados[i][2] = novoTitulo; // Coluna C: Titulo_Pedido
        linhasAtualizadas++;
      }
    }

    if (linhasAtualizadas > 0) {
      sheetBD.getRange(2, 1, dados.length, 9).setValues(dados);
      Logger.log(`[ArchiveManager] ${linhasAtualizadas} linha(s) atualizadas com o novo título no _BD_Historico.`);
    }
  }

  // 3. Invalida cache de histórico
  try {
    CacheService.getScriptCache().remove(CONFIG.CACHE.HISTORICO_KEY);
  } catch (eCache) {}

  return {
    sucesso: true,
    idPedido: idPedido,
    novoTitulo: novoTitulo,
    linhasAtualizadas: linhasAtualizadas,
    abaAtualizada: abaAtualizada
  };
}

/**
 * Apaga um pedido específico do histórico, removendo seus registros do _BD_Historico
 * e excluindo a aba física de backup da planilha caso exista.
 * @param {string} idPedido - ID do pedido a ser removido
 * @returns {Object} Resultado da exclusão
 */
function apagarPedidoHistorico(idPedido) {
  if (!idPedido) throw new Error('ID do pedido não informado para exclusão.');
  idPedido = String(idPedido).trim();
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let abaExcluida = null;

  // 1. Localiza e exclui a aba física correspondente, se houver
  let bkpSheet = null;
  if (idPedido.startsWith('SHEET_BKP_')) {
    const rawName = idPedido.replace('SHEET_BKP_', '');
    bkpSheet = ss.getSheetByName(rawName);
  } else if (idPedido.startsWith('PED_BKP_')) {
    const rawClean = idPedido.replace('PED_BKP_', '');
    for (const s of ss.getSheets()) {
      if (s.getName().replace(/[^a-zA-Z0-9_]/g, '') === rawClean) {
        bkpSheet = s;
        break;
      }
    }
  }

  if (bkpSheet) {
    abaExcluida = bkpSheet.getName();
    try {
      ss.deleteSheet(bkpSheet);
      Logger.log(`[ArchiveManager] Aba física de backup "${abaExcluida}" excluída da planilha.`);
    } catch (eDel) {
      Logger.log(`[ArchiveManager] Aviso ao excluir aba física "${abaExcluida}": ${eDel.message}`);
    }
  }

  // 2. Remove os registros do _BD_Historico
  inicializarAbasSistema();
  const sheetBD = ss.getSheetByName(CONFIG.SHEETS.BD_HISTORICO);
  let linhasRemovidas = 0;

  if (sheetBD && sheetBD.getLastRow() > 1) {
    const totalLinhas = sheetBD.getLastRow();
    garantirDimensoesSheet_(sheetBD, totalLinhas, 9);
    const dados = sheetBD.getRange(2, 1, totalLinhas - 1, 9).getValues();
    const idClean = idPedido.replace('SHEET_BKP_', '').replace(/[^a-zA-Z0-9_]/g, '');

    const dadosRestantes = dados.filter(r => {
      const idLinha = String(r[0] || '').trim();
      const matchDireto = idLinha === idPedido;
      const matchDerivado = idLinha.replace('PED_BKP_', '') === idClean;
      const matchAba = abaExcluida && idLinha.includes(abaExcluida.replace(/[^a-zA-Z0-9_]/g, ''));

      if (matchDireto || matchDerivado || matchAba) {
        linhasRemovidas++;
        return false;
      }
      return true;
    });

    if (linhasRemovidas > 0) {
      sheetBD.getRange(2, 1, totalLinhas - 1, 9).clearContent();
      if (dadosRestantes.length > 0) {
        garantirDimensoesSheet_(sheetBD, dadosRestantes.length + 1, 9);
        sheetBD.getRange(2, 1, dadosRestantes.length, 9).setValues(dadosRestantes);
      }
      Logger.log(`[ArchiveManager] ${linhasRemovidas} registro(s) do pedido "${idPedido}" removidos do _BD_Historico.`);
    }
  }

  // 3. Invalida cache de histórico
  try {
    CacheService.getScriptCache().remove(CONFIG.CACHE.HISTORICO_KEY);
  } catch (eCache) {}

  // 4. Atualiza os indicadores e a tabela do Dashboard automaticamente
  try {
    if (typeof gerarOuAtualizarDashboard === 'function') {
      gerarOuAtualizarDashboard(false, false);
    }
  } catch (eDash) {}

  return {
    sucesso: true,
    idPedido: idPedido,
    linhasRemovidas: linhasRemovidas,
    abaExcluida: abaExcluida
  };
}

/**
 * Detecta se um título ou aluno pertence à interface visual do Dashboard
 * @param {string} titulo - Título do pedido
 * @param {string} aluno - Nome do aluno ou texto da coluna
 * @returns {boolean} True se for registro de interface do Dashboard
 */
function ehRegistroDashboard_(titulo, aluno) {
  const t = String(titulo || '').toUpperCase();
  const a = String(aluno || '').toUpperCase();
  const termosProibidos = [
    'MICROLINS POTIRENDABA',
    'CENTRAL DE GESTÃO',
    'PAINEL DE CONTROLE',
    '⚡ AÇÕES RÁPIDAS',
    'AÇÕES RÁPIDAS',
    'INDICADORES GERAIS',
    'ABRIR CENTRAL',
    'NOVO PEDIDO RÁPIDO',
    'ARQUIVAR PEDIDO ATUAL',
    'VER HISTÓRICO',
    'ATUALIZAR DASHBOARD',
    'TOTAL DE PEDIDOS ARQUIVADOS',
    'ALUNOS ATENDIDOS',
    'APOSTILAS SOLICITADAS',
    'ÚLTIMOS PEDIDOS REGISTRADOS',
    'Nº ORDEM',
    'MÊS/ANO'
  ];

  if (t.includes('MICROLINS') || t.includes('PAINEL DE CONTROLE') || t.includes('DASHBOARD') || t.includes('CENTRAL DE GESTÃO')) {
    return true;
  }
  if (a.includes('✏️') || a.includes('ABRIR CENTRAL') || a.includes('AÇÕES RÁPIDAS') || a.includes('INDICADORES') || a.includes('CENTRAL DE GESTÃO')) {
    return true;
  }
  return termosProibidos.some(termo => t.includes(termo) || a.includes(termo));
}

/**
 * Remove registros acidentais do Dashboard que tenham sido salvos indevidamente no _BD_Historico
 * @returns {Object} { corrompidosRemovidos: number }
 */
function limparRegistrosCorrompidosHistorico() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) return { corrompidosRemovidos: 0 };
  inicializarAbasSistema();

  const sheetBD = ss.getSheetByName(CONFIG.SHEETS.BD_HISTORICO);
  if (!sheetBD || sheetBD.getLastRow() <= 1) return { corrompidosRemovidos: 0 };

  const totalLinhas = sheetBD.getLastRow();
  garantirDimensoesSheet_(sheetBD, totalLinhas, 9);
  const dados = sheetBD.getRange(2, 1, totalLinhas - 1, 9).getValues();

  const idsParaRemover = new Set();
  for (const r of dados) {
    const pid = String(r[0] || '').trim();
    const titulo = String(r[2] || '');
    const aluno = String(r[3] || '');
    if (!pid) continue;

    if (ehRegistroDashboard_(titulo, aluno)) {
      idsParaRemover.add(pid);
      Logger.log(`[ArchiveManager] Pedido corrompido de Dashboard identificado para remoção: ID ${pid} (Título: "${titulo}")`);
    }
  }

  if (idsParaRemover.size > 0) {
    const linhasLimpas = dados.filter(r => !idsParaRemover.has(String(r[0] || '').trim()));
    sheetBD.getRange(2, 1, totalLinhas - 1, 9).clearContent();
    if (linhasLimpas.length > 0) {
      garantirDimensoesSheet_(sheetBD, 1 + linhasLimpas.length, 9);
      sheetBD.getRange(2, 1, linhasLimpas.length, 9).setValues(linhasLimpas);
    }
    try {
      CacheService.getScriptCache().remove(CONFIG.CACHE.HISTORICO_KEY);
    } catch (eCache) {}
    try {
      if (typeof gerarOuAtualizarDashboard === 'function') {
        gerarOuAtualizarDashboard(true, true);
      }
    } catch (eDash) {}
    Logger.log(`[ArchiveManager] ${idsParaRemover.size} registro(s) acidentais de Dashboard removidos com sucesso do _BD_Historico.`);
  }

  return { corrompidosRemovidos: idsParaRemover.size };
}

/**
 * Prompt para executar a limpeza e restauração do Histórico e Dashboard pelo menu
 */
function limparRegistrosCorrompidosHistoricoPrompt() {
  const ui = SpreadsheetApp.getUi();
  try {
    const res = limparRegistrosCorrompidosHistorico();
    if (typeof gerarOuAtualizarDashboard === 'function') {
      gerarOuAtualizarDashboard(true, true);
    }
    ui.alert(
      'Limpeza Concluída',
      `Foram removidos ${res.corrompidosRemovidos} registro(s) acidentais de Dashboard do Histórico.\n\nO Dashboard foi recalculado e restaurado com sucesso!`,
      ui.ButtonSet.OK
    );
  } catch (err) {
    ui.alert('Erro na Limpeza', err.message, ui.ButtonSet.OK);
  }
}

