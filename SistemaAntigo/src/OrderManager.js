/**
 * ==============================================================================
 * GESTÃO DE APOSTILAS - MICROLINS
 * Arquivo: OrderManager.js
 * Descrição: Criação, estilização e formatação da Folha de Pedido de Materiais
 * ==============================================================================
 */

/**
 * Prepara a folha de pedido com o layout idêntico ao modelo oficial de entrega
 * @param {string} titulo - Título do cabeçalho (ex: ENTREGA DE MATERIAL - 1º PEDIDO SETEMBRO)
 * @param {boolean} [silencioso=false] - Se true, omite o alert de confirmação
 * @param {Sheet} [sheetAlvo] - Folha alvo para preparação (opcional)
 * @param {boolean} [ignorarAutoArquivamento=false] - Se true, não arquiva registros anteriores
 */
function prepararFolhaPedido(titulo, silencioso, sheetAlvo, ignorarAutoArquivamento) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const nomeDash = CONFIG.SHEETS.DASHBOARD || 'Dashboard';
  const NOMES_SISTEMA = [
    CONFIG.SHEETS.BD_HISTORICO,
    CONFIG.SHEETS.CONFIGURACOES,
    nomeDash
  ];

  let sheet = sheetAlvo || ss.getActiveSheet();

  // Se a aba for nula, aba de sistema ou backup, redireciona estritamente para a folha padrão de pedidos
  if (!sheet || NOMES_SISTEMA.includes(sheet.getName()) || sheet.getName().startsWith('Bkp_') || sheet.getName().startsWith('Backup_')) {
    sheet = ss.getSheetByName(CONFIG.SHEETS.PEDIDO_PADRAO) || ss.insertSheet(CONFIG.SHEETS.PEDIDO_PADRAO);
  }

  // Garante que a folha de pedido esteja visível e ativada
  try {
    sheet.showSheet();
    ss.setActiveSheet(sheet);
  } catch (eShow) {}

  // Arquivamento automático no histórico somente se NÃO for edição e NÃO for solicitado ignorar
  const props = PropertiesService.getDocumentProperties();
  const emEdicao = props.getProperty('EDITANDO_ID_PEDIDO');

  if (!ignorarAutoArquivamento && !emEdicao && !NOMES_SISTEMA.includes(sheet.getName()) && sheet.getLastRow() >= 5) {
    try {
      if (typeof salvarRegistrosFolhaNoHistorico_ === 'function') {
        const resArq = salvarRegistrosFolhaNoHistorico_(sheet);
        if (resArq) {
          Logger.log(`[OrderManager] Folha anterior arquivada automaticamente no histórico: "${resArq.titulo}" (${resArq.totalRegistros} itens).`);
        }
      }
    } catch (eArq) {
      Logger.log(`[OrderManager] Aviso ao arquivar folha anterior: ${eArq.message}.`);
    }
  }

  sheet.clear();
  sheet.clearFormats();

  titulo = (titulo && typeof titulo === 'string' && titulo.trim().length > 0)
    ? titulo.trim()
    : 'ENTREGA DE MATERIAL - PEDIDO';

  // 1. Configurar larguras das colunas A a F
  for (const [colIndex, width] of Object.entries(CONFIG.LARGURAS_COLUNAS)) {
    sheet.setColumnWidth(parseInt(colIndex, 10), width);
  }

  // 2. Linha 1 de respiro
  sheet.setRowHeight(1, 12);

  // 3. Cabeçalho Superior - Título Principal (Linha 2, Colunas A a F mescladas)
  // Preserva exatamente a digitação informada pelo usuário (sem toUpperCase forçado)
  const rangeTitulo = sheet.getRange(2, 1, 1, 6);
  rangeTitulo.merge();
  rangeTitulo.setValue(titulo);
  rangeTitulo.setFontFamily('Arial');
  rangeTitulo.setFontSize(13);
  rangeTitulo.setFontWeight('bold');
  rangeTitulo.setHorizontalAlignment('center');
  rangeTitulo.setVerticalAlignment('middle');
  rangeTitulo.setBackground('#ffffff');
  rangeTitulo.setBorder(true, true, true, true, false, false, CONFIG.ESTILOS.BORDER_COLOR, SpreadsheetApp.BorderStyle.SOLID);
  sheet.setRowHeight(2, CONFIG.ESTILOS.TITLE_ROW_HEIGHT);

  // 4. Linha 3 de separação visual
  sheet.setRowHeight(3, 8);

  // 5. Cabeçalhos das Colunas Principais (Linha 4, Colunas A a F - Área de Impressão)
  const rangeCabecalho = sheet.getRange(4, 1, 1, 6);
  rangeCabecalho.setValues([CONFIG.COLUNAS_PEDIDO]);
  rangeCabecalho.setFontFamily('Arial');
  rangeCabecalho.setFontSize(10);
  rangeCabecalho.setFontWeight('bold');
  rangeCabecalho.setBackground(CONFIG.ESTILOS.HEADER_BG);
  rangeCabecalho.setVerticalAlignment('middle');
  rangeCabecalho.setBorder(true, true, true, true, true, true, CONFIG.ESTILOS.BORDER_COLOR, SpreadsheetApp.BorderStyle.SOLID);
  sheet.setRowHeight(4, CONFIG.ESTILOS.HEADER_ROW_HEIGHT);

  // Alinhamentos dos cabeçalhos principais
  sheet.getRange(4, 1).setHorizontalAlignment('left');   // Aluno
  sheet.getRange(4, 2).setHorizontalAlignment('left');   // Matéria
  sheet.getRange(4, 3).setHorizontalAlignment('left');   // Educador
  sheet.getRange(4, 4).setHorizontalAlignment('center'); // Data
  sheet.getRange(4, 5).setHorizontalAlignment('center'); // Entrega
  sheet.getRange(4, 6).setHorizontalAlignment('center'); // Liberação

  // Cabeçalho da Coluna Auxiliar G (Aula Atual - Apenas para consulta em tela, fora da impressão)
  const celulaAula = sheet.getRange(4, 7);
  celulaAula.setValue(CONFIG.COLUNA_AUXILIAR_AULA);
  celulaAula.setFontFamily('Arial');
  celulaAula.setFontSize(10);
  celulaAula.setFontWeight('bold');
  celulaAula.setBackground('#e8f0fe');
  celulaAula.setFontColor('#1a73e8');
  celulaAula.setHorizontalAlignment('center');
  celulaAula.setVerticalAlignment('middle');
  celulaAula.setBorder(true, true, true, true, true, true, CONFIG.ESTILOS.BORDER_COLOR, SpreadsheetApp.BorderStyle.SOLID);
  celulaAula.setNote('Coluna de consulta interna. Não impressa no documento final.');

  // 6. Criar linhas iniciais em branco prontas para preenchimento / anotações manuais
  formatarLinhasEmBranco(sheet, 5, CONFIG.LINHAS_EXTRAS_MANUAIS + 10);

  // 6.1 Aplicar filtros automáticos nos rótulos da linha 4 (Colunas A a G)
  try {
    if (sheet.getFilter()) {
      sheet.getFilter().remove();
    }
    const maxLinha = Math.max(5, sheet.getLastRow());
    sheet.getRange(4, 1, maxLinha - 3, 7).createFilter();
  } catch (eFilter) {
    Logger.log('[OrderManager] Aviso ao aplicar filtro: ' + eFilter.message);
  }

  // 7. Salvar título no histórico de metadados da aba para futura referência
  sheet.setName(sanitizarNomeAba(titulo));
  Logger.log(`[OrderManager] Folha de pedido preparada: "${titulo}"`);

  if (!silencioso) {
    try {
      SpreadsheetApp.getUi().alert('Folha Preparada', `Folha configurada com o título:\n"${titulo}".`, SpreadsheetApp.getUi().ButtonSet.OK);
    } catch (e) {
      Logger.log(`[OrderManager] Alerta omitido: ${e.message}`);
    }
  }
}

/**
 * Aplica formatação de bordas e alturas para um bloco de linhas (Colunas A a G)
 */
function formatarLinhasEmBranco(sheet, linhaInicial, quantidadeLinhas) {
  if (quantidadeLinhas <= 0) return;

  const rangeCorpo = sheet.getRange(linhaInicial, 1, quantidadeLinhas, 7);
  rangeCorpo.setFontFamily('Arial');
  rangeCorpo.setFontSize(9);
  rangeCorpo.setFontWeight('normal');
  rangeCorpo.setVerticalAlignment('middle');
  rangeCorpo.setBorder(true, true, true, true, true, true, CONFIG.ESTILOS.BORDER_COLOR, SpreadsheetApp.BorderStyle.SOLID);

  // Alinhamentos das colunas de dados
  sheet.getRange(linhaInicial, 1, quantidadeLinhas, 1).setHorizontalAlignment('left');   // Aluno
  sheet.getRange(linhaInicial, 2, quantidadeLinhas, 1).setHorizontalAlignment('left');   // Matéria
  sheet.getRange(linhaInicial, 3, quantidadeLinhas, 1).setHorizontalAlignment('left');   // Educador (livre p/ digitação manual)
  sheet.getRange(linhaInicial, 4, quantidadeLinhas, 1).setHorizontalAlignment('center'); // Data
  sheet.getRange(linhaInicial, 5, quantidadeLinhas, 1).setHorizontalAlignment('center'); // Entrega (assinatura)
  sheet.getRange(linhaInicial, 6, quantidadeLinhas, 1).setHorizontalAlignment('center'); // Liberação
  sheet.getRange(linhaInicial, 7, quantidadeLinhas, 1).setHorizontalAlignment('center'); // Aula Atual (Consulta)
  sheet.getRange(linhaInicial, 7, quantidadeLinhas, 1).setFontColor('#5f6368');

  // Formato da data (dd/mm)
  sheet.getRange(linhaInicial, 4, quantidadeLinhas, 1).setNumberFormat('dd/MM');

  // Ajustar altura das linhas para permitir assinatura confortável
  for (let r = linhaInicial; r < linhaInicial + quantidadeLinhas; r++) {
    sheet.setRowHeight(r, CONFIG.ESTILOS.ROW_HEIGHT);
  }
}

/**
 * Obtém o título do pedido atual a partir da célula mesclada A2
 * @returns {string} Título do pedido ou nome da aba
 */
/**
 * Obtém a aba de pedido de trabalho com proteção contra abas de sistema (BD, Config, Backups)
 * @param {string} [nomeAbaAlvo] - Nome específico de aba (opcional)
 * @returns {Sheet} A aba de pedido correspondente
 */
function obterAbaPedidoAtiva(nomeAbaAlvo) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const NOMES_SISTEMA = [
    CONFIG.SHEETS.BD_HISTORICO,
    CONFIG.SHEETS.CONFIGURACOES,
    CONFIG.SHEETS.DASHBOARD || 'Dashboard'
  ];

  // 1. Se foi passado um nome de aba específico, tenta carregar diretamente
  if (nomeAbaAlvo && typeof nomeAbaAlvo === 'string' && nomeAbaAlvo.trim().length > 0) {
    const sheetAlvo = ss.getSheetByName(nomeAbaAlvo.trim());
    if (sheetAlvo && !sheetAlvo.isSheetHidden() && !NOMES_SISTEMA.includes(sheetAlvo.getName())) {
      return sheetAlvo;
    }
  }

  // 2. Verifica a aba ativa atual
  let sheet = ss.getActiveSheet();
  const nomeAtivo = sheet ? sheet.getName() : '';
  const ehAbaValida = sheet
    && !sheet.isSheetHidden()
    && !NOMES_SISTEMA.includes(nomeAtivo)
    && !nomeAtivo.startsWith(CONFIG.BACKUP.PREFIXO_PEDIDO)
    && !nomeAtivo.startsWith(CONFIG.BACKUP.PREFIXO_SOBRESCRITA);

  // Se a aba ativa atual for válida e contiver dados (>= 5 linhas), prioriza ela
  if (ehAbaValida && sheet.getLastRow() >= 5) {
    return sheet;
  }

  // 3. Se a aba ativa for inválida ou vazia, procura uma aba visível que contenha registros
  const todasAbas = ss.getSheets();
  const abaComDados = todasAbas.find(s =>
    !s.isSheetHidden() &&
    !NOMES_SISTEMA.includes(s.getName()) &&
    !s.getName().startsWith(CONFIG.BACKUP.PREFIXO_PEDIDO) &&
    !s.getName().startsWith(CONFIG.BACKUP.PREFIXO_SOBRESCRITA) &&
    s.getLastRow() >= 5
  );

  if (abaComDados) {
    ss.setActiveSheet(abaComDados);
    Logger.log(`[OrderManager] Redirecionado para aba com registros: "${abaComDados.getName()}".`);
    return abaComDados;
  }

  // 4. Se nenhuma contiver dados, retorna a ativa se válida ou a primeira visível de pedido
  if (ehAbaValida) {
    return sheet;
  }

  const abaVisivel = todasAbas.find(s =>
    !s.isSheetHidden() &&
    !NOMES_SISTEMA.includes(s.getName()) &&
    !s.getName().startsWith(CONFIG.BACKUP.PREFIXO_PEDIDO) &&
    !s.getName().startsWith(CONFIG.BACKUP.PREFIXO_SOBRESCRITA)
  );

  if (abaVisivel) {
    ss.setActiveSheet(abaVisivel);
    return abaVisivel;
  }

  return ss.getSheetByName(CONFIG.SHEETS.PEDIDO_PADRAO) || ss.insertSheet(CONFIG.SHEETS.PEDIDO_PADRAO);
}

/**
 * Obtém o título do pedido atual a partir da célula mesclada A2 e do nome da aba,
 * sincronizando automaticamente se houver divergência (ex: nome alterado para teste ou renomeado na aba).
 * @param {Sheet} [sheet] - Aba da qual extrair o título
 * @returns {string} Título do pedido atualizado
 */
function obterTituloPedidoAtual(sheet) {
  sheet = sheet || obterAbaPedidoAtiva();
  if (!sheet) return 'ENTREGA DE MATERIAL';
  try {
    const nomeAba = sheet.getName().trim();
    const valorA2 = sheet.getRange('A2').getValue();
    const tituloA2 = (valorA2 && typeof valorA2 === 'string') ? valorA2.trim() : '';

    // 1. Se A2 contém "teste" ou estiver em branco, e a aba tiver outro nome definido pelo usuário:
    if (!tituloA2 || tituloA2.toLowerCase() === 'teste' || tituloA2.toLowerCase() === 'folha') {
      if (nomeAba && nomeAba.toLowerCase() !== 'teste') {
        sheet.getRange('A2').setValue(nomeAba);
        return nomeAba;
      }
    }

    // 2. Se a aba foi explicitamente renomeada no Sheets e A2 permaneceu com "teste":
    if (nomeAba && nomeAba.toLowerCase() !== 'teste' && tituloA2.toLowerCase() === 'teste') {
      sheet.getRange('A2').setValue(nomeAba);
      return nomeAba;
    }

    // 3. Se a aba tem um nome personalizado (ex: "SETEMBRO 2º - Antônioo") e A2 tem título genérico
    const ehNomeGenericoAba = ['pedido atual', 'folha', 'sheet1', 'página1', 'pagina1', 'teste'].includes(nomeAba.toLowerCase());
    if (!ehNomeGenericoAba && nomeAba !== tituloA2) {
      if (tituloA2.toLowerCase().startsWith('entrega de material - pedido') || tituloA2.toLowerCase() === 'teste') {
        sheet.getRange('A2').setValue(nomeAba);
        return nomeAba;
      }
    }

    // 4. Se A2 tem um título customizado válido, utiliza ele
    if (tituloA2 && tituloA2.toLowerCase() !== 'teste') {
      return tituloA2;
    }

    return nomeAba || 'ENTREGA DE MATERIAL';
  } catch (e) {
    return sheet.getName();
  }
}

/**
 * Lista todas as abas ativas da planilha que são folhas de pedidos (não sistema, não backup)
 * @returns {Array<Object>} Lista com nome da aba, título e total de registros
 */
function obterListaAbasPedidos() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const NOMES_SISTEMA = [
    CONFIG.SHEETS.BD_HISTORICO,
    CONFIG.SHEETS.CONFIGURACOES,
    CONFIG.SHEETS.DASHBOARD || 'Dashboard'
  ];
  const todasAbas = ss.getSheets();

  const abasPedido = todasAbas.filter(s =>
    !s.isSheetHidden() &&
    !NOMES_SISTEMA.includes(s.getName()) &&
    !s.getName().startsWith(CONFIG.BACKUP.PREFIXO_PEDIDO) &&
    !s.getName().startsWith(CONFIG.BACKUP.PREFIXO_SOBRESCRITA) &&
    !s.getName().startsWith('Bkp_') &&
    !s.getName().startsWith('Backup_')
  );

  return abasPedido.map(s => {
    let titulo = '';
    try {
      titulo = String(s.getRange('A2').getValue() || '').trim();
    } catch (e) {}
    if (!titulo || titulo.toLowerCase() === 'teste') {
      titulo = s.getName();
    }

    const lastRow = s.getLastRow();
    const totalRegistros = lastRow >= 5 ? lastRow - 4 : 0;

    return {
      nomeAba: s.getName(),
      titulo: titulo || s.getName(),
      totalRegistros: totalRegistros
    };
  });
}

/**
 * Renomeia o título da folha ativa tanto na célula A2 quanto no nome da aba
 * @param {string} novoTitulo - Novo título desejado
 * @param {string} [nomeAbaAlvo] - Nome da aba a renomear
 * @returns {Object} Resumo com novo título e novo nome de aba
 */
function renomearPedidoAtual(novoTitulo, nomeAbaAlvo) {
  const sheet = obterAbaPedidoAtiva(nomeAbaAlvo);
  if (!sheet) {
    throw new Error('Nenhuma folha encontrada para renomear.');
  }

  const tituloLimpo = (novoTitulo && typeof novoTitulo === 'string') ? novoTitulo.trim() : '';
  if (!tituloLimpo) {
    throw new Error('O título do pedido não pode ficar vazio.');
  }

  // 1. Atualiza a célula A2
  sheet.getRange('A2').setValue(tituloLimpo);

  // 2. Atualiza o nome da aba
  const novoNomeAba = sanitizarNomeAba(tituloLimpo);
  try {
    if (sheet.getName() !== novoNomeAba) {
      sheet.setName(novoNomeAba);
    }
  } catch (e) {
    Logger.log('[OrderManager] Aviso ao renomear aba: ' + e.message);
  }

  return {
    sucesso: true,
    titulo: tituloLimpo,
    nomeAba: sheet.getName()
  };
}

/**
 * Alterna a visibilidade da coluna G (Aula Atual) na tela
 */
function alternarColunaAulaAtual() {
  const sheet = obterAbaPedidoAtiva();
  if (!sheet) return;
  if (sheet.isColumnHiddenByUser(7)) {
    sheet.showColumns(7);
    SpreadsheetApp.getActiveSpreadsheet().toast('Coluna "Aula Atual" visível.', 'Exibição', 2);
  } else {
    sheet.hideColumns(7);
    SpreadsheetApp.getActiveSpreadsheet().toast('Coluna "Aula Atual" oculta.', 'Exibição', 2);
  }
}

/**
 * Obtém os dados completos da folha atual para exibição no Web App
 * @param {string} [nomeAbaAlvo] - Nome específico da aba (opcional)
 * @returns {Object} Dados da folha, registros e duplicidades
 */
function obterDadosFolhaAtual(nomeAbaAlvo) {
  const sheet = obterAbaPedidoAtiva(nomeAbaAlvo);
  if (!sheet) {
    return {
      titulo: '(Nenhuma folha encontrada)',
      nomeAba: '',
      totalRegistros: 0,
      registros: [],
      duplicidades: [],
      abasDisponiveis: []
    };
  }

  const titulo = obterTituloPedidoAtual(sheet);
  const ultimaLinha = sheet.getLastRow();
  const registros = [];

  if (ultimaLinha >= 5) {
    const valores = sheet.getRange(5, 1, ultimaLinha - 4, 7).getValues();
    for (let i = 0; i < valores.length; i++) {
      const aluno = String(valores[i][0] || '').trim();
      const materia = String(valores[i][1] || '').trim();
      if (!aluno && !materia) continue;

      registros.push({
        linha: 5 + i,
        aluno: aluno,
        materia: materia,
        educador: String(valores[i][2] || '').trim(),
        data: valores[i][3] instanceof Date ? Utilities.formatDate(valores[i][3], 'GMT-3', 'dd/MM') : String(valores[i][3] || '').trim(),
        entrega: String(valores[i][4] || '').trim(),
        liberacao: String(valores[i][5] || '').trim(),
        aulaAtual: String(valores[i][6] || '').trim()
      });
    }
  }

  const duplicidades = verificarDuplicidadesFolha(sheet);
  const abasDisponiveis = obterListaAbasPedidos();

  Logger.log(`[OrderManager] Dados da folha atual carregados: "${titulo}" (${sheet.getName()}), ${registros.length} registros, ${duplicidades.length} duplicidade(s).`);

  return {
    titulo: titulo,
    nomeAba: sheet.getName(),
    totalRegistros: registros.length,
    registros: registros,
    duplicidades: duplicidades,
    abasDisponiveis: abasDisponiveis
  };
}

/**
 * Ajusta o nome da aba para não estourar o limite de 100 caracteres do Sheets
 * @param {string} nome - Nome bruto
 * @returns {string} Nome sanitizado
 */
function sanitizarNomeAba(nome) {
  if (!nome || typeof nome !== 'string') return 'Folha';
  return nome.replace(/[\\/?*[\]:]/g, ' ').substring(0, 30).trim();
}

/**
 * Finaliza e gera a folha de pedidos no Google Sheets com base na curadoria da página HTML
 * @param {string} titulo - Título exato da planilha definido pelo operador
 * @param {Array<Object>} registros - Lista final inspecionada e aprovada pelo operador
 * @returns {Object} Resumo com quantidade de linhas, nome da aba e duplicidades
 */
function gerarFolhaFinalizada(titulo, registros) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    Logger.log('[OrderManager] Lock adquirido para gerarFolhaFinalizada.');

    if (!titulo || typeof titulo !== 'string' || titulo.trim().length === 0) {
      titulo = 'ENTREGA DE MATERIAL - PEDIDO';
    }
    const tituloFinal = titulo.trim();

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const nomeDash = CONFIG.SHEETS.DASHBOARD || 'Dashboard';
    const NOMES_SISTEMA = [
      CONFIG.SHEETS.BD_HISTORICO,
      CONFIG.SHEETS.CONFIGURACOES,
      nomeDash
    ];

    let sheet = ss.getActiveSheet();

    // Garante aba válida não-sistema
    if (!sheet || NOMES_SISTEMA.includes(sheet.getName()) || sheet.getName().startsWith('Bkp_') || sheet.getName().startsWith('Backup_')) {
      sheet = ss.getSheetByName(CONFIG.SHEETS.PEDIDO_PADRAO) || ss.insertSheet(CONFIG.SHEETS.PEDIDO_PADRAO);
      sheet.showSheet();
      ss.setActiveSheet(sheet);
    }

    // Prepara estrutura visual baseada no modelo oficial com o título digitado
    prepararFolhaPedido(tituloFinal, true, sheet);

    if (!registros || !Array.isArray(registros) || registros.length === 0) {
      Logger.log('[OrderManager] Folha finalizada criada vazia (sem registros).');
      return {
        sucesso: true,
        titulo: tituloFinal,
        totalInseridos: 0,
        nomeAba: sheet.getName(),
        duplicidades: []
      };
    }

    // Prepara matriz para inserção [Aluno, Matéria, Educador, Data, Entrega, Liberação, Aula Atual]
    const linhasParaInserir = registros.map(item => {
      const materia = item.materiaLimpa || item.materia || '';
      const aulaStr = item.aulaAtual ? (String(item.aulaAtual).includes('Aula') ? String(item.aulaAtual) : `${item.aulaAtual}ª Aula`) : '';
      return [
        item.aluno || '',
        materia,
        item.educador || '',
        item.data || '',
        item.entrega || '',
        item.liberacao || '',
        aulaStr
      ];
    });

    const totalLinhas = linhasParaInserir.length;
    sheet.getRange(5, 1, totalLinhas, 7).setValues(linhasParaInserir);

    // Formata o bloco de dados
    formatarLinhasEmBranco(sheet, 5, totalLinhas);

    // Adiciona as linhas extras em branco para assinaturas e pedidos manuais
    const linhaFinal = 5 + totalLinhas;
    formatarLinhasEmBranco(sheet, linhaFinal, CONFIG.LINHAS_EXTRAS_MANUAIS);

    // Confere duplicidades e aplica destaque suave
    const duplicidades = verificarDuplicidadesFolha(sheet);

    // Aplica filtros nos rótulos da Linha 4 (Colunas A a G) cobrindo todos os registros gerados
    try {
      if (sheet.getFilter()) {
        sheet.getFilter().remove();
      }
      const ultimaLinhaComDados = sheet.getLastRow();
      if (ultimaLinhaComDados >= 4) {
        sheet.getRange(4, 1, ultimaLinhaComDados - 3, 7).createFilter();
      }
    } catch (eFilter) {
      Logger.log('[OrderManager] Aviso ao aplicar filtro final: ' + eFilter.message);
    }

    Logger.log(`[OrderManager] Folha "${tituloFinal}" gerada com sucesso: ${totalLinhas} inseridos, ${duplicidades.length} duplicidade(s).`);

    return {
      sucesso: true,
      titulo: tituloFinal,
      totalInseridos: totalLinhas,
      linhasExtras: CONFIG.LINHAS_EXTRAS_MANUAIS,
      nomeAba: sheet.getName(),
      duplicidades: duplicidades.length
    };
  } catch (err) {
    Logger.log(`[OrderManager] Erro em gerarFolhaFinalizada: ${err.message}`);
    throw err;
  } finally {
    lock.releaseLock();
    Logger.log('[OrderManager] Lock liberado em gerarFolhaFinalizada.');
  }
}

