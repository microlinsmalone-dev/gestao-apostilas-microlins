/**
 * ==============================================================================
 * GESTÃO DE APOSTILAS - MICROLINS
 * Arquivo: UiMenu.js
 * Descrição: Menus personalizados da barra superior do Google Sheets e gatilhos de modais
 * ==============================================================================
 */

/**
 * Executa automaticamente ao abrir a planilha no Google Sheets
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Gestão de Apostilas')
    .addItem('🏠 Ir para o Dashboard (Início)', 'abrirDashboard')
    .addItem('🚀 Central de Apostilas (Painel Completo)', 'abrirPainelCentral')
    .addItem('📄 Novo Pedido Rápido', 'prepararNovaPlanilhaPrompt')
    .addItem('📦 Arquivar Pedido Atual', 'arquivarPedidoAtualPrompt')
    .addItem('📚 Histórico de Pedidos', 'abrirDialogoHistorico')
    .addSeparator()
    .addItem('💾 Salvar Edição no Histórico', 'salvarEdicaoPedidoHistorico')
    .addItem('❌ Cancelar Edição de Pedido', 'cancelarEdicaoPedido')
    .addSeparator()
    .addItem('🖨️ Exportar para PDF', 'exportarPedidoPDF')
    .addItem('📊 Exportar para Excel', 'exportarPedidoExcel')
    .addSeparator()
    .addItem('⚙️ Configurações (Microlins)', 'abrirAbaConfiguracoes')
    .addItem('🧹 Limpar Abas Antigas de Backup', 'limparAbasBackupAntigasPrompt')
    .addItem('🧹 Remover Pedidos Duplicados no Histórico', 'consolidarPedidosDuplicadosHistoricoPrompt')
    .addItem('🧹 Limpar Registros Acidentais do Dashboard', 'limparRegistrosCorrompidosHistoricoPrompt')
    .addToUi();

  // Inicializa abas essenciais de suporte caso não existam
  try {
    inicializarAbasSistema();
  } catch (e) {
    console.error('Falha na inicialização das abas de sistema:', e);
  }

  // Inicializa e posiciona o Dashboard como tela inicial e recolhe abas secundárias
  try {
    if (typeof gerarOuAtualizarDashboard === 'function') {
      gerarOuAtualizarDashboard(true);
    }
    if (typeof recolherAbasParaDashboard === 'function') {
      recolherAbasParaDashboard();
    }
  } catch (eDash) {
    console.error('Falha ao inicializar Dashboard na abertura:', eDash);
  }
}

/**
 * Helper para carregar templates HTML de forma resiliente, suportando
 * diferentes convenções de nomenclatura no Google Apps Script ('ui/Nome', 'Nome', 'ui_Nome').
 */
function createTemplateSafely(fileName) {
  const base = fileName.replace(/\.html$/i, '');
  const cleanName = base.replace(/^ui[\/\_]/i, '');
  const candidates = [
    base,
    cleanName,
    'ui/' + cleanName,
    'ui_' + cleanName,
    base + '.html',
    cleanName + '.html'
  ];

  const unique = [...new Set(candidates)];
  let lastError = null;
  for (const name of unique) {
    try {
      return HtmlService.createTemplateFromFile(name);
    } catch (e) {
      lastError = e;
    }
  }
  throw new Error(`Nenhum arquivo HTML encontrado para "${fileName}". Candidatos testados: ${unique.join(', ')}. Verifique se o arquivo existe no editor do Apps Script.`);
}

/**
 * Abre o painel completo da Central de Apostilas em janela ampla e moderna
 */
function abrirPainelCentral() {
  const html = createTemplateSafely('ui/WebApp')
    .evaluate()
    .setTitle('Central de Gestão de Apostilas • Microlins Potirendaba')
    .setWidth(1020)
    .setHeight(660);
  SpreadsheetApp.getUi().showModalDialog(html, 'Central de Gestão de Apostilas • Microlins');
}

/**
 * Ativa a aba de configurações estilizada da Microlins
 */
function abrirAbaConfiguracoes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEETS.CONFIGURACOES);
  if (!sheet) {
    sheet = inicializarAbasSistema();
  }
  ss.setActiveSheet(sheet);
  ss.toast('Aba de Configurações da Microlins Potirendaba ativada.', 'Configurações', 3);
}

/**
 * Função utilitária para incluir arquivos HTML parciais nos diálogos e templates
 */
function include(filename) {
  const base = filename.replace(/\.html$/i, '');
  const cleanName = base.replace(/^ui[\/\_]/i, '');
  const candidates = [
    base,
    cleanName,
    'ui/' + cleanName,
    'ui_' + cleanName,
    base + '.html',
    cleanName + '.html'
  ];

  const unique = [...new Set(candidates)];
  let lastError = null;
  for (const name of unique) {
    try {
      return HtmlService.createHtmlOutputFromFile(name).getContent();
    } catch (e) {
      lastError = e;
    }
  }
  throw new Error(`Arquivo HTML "${filename}" não encontrado para inclusão. Candidatos testados: ${unique.join(', ')}.`);
}

/**
 * Ponto de entrada executado quando o projeto é acessado via URL de Web App (.../exec)
 */
function doGet(e) {
  const template = createTemplateSafely('ui/WebApp');
  return template.evaluate()
    .setTitle('Gestão de Apostilas • Microlins Potirendaba')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Diálogo para Preparar Nova Planilha com textos ajustados conforme solicitação
 */
function prepararNovaPlanilhaPrompt() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetAtiva = ss.getActiveSheet();

  const nomeDash = CONFIG.SHEETS.DASHBOARD || 'Dashboard';
  const NOMES_SISTEMA = [CONFIG.SHEETS.BD_HISTORICO, CONFIG.SHEETS.CONFIGURACOES, nomeDash];

  // Garante que a folha alvo seja uma folha de pedido válida (nunca sistema ou backup)
  let folhaAlvo = sheetAtiva;
  if (!folhaAlvo || NOMES_SISTEMA.includes(folhaAlvo.getName()) || folhaAlvo.getName().startsWith('Bkp_') || folhaAlvo.getName().startsWith('Backup_')) {
    folhaAlvo = ss.getSheetByName(CONFIG.SHEETS.PEDIDO_PADRAO) || ss.insertSheet(CONFIG.SHEETS.PEDIDO_PADRAO);
  }

  const temRegistros = folhaAlvo && !NOMES_SISTEMA.includes(folhaAlvo.getName()) && folhaAlvo.getLastRow() >= 5;

  const msg = temRegistros
    ? `Insira o título para a nova folha de pedido:\n\nℹ️ Os registros da folha "${folhaAlvo.getName()}" serão arquivados automaticamente no Histórico.`
    : 'Insira o título da nova folha de pedido:';

  const response = ui.prompt(
    'Novo Pedido',
    msg,
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() === ui.Button.OK) {
    const textoDigitado = response.getResponseText().trim();
    const titulo = textoDigitado || 'ENTREGA DE MATERIAL - PEDIDO';

    folhaAlvo.showSheet();
    ss.setActiveSheet(folhaAlvo);

    prepararFolhaPedido(titulo, false, folhaAlvo);
  }
}

/**
 * Abre o diálogo de importação de relatório
 */
function abrirDialogoImportacao() {
  const html = createTemplateSafely('ui/DialogImport')
    .evaluate()
    .setTitle('Importar Relatório')
    .setWidth(720)
    .setHeight(560);
  SpreadsheetApp.getUi().showModalDialog(html, 'Importação de Dados');
}

/**
 * Abre o diálogo de verificação de duplicidades
 */
function abrirDialogoDuplicidades(duplicidades) {
  const template = createTemplateSafely('ui/DialogDuplicates');
  template.duplicidades = duplicidades;
  const html = template.evaluate()
    .setTitle('Duplicidades Identificadas')
    .setWidth(740)
    .setHeight(500);
  SpreadsheetApp.getUi().showModalDialog(html, 'Duplicidades Identificadas no Pedido');
}

/**
 * Abre o diálogo de gerenciamento de educadores
 */
function abrirDialogoEducadores() {
  const html = createTemplateSafely('ui/DialogEducators')
    .evaluate()
    .setTitle('Configurar Educadores')
    .setWidth(600)
    .setHeight(480);
  SpreadsheetApp.getUi().showModalDialog(html, 'Configuração de Educadores');
}

/**
 * Abre o diálogo de histórico de pedidos arquivados
 */
function abrirDialogoHistorico() {
  const html = createTemplateSafely('ui/DialogArchive')
    .evaluate()
    .setTitle('Histórico de Pedidos')
    .setWidth(780)
    .setHeight(540);
  SpreadsheetApp.getUi().showModalDialog(html, 'Histórico de Pedidos Arquivados');
}

/**
 * Ativa a aba Dashboard e atualiza seus indicadores
 */
function abrirDashboard() {
  if (typeof gerarOuAtualizarDashboard === 'function') {
    gerarOuAtualizarDashboard(true);
  }
  if (typeof recolherAbasParaDashboard === 'function') {
    recolherAbasParaDashboard();
  }
}

/**
 * Prompt para confirmação de arquivamento da folha ativa
 */
function arquivarPedidoAtualPrompt() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetAtiva = ss.getActiveSheet();

  const nomeDash = CONFIG.SHEETS.DASHBOARD || 'Dashboard';
  const NOMES_SISTEMA = [CONFIG.SHEETS.BD_HISTORICO, CONFIG.SHEETS.CONFIGURACOES, nomeDash];

  // Se a aba ativa for Dashboard ou sistema, tenta localizar a folha de pedido válida
  let folhaAlvo = sheetAtiva;
  if (!folhaAlvo || NOMES_SISTEMA.includes(folhaAlvo.getName())) {
    folhaAlvo = (typeof obterAbaPedidoAtiva === 'function') ? obterAbaPedidoAtiva() : null;
  }

  if (!folhaAlvo || NOMES_SISTEMA.includes(folhaAlvo.getName()) || folhaAlvo.getLastRow() < 5) {
    ui.alert('Aviso', 'Não há folha de pedido aberta com registros de alunos para arquivar.', ui.ButtonSet.OK);
    return;
  }

  let titulo = '';
  try {
    titulo = String(folhaAlvo.getRange('A2').getValue() || folhaAlvo.getName()).trim();
  } catch (e) {}

  const resposta = ui.alert(
    'Arquivar Pedido',
    `Deseja realmente arquivar o pedido "${titulo}" (aba: ${folhaAlvo.getName()}) no histórico consolidado e retornar ao Dashboard?`,
    ui.ButtonSet.YES_NO
  );

  if (resposta === ui.Button.YES) {
    arquivarPedidoAtual(folhaAlvo.getName());
    ui.alert('Sucesso', `O pedido "${titulo}" foi arquivado com sucesso no histórico.`, ui.ButtonSet.OK);
  }
}

/**
 * Prompt para confirmação de higienização de abas antigas de backup
 */
function limparAbasBackupAntigasPrompt() {
  const ui = SpreadsheetApp.getUi();
  const resposta = ui.alert(
    'Higienização da Planilha',
    'Esta ação irá verificar todas as abas antigas de backup (Bkp_*), salvar qualquer registro pendente no histórico definitivo e remover as abas de backup para deixar a planilha limpa.\n\nDeseja continuar?',
    ui.ButtonSet.YES_NO
  );

  if (resposta === ui.Button.YES) {
    const res = limparAbasBackupAntigas();
    ui.alert(
      'Higienização Concluída',
      `Foram removidas ${res.removidas} aba(s) de backup antigas.\n${res.totalAdicionados} registro(s) foram sincronizados no banco.\n\nSua planilha está 100% limpa!`,
      ui.ButtonSet.OK
    );
  }
}

/**
 * Prompt para confirmação de higienização de pedidos duplicados no histórico consolidado
 */
function consolidarPedidosDuplicadosHistoricoPrompt() {
  const ui = SpreadsheetApp.getUi();
  const resposta = ui.alert(
    'Higienização de Duplicidades no Histórico',
    'Esta ação irá analisar a base consolidada (_BD_Historico) e remover registros duplicados acidentais (mesmo pedido arquivado mais de uma vez).\n\nDeseja continuar?',
    ui.ButtonSet.YES_NO
  );

  if (resposta === ui.Button.YES) {
    const res = consolidarPedidosDuplicadosHistorico();
    ui.alert(
      'Consolidação Concluída',
      res.duplicatasRemovidas > 0
        ? `Foram consolidadas e removidas ${res.duplicatasRemovidas} linha(s) duplicada(s) no histórico.\n\nSeu banco de dados está 100% limpo e sincronizado!`
        : 'Nenhuma duplicidade foi encontrada no histórico. Todos os pedidos já estão perfeitamente consolidados!',
      ui.ButtonSet.OK
    );
  }
}

/**
 * Gatilho simples que responde a interações rápidas no Dashboard via caixas de seleção
 */
function onEdit(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  const nomeDash = CONFIG.SHEETS.DASHBOARD || 'Dashboard';
  if (sheet.getName() !== nomeDash) return;

  const col = e.range.getColumn();
  const row = e.range.getRow();
  const valor = e.range.getValue();

  // Interação nas Caixas de Ações Rápidas (Coluna B, Linhas 6 a 11)
  if (col === 2 && row >= 6 && row <= 11) {
    // Desmarca a caixa imediatamente para permitir novo clique futuro
    e.range.setValue(false);

    switch (row) {
      case 6: // Abrir Central Completa
        abrirPainelCentral();
        break;
      case 7: // Novo Pedido Rápido
        prepararNovaPlanilhaPrompt();
        break;
      case 8: // Arquivar Pedido Atual
        arquivarPedidoAtualPrompt();
        break;
      case 9: // Ver Histórico
        abrirDialogoHistorico();
        break;
      case 10: // Configurações
        abrirAbaConfiguracoes();
        break;
      case 11: // Atualizar Dashboard
        gerarOuAtualizarDashboard(true);
        break;
    }
    return;
  }

  // Interação na Tabela de Pedidos Recentes (Coluna B, Linhas 15 a 20 - Atalho de Edição)
  if (col === 2 && row >= 15 && row <= 20) {
    const numOrdem = String(sheet.getRange(row, 3).getValue() || '').trim();
    if (numOrdem) {
      const lista = (typeof listarPedidosArquivados === 'function') ? listarPedidosArquivados() : [];
      const pedido = lista.find(p => p.numOrdem === numOrdem);
      if (pedido && pedido.idPedido) {
        sheet.getRange(row, 2).setValue(`[ ✏️ Editar ${numOrdem} ]`);
        abrirPedidoParaEdicao(pedido.idPedido);
      }
    }
  }
}
