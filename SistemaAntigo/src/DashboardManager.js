/**
 * ==============================================================================
 * GESTÃO DE APOSTILAS - MICROLINS
 * Arquivo: DashboardManager.js
 * Descrição: Criação, estilização e atualização rápida da tela inicial "Dashboard" no Sheets
 * ==============================================================================
 */

/**
 * Cria ou atualiza a aba Dashboard como tela inicial do sistema no Google Sheets.
 * Se a estrutura já existir, apenas atualiza os dados dinâmicos (KPIs e histórico recente)
 * sem recriar a planilha do zero e sem piscar a tela.
 * @param {boolean} [ativar=true] - Se true, torna o Dashboard a aba ativa
 * @param {boolean} [forcarReconstrucao=false] - Se true, reconstrói toda a estrutura visual
 * @returns {Sheet} A aba Dashboard formatada
 */
function gerarOuAtualizarDashboard(ativar, forcarReconstrucao) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) return null;

  inicializarAbasSistema();

  const nomeDashboard = CONFIG.SHEETS.DASHBOARD || 'Dashboard';
  let sheet = ss.getSheetByName(nomeDashboard);
  if (!sheet) {
    sheet = ss.insertSheet(nomeDashboard, 0);
  } else {
    // Garante que fique na primeira posição (extrema esquerda)
    try {
      if (sheet.getIndex() !== 1) {
        ss.setActiveSheet(sheet);
        ss.moveActiveSheet(1);
      }
    } catch (eMove) {}
  }

  // Verifica se a estrutura visual base já foi montada
  let precisaConstruir = forcarReconstrucao === true;
  if (!precisaConstruir) {
    try {
      const bannerVal = sheet.getRange('B2').getValue();
      if (bannerVal !== 'MICROLINS POTIRENDABA • CENTRAL DE GESTÃO DE APOSTILAS') {
        precisaConstruir = true;
      }
    } catch (eCheck) {
      precisaConstruir = true;
    }
  }

  if (precisaConstruir) {
    construirEstruturaVisualDashboard_(sheet);
  }

  // Atualiza apenas os valores dinâmicos dos KPIs e da tabela de recentes
  const resumo = obterResumoDashboard();
  atualizarValoresDashboard_(sheet, resumo);

  // Ativa a aba se solicitado
  if (ativar !== false) {
    try {
      sheet.showSheet();
      ss.setActiveSheet(sheet);
    } catch (eAct) {}
  }

  return sheet;
}

/**
 * Constrói a estrutura visual fixa do Dashboard (banner, botões com rótulos e caixas de seleção)
 * Executado apenas na primeira criação ou quando forçada a reconstrução.
 * @param {Sheet} sheet - Aba do Dashboard
 */
function construirEstruturaVisualDashboard_(sheet) {
  try {
    sheet.setHiddenGridlines(true);
  } catch (eGrid) {}

  garantirDimensoesSheet_(sheet, 32, 9);
  sheet.clear();
  sheet.clearFormats();

  // 1. Configurar larguras de colunas
  sheet.setColumnWidth(1, 25);  // A - Respiro lateral
  sheet.setColumnWidth(2, 40);  // B - Checkbox de ação
  sheet.setColumnWidth(3, 190); // C - Rótulo da Ação
  sheet.setColumnWidth(4, 20);  // D - Respiro
  sheet.setColumnWidth(5, 145); // E - KPI 1 (Total Pedidos)
  sheet.setColumnWidth(6, 155); // F - KPI 2 (Apostilas)
  sheet.setColumnWidth(7, 145); // G - KPI 3 (Mês)
  sheet.setColumnWidth(8, 175); // H - KPI 4 (Situação)
  sheet.setColumnWidth(9, 25);  // I - Respiro lateral

  // 2. Linha 1 de respiro
  sheet.setRowHeight(1, 14);

  // 3. Linha 2 - Banner Corporativo Microlins Potirendaba (B2:H2)
  const banner = sheet.getRange('B2:H2');
  banner.merge();
  banner.setValue('MICROLINS POTIRENDABA • CENTRAL DE GESTÃO DE APOSTILAS');
  banner.setBackground(CONFIG.ESTILOS.MICROLINS_BLUE);
  banner.setFontColor('#ffffff');
  banner.setFontFamily('Arial');
  banner.setFontSize(13);
  banner.setFontWeight('bold');
  banner.setHorizontalAlignment('center');
  banner.setVerticalAlignment('middle');
  sheet.setRowHeight(2, 36);

  // 4. Linha 3 - Subtítulo Institucional (B3:H3)
  const subBanner = sheet.getRange('B3:H3');
  subBanner.merge();
  subBanner.setValue('Painel de Controle • Pedidos de Materiais Didáticos, Impressão e Histórico Consolidado');
  subBanner.setBackground(CONFIG.ESTILOS.MICROLINS_BLUE_DARK);
  subBanner.setFontColor('#d0e1fd');
  subBanner.setFontFamily('Arial');
  subBanner.setFontSize(9);
  subBanner.setHorizontalAlignment('center');
  subBanner.setVerticalAlignment('middle');
  sheet.setRowHeight(3, 22);

  // 5. Linha 4 de respiro
  sheet.setRowHeight(4, 12);

  // 6. Cabeçalhos dos Blocos: Ações Rápidas (B5:C5) e Indicadores Gerais (E5:H5)
  const headerAcoes = sheet.getRange('B5:C5');
  headerAcoes.merge();
  headerAcoes.setValue('⚡ AÇÕES RÁPIDAS');
  headerAcoes.setBackground(CONFIG.ESTILOS.MICROLINS_BLUE);
  headerAcoes.setFontColor('#ffffff');
  headerAcoes.setFontFamily('Arial');
  headerAcoes.setFontSize(10);
  headerAcoes.setFontWeight('bold');
  headerAcoes.setHorizontalAlignment('center');
  headerAcoes.setVerticalAlignment('middle');

  const headerKPI = sheet.getRange('E5:H5');
  headerKPI.merge();
  headerKPI.setValue('📊 INDICADORES GERAIS & STATUS DO SISTEMA');
  headerKPI.setBackground(CONFIG.ESTILOS.MICROLINS_BLUE);
  headerKPI.setFontColor('#ffffff');
  headerKPI.setFontFamily('Arial');
  headerKPI.setFontSize(10);
  headerKPI.setFontWeight('bold');
  headerKPI.setHorizontalAlignment('center');
  headerKPI.setVerticalAlignment('middle');
  sheet.setRowHeight(5, 26);

  // 7. Bloco de Ações Rápidas (Linhas 6 a 11): Checkbox na coluna B e Rótulo com Emoji na coluna C
  const acoes = [
    { label: '🚀 Abrir Central Completa' },
    { label: '📄 Novo Pedido Rápido' },
    { label: '📦 Arquivar Pedido Atual' },
    { label: '📚 Ver Histórico de Pedidos' },
    { label: '⚙️ Configurações Microlins' },
    { label: '🔄 Atualizar Indicadores' }
  ];

  for (let i = 0; i < acoes.length; i++) {
    const row = 6 + i;
    sheet.setRowHeight(row, 28);

    // Coluna B: Checkbox
    const cellBox = sheet.getRange(row, 2);
    cellBox.insertCheckboxes();
    cellBox.setValue(false);
    cellBox.setHorizontalAlignment('center');
    cellBox.setVerticalAlignment('middle');
    cellBox.setBackground('#f8fafd');
    cellBox.setBorder(true, true, true, false, false, false, '#d0d7de', SpreadsheetApp.BorderStyle.SOLID);

    // Coluna C: Texto da Ação
    const cellLabel = sheet.getRange(row, 3);
    cellLabel.setValue(acoes[i].label);
    cellLabel.setFontFamily('Arial');
    cellLabel.setFontSize(9.5);
    cellLabel.setFontWeight('bold');
    cellLabel.setFontColor(CONFIG.ESTILOS.MICROLINS_BLUE);
    cellLabel.setBackground('#f8fafd');
    cellLabel.setHorizontalAlignment('left');
    cellLabel.setVerticalAlignment('middle');
    cellLabel.setBorder(true, false, true, true, false, false, '#d0d7de', SpreadsheetApp.BorderStyle.SOLID);
  }

  // 8. Moldura estática dos 4 Cartões de KPI (Colunas E a H, Linhas 6 a 11)
  const titulosKPI = [
    { col: 5, titulo: 'TOTAL DE PEDIDOS' },
    { col: 6, titulo: 'APOSTILAS ENTREGUES' },
    { col: 7, titulo: 'PEDIDOS ESTE MÊS' },
    { col: 8, titulo: 'SITUAÇÃO DO SISTEMA' }
  ];

  for (const k of titulosKPI) {
    const rangeHeader = sheet.getRange(6, k.col);
    rangeHeader.setValue(k.titulo);
    rangeHeader.setFontFamily('Arial');
    rangeHeader.setFontSize(8);
    rangeHeader.setFontWeight('bold');
    rangeHeader.setFontColor('#5f6368');
    rangeHeader.setHorizontalAlignment('center');
    rangeHeader.setVerticalAlignment('middle');
    rangeHeader.setBackground('#f1f3f4');

    const rangeValor = sheet.getRange(7, k.col, 3, 1);
    rangeValor.merge();
    rangeValor.setBackground('#ffffff');

    const rangeSub = sheet.getRange(10, k.col, 2, 1);
    rangeSub.merge();
    rangeSub.setBackground('#ffffff');

    const rangeCard = sheet.getRange(6, k.col, 6, 1);
    rangeCard.setBorder(true, true, true, true, false, false, '#d0d7de', SpreadsheetApp.BorderStyle.SOLID);
  }

  // 9. Linha 12 de respiro
  sheet.setRowHeight(12, 14);

  // 10. Linha 13 - Cabeçalho da Tabela de Pedidos Recentes (B13:H13)
  const headerTabela = sheet.getRange('B13:H13');
  headerTabela.merge();
  headerTabela.setValue('📋 ÚLTIMOS PEDIDOS ARQUIVADOS (HISTÓRICO CONSOLIDADO)');
  headerTabela.setBackground(CONFIG.ESTILOS.MICROLINS_BLUE);
  headerTabela.setFontColor('#ffffff');
  headerTabela.setFontFamily('Arial');
  headerTabela.setFontSize(10);
  headerTabela.setFontWeight('bold');
  headerTabela.setHorizontalAlignment('center');
  headerTabela.setVerticalAlignment('middle');
  sheet.setRowHeight(13, 26);

  // 11. Linha 14 - Colunas da Tabela
  const cabecalhosTabela = [
    'Ação',
    'Nº Ordem',
    'Data',
    'Competência',
    'Título do Pedido',
    'Materiais',
    'Educador(es)'
  ];
  const rangeCabTabela = sheet.getRange('B14:H14');
  rangeCabTabela.setValues([cabecalhosTabela]);
  rangeCabTabela.setFontFamily('Arial');
  rangeCabTabela.setFontSize(9);
  rangeCabTabela.setFontWeight('bold');
  rangeCabTabela.setBackground('#e8f0fe');
  rangeCabTabela.setFontColor('#1a73e8');
  rangeCabTabela.setHorizontalAlignment('center');
  rangeCabTabela.setVerticalAlignment('middle');
  rangeCabTabela.setBorder(true, true, true, true, true, true, '#c2d7f9', SpreadsheetApp.BorderStyle.SOLID);
  sheet.setRowHeight(14, 24);
}

/**
 * Atualiza com extrema rapidez apenas os dados dinâmicos do Dashboard (sem recriar a estrutura)
 * @param {Sheet} sheet - Aba do Dashboard
 * @param {Object} resumo - Dados sumarizados dos pedidos e status
 */
function atualizarValoresDashboard_(sheet, resumo) {
  if (!sheet || !resumo) return;

  // 1. Atualiza KPIs em lote (Linha 7 para valores, Linha 10 para subtítulos)
  const rangeKpiValores = sheet.getRange('E7:H7');
  rangeKpiValores.setValues([[
    String(resumo.totalPedidos || 0),
    String(resumo.totalApostilas || 0),
    String(resumo.pedidosEsteMes || 0),
    resumo.statusTexto || '🟢 Livre'
  ]]);

  sheet.getRange(7, 5).setFontColor(CONFIG.ESTILOS.MICROLINS_BLUE);
  sheet.getRange(7, 6).setFontColor('#137333');
  sheet.getRange(7, 7).setFontColor(CONFIG.ESTILOS.MICROLINS_RED);
  sheet.getRange(7, 8).setFontColor(resumo.statusCor || '#137333');

  const rangeKpiSubs = sheet.getRange('E10:H10');
  rangeKpiSubs.setValues([[
    'pedidos arquivados',
    'volumes registrados',
    resumo.mesAtualNome || 'mês corrente',
    resumo.statusSub || 'Pronto para novos pedidos'
  ]]);

  // 2. Atualiza Tabela de Pedidos Recentes em lote (B15:H20, 6 linhas por 7 colunas)
  const pedidosRecentes = resumo.pedidosRecentes || [];
  const maxLinhasExibir = 6;

  if (pedidosRecentes.length === 0) {
    const rangeTabelaVazia = sheet.getRange(15, 2, 1, 7);
    rangeTabelaVazia.merge();
    rangeTabelaVazia.setValue('Nenhum pedido arquivado no histórico até o momento.');
    rangeTabelaVazia.setFontFamily('Arial').setFontSize(9).setFontColor('#70757a').setHorizontalAlignment('center').setVerticalAlignment('middle');
    rangeTabelaVazia.setBackground('#ffffff');
    return;
  }

  const valoresMatriz = [];
  const bgsMatriz = [];

  for (let i = 0; i < maxLinhasExibir; i++) {
    if (i < pedidosRecentes.length) {
      const item = pedidosRecentes[i];
      const numOrdemClean = item.numOrdem ? item.numOrdem.replace('#', '') : (i + 1);

      valoresMatriz.push([
        `[ ✏️ Editar #${numOrdemClean} ]`,
        item.numOrdem || `#${String(i + 1).padStart(3, '0')}`,
        item.data || '',
        item.mesAno || item.mesNome || '',
        item.titulo || 'Pedido',
        `${item.totalAlunos || 0} alunos`,
        item.educadoresStr || 'Não informado'
      ]);
      bgsMatriz.push(new Array(7).fill((i % 2 === 0) ? '#ffffff' : '#f8fafd'));
    } else {
      valoresMatriz.push(['', '', '', '', '', '', '']);
      bgsMatriz.push(new Array(7).fill('#ffffff'));
    }
  }

  const rangeTabela = sheet.getRange(15, 2, maxLinhasExibir, 7);
  rangeTabela.setValues(valoresMatriz);
  rangeTabela.setBackgrounds(bgsMatriz);
  rangeTabela.setBorder(true, true, true, true, true, true, '#e0e0e0', SpreadsheetApp.BorderStyle.SOLID);
  rangeTabela.setFontFamily('Arial').setFontSize(8.5).setVerticalAlignment('middle');

  // Alinhamentos e estilos de colunas específicas da tabela
  sheet.getRange(15, 2, maxLinhasExibir, 1).setFontWeight('bold').setFontColor(CONFIG.ESTILOS.MICROLINS_BLUE).setHorizontalAlignment('center');
  sheet.getRange(15, 3, maxLinhasExibir, 1).setFontWeight('bold').setFontColor('#1a73e8').setHorizontalAlignment('center');
  sheet.getRange(15, 4, maxLinhasExibir, 1).setFontColor('#5f6368').setHorizontalAlignment('center');
  sheet.getRange(15, 5, maxLinhasExibir, 1).setFontWeight('600').setFontColor('#202124').setHorizontalAlignment('center');
  sheet.getRange(15, 6, maxLinhasExibir, 1).setFontWeight('bold').setFontColor('#202124').setHorizontalAlignment('left');
  sheet.getRange(15, 7, maxLinhasExibir, 1).setFontColor('#137333').setHorizontalAlignment('center');
  sheet.getRange(15, 8, maxLinhasExibir, 1).setFontColor('#5f6368').setHorizontalAlignment('left');
}

/**
 * Garante que apenas a aba Dashboard permaneça visível na tela inicial
 * Oculta _BD_Historico, Configurações e a aba de trabalho se vazia/arquivada
 */
function recolherAbasParaDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) return;

  const nomeDashboard = CONFIG.SHEETS.DASHBOARD || 'Dashboard';
  let sheetDash = ss.getSheetByName(nomeDashboard);
  if (!sheetDash) {
    sheetDash = gerarOuAtualizarDashboard(true);
  }

  // Garante que o Dashboard está ativo e visível primeiro (requisito do Sheets para poder ocultar outras abas)
  sheetDash.showSheet();
  ss.setActiveSheet(sheetDash);

  const sheets = ss.getSheets();
  for (const s of sheets) {
    const nome = s.getName();
    if (nome === nomeDashboard) continue;

    // Abas de sistema que SEMPRE devem ficar ocultas
    if (nome === CONFIG.SHEETS.BD_HISTORICO || nome.startsWith('Bkp_') || nome.startsWith('Backup_')) {
      try {
        s.hideSheet();
      } catch (e) {}
      continue;
    }

    // Configurações fica oculta por padrão no dia a dia
    if (nome === CONFIG.SHEETS.CONFIGURACOES) {
      try {
        s.hideSheet();
      } catch (e) {}
      continue;
    }

    // Pedido Atual: se estiver vazia (menos de 5 linhas), oculta para não poluir
    if (nome === CONFIG.SHEETS.PEDIDO_PADRAO) {
      if (s.getLastRow() < 5) {
        try {
          s.hideSheet();
        } catch (e) {}
      }
    }
  }
}

/**
 * Coleta informações de resumo para alimentar os cartões de KPI do Dashboard
 * @returns {Object} Resumo com estatísticas
 */
function obterResumoDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const resumo = {
    totalPedidos: 0,
    totalApostilas: 0,
    pedidosEsteMes: 0,
    mesAtualNome: '',
    statusTexto: '🟢 Livre',
    statusSub: 'Pronto para novos pedidos',
    statusCor: '#137333',
    pedidosRecentes: []
  };

  if (!ss) return resumo;

  // 1. Mês atual em português
  const agora = new Date();
  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const mesAtualIdx = agora.getMonth();
  const anoAtual = agora.getFullYear();
  resumo.mesAtualNome = `${meses[mesAtualIdx]} / ${anoAtual}`;

  // 2. Análise da base de histórico
  const sheetBD = ss.getSheetByName(CONFIG.SHEETS.BD_HISTORICO);
  if (sheetBD && sheetBD.getLastRow() > 1) {
    const totalLinhasBD = sheetBD.getLastRow() - 1;
    resumo.totalApostilas = totalLinhasBD;

    try {
      const listaPedidos = (typeof listarPedidosArquivados === 'function')
        ? listarPedidosArquivados()
        : [];

      resumo.totalPedidos = listaPedidos.length;

      // Conta pedidos do mês atual respeitando estritamente a competência
      let pedidosMes = 0;
      for (const p of listaPedidos) {
        const ehMesmoAno = String(p.ano) === String(anoAtual);
        const ehMesmoMes = p.mesNome
          ? (p.mesNome.toLowerCase() === meses[mesAtualIdx].toLowerCase())
          : (p.data && p.data.includes(`/${String(mesAtualIdx + 1).padStart(2, '0')}/${anoAtual}`));

        if (ehMesmoAno && ehMesmoMes) {
          pedidosMes++;
        }
      }
      resumo.pedidosEsteMes = pedidosMes;

      // Pega os mais recentes
      resumo.pedidosRecentes = listaPedidos.slice(0, 6);
    } catch (eHist) {
      Logger.log('[DashboardManager] Erro ao obter lista para resumo: ' + eHist.message);
    }
  }

  // 3. Status da folha atual de trabalho
  const sheetAtual = ss.getSheetByName(CONFIG.SHEETS.PEDIDO_PADRAO);
  let editandoId = '';
  let editandoTitulo = '';
  try {
    const props = PropertiesService.getDocumentProperties();
    editandoId = props.getProperty('EDITANDO_ID_PEDIDO') || '';
    editandoTitulo = props.getProperty('EDITANDO_TITULO_PEDIDO') || '';
  } catch (eProp) {}

  if (editandoId) {
    resumo.statusTexto = '✏️ Em Edição';
    resumo.statusSub = editandoTitulo ? `Editando: ${editandoTitulo.substring(0, 24)}...` : `Pedido em edição (${editandoId})`;
    resumo.statusCor = '#e37400';
  } else if (sheetAtual && !sheetAtual.isSheetHidden() && sheetAtual.getLastRow() >= 5) {
    const totalItens = sheetAtual.getLastRow() - 4;
    resumo.statusTexto = '🟡 Em Aberto';
    resumo.statusSub = `${totalItens} materiais na folha ativa`;
    resumo.statusCor = '#d91a2a';
  }

  return resumo;
}
