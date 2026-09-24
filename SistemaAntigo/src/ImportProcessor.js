/**
 * ==============================================================================
 * GESTÃO DE APOSTILAS - MICROLINS
 * Arquivo: ImportProcessor.js
 * Descrição: Leitura, filtros de negócio, exclusão de educadores e higienização de dados
 * ==============================================================================
 */

/**
 * Remove o código numérico com underline no início da matéria (ex: "161869_Windows 11" -> "Windows 11")
 * @param {string} materia 
 * @returns {string} Matéria sem o código de prefixo
 */
function limparNomeMateria(materia) {
  if (!materia || typeof materia !== 'string') return '';
  return materia.replace(/^\d+_\s*/, '').trim();
}

/**
 * Normaliza strings para comparações robustas (sem acentos, minúsculas, sem espaços extras)
 */
function normalizarTexto(texto) {
  if (!texto || typeof texto !== 'string') return '';
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Obtém a lista atualizada de educadores a ignorar da aba de Configurações
 * @returns {string[]} Lista de nomes de educadores
 */
function obterEducadoresIgnorados() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEETS.CONFIGURACOES);

  if (!sheet) {
    sheet = inicializarAbasSistema();
  }

  const ultimaLinha = sheet.getLastRow();
  if (ultimaLinha <= 1) {
    return CONFIG.DEFAULT_EDUCADORES_IGNORADOS;
  }

  // Identifica onde começa a tabela de educadores (procurando o cabeçalho)
  const valores = sheet.getRange(1, 1, ultimaLinha, 1).getValues();
  let linhaInicio = 2; // Padrão legado

  for (let i = 0; i < valores.length; i++) {
    const texto = normalizarTexto(String(valores[i][0] || ''));
    if (texto.includes('educador') || texto.includes('ignorar')) {
      linhaInicio = i + 2; // Inicia na linha imediatamente posterior ao cabeçalho
    }
  }

  const educadores = [];
  for (let r = linhaInicio - 1; r < valores.length; r++) {
    const nome = String(valores[r][0] || '').trim();
    // Ignora células vazias ou títulos corporativos
    if (nome.length > 0 && !normalizarTexto(nome).includes('microlins') && !normalizarTexto(nome).includes('painel')) {
      educadores.push(nome);
    }
  }

  return educadores.length > 0 ? educadores : CONFIG.DEFAULT_EDUCADORES_IGNORADOS;
}

/**
 * Verifica se a matéria ou formação corresponde a itens a ignorar (ex: Digitação)
 * @param {string} materia 
 * @param {string} [formacao] 
 * @returns {boolean}
 */
function ehMateriaIgnorada(materia, formacao) {
  const matNorm = normalizarTexto(materia);
  const formNorm = normalizarTexto(formacao || '');
  return matNorm.includes('digitacao') || formNorm.includes('digitacao');
}

/**
 * Adiciona um novo educador à lista de exclusão na aba de configurações com trava de concorrência
 * @param {string} nome - Nome do educador
 * @returns {string[]} Lista atualizada de educadores ignorados
 */
function adicionarEducadorIgnorado(nome) {
  if (!nome || typeof nome !== 'string') throw new Error('Nome inválido.');
  const nomeLimpo = nome.trim();
  if (!nomeLimpo) throw new Error('Nome não pode ser vazio.');

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    Logger.log(`[ImportProcessor] Adicionando educador ignorado: "${nomeLimpo}"`);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(CONFIG.SHEETS.CONFIGURACOES);
    if (!sheet) sheet = inicializarAbasSistema();

    const educadoresAtuais = obterEducadoresIgnorados();
    if (educadoresAtuais.map(e => e.toLowerCase()).includes(nomeLimpo.toLowerCase())) {
      throw new Error('Este educador já está cadastrado na lista.');
    }

    const proximaLinha = sheet.getLastRow() + 1;
    sheet.getRange(proximaLinha, 1).setValue(nomeLimpo);
    
    // Formata a linha nova com a data e status
    const dataHoje = Utilities.formatDate(new Date(), 'GMT-3', 'dd/MM/yyyy');
    sheet.getRange(proximaLinha, 2).setValue(dataHoje);
    sheet.getRange(proximaLinha, 3).setValue('Ativo');
    sheet.getRange(proximaLinha, 1, 1, 3).setBorder(true, true, true, true, true, true, '#cbd5e1', SpreadsheetApp.BorderStyle.SOLID);
    sheet.getRange(proximaLinha, 1).setHorizontalAlignment('left');
    sheet.getRange(proximaLinha, 2).setHorizontalAlignment('center');
    sheet.getRange(proximaLinha, 3).setHorizontalAlignment('center');
    sheet.setRowHeight(proximaLinha, 24);

    Logger.log(`[ImportProcessor] Educador "${nomeLimpo}" adicionado com sucesso.`);
    return obterEducadoresIgnorados();
  } catch (err) {
    Logger.log(`[ImportProcessor] Erro ao adicionar educador: ${err.message}`);
    throw err;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Remove um educador da lista de exclusão com trava de concorrência
 * @param {string} nome - Nome do educador a remover
 * @returns {string[]} Lista atualizada de educadores ignorados
 */
function removerEducadorIgnorado(nome) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    Logger.log(`[ImportProcessor] Removendo educador ignorado: "${nome}"`);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEETS.CONFIGURACOES);
    if (!sheet) return [];

    const ultimaLinha = sheet.getLastRow();
    if (ultimaLinha <= 1) return [];

    const valores = sheet.getRange(2, 1, ultimaLinha - 1, 1).getValues();
    for (let i = 0; i < valores.length; i++) {
      if (String(valores[i][0]).trim().toLowerCase() === nome.trim().toLowerCase()) {
        sheet.deleteRow(2 + i);
        Logger.log(`[ImportProcessor] Educador "${nome}" removido da linha ${2 + i}.`);
        break;
      }
    }

    return obterEducadoresIgnorados();
  } catch (err) {
    Logger.log(`[ImportProcessor] Erro ao remover educador: ${err.message}`);
    throw err;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Verifica se um nome de aluno pertence à lista de educadores
 */
function ehEducadorIgnorado(nomeAluno, listaEducadores) {
  if (!nomeAluno) return false;
  const alunoNorm = normalizarTexto(nomeAluno);

  return listaEducadores.some(educador => {
    const educadorNorm = normalizarTexto(educador);
    // Verifica correspondência exata ou se o nome do educador está contido no nome do aluno
    return alunoNorm === educadorNorm || alunoNorm.includes(educadorNorm);
  });
}

/**
 * Processa linhas brutas recebidas (via SheetJS ou Colagem direta) e aplica as regras de negócio
 * @param {Array<Object|Array>} linhasBrutas 
 * @returns {Object} Resumo com estatísticas e itens prontos
 */
function processarDadosImportados(linhasBrutas, opcoes) {
  if (!linhasBrutas || !Array.isArray(linhasBrutas) || linhasBrutas.length === 0) {
    throw new Error('Nenhum dado recebido para processamento.');
  }

  opcoes = opcoes || {};
  const todasAulas = opcoes.todasAulas === true;
  const temFiltroAulaEspecifico = (opcoes.aulaMin !== undefined && opcoes.aulaMin !== null && opcoes.aulaMin !== '') ||
                                  (opcoes.aulaMax !== undefined && opcoes.aulaMax !== null && opcoes.aulaMax !== '');
  const aulaMin = temFiltroAulaEspecifico && opcoes.aulaMin !== '' ? parseFloat(opcoes.aulaMin) : (todasAulas ? null : CONFIG.FILTROS.AULA_ATUAL_MIN);
  const aulaMax = temFiltroAulaEspecifico && opcoes.aulaMax !== '' ? parseFloat(opcoes.aulaMax) : (todasAulas ? null : CONFIG.FILTROS.AULA_ATUAL_MAX);

  Logger.log(`[ImportProcessor] Iniciando processamento de ${linhasBrutas.length} linhas brutas (todasAulas=${todasAulas}, aulaMin=${aulaMin}, aulaMax=${aulaMax}).`);
  const educadoresIgnorados = obterEducadoresIgnorados();
  const registrosValidos = [];
  const educadoresDescartados = [];
  const digitacaoDescartada = [];
  let descartadosFiltro = 0;

  // Se for matriz 2D (onde linha 0 são os cabeçalhos)
  if (Array.isArray(linhasBrutas[0])) {
    const cabecalhos = linhasBrutas[0].map(c => normalizarTexto(String(c)));
    
    // Busca inteligente de colunas: prioriza correspondência exata antes de parcial
    const getCol = (nomes) => {
      const normNomes = nomes.map(normalizarTexto);
      // 1. Tenta correspondência exata primeiro
      let idx = cabecalhos.findIndex(c => normNomes.includes(c));
      if (idx !== -1) return idx;
      // 2. Tenta correspondência com limites de palavra ou sufixo/prefixo
      idx = cabecalhos.findIndex(c => normNomes.some(n => c === n || c.endsWith(' ' + n) || c.startsWith(n + ' ')));
      if (idx !== -1) return idx;
      // 3. Fallback: contém a substring
      return cabecalhos.findIndex(c => normNomes.some(n => c.includes(n)));
    };

    const colAluno = getCol(['Aluno', 'Aluno (a)', 'Aluno(a)', 'Nome Aluno', 'Nome do Aluno', 'Nome', 'Estudante']);
    const colMateria = getCol(['Matéria', 'Materia', 'Nome Matéria', 'Nome Materia', 'Disciplina', 'Módulo', 'Modulo', 'Curso / Matéria', 'Curso / Materia']);
    const colFormacao = getCol(['Formação', 'Formacao', 'Curso', 'Nome Curso', 'Plano de Curso']);
    const colDataInicio = getCol(['Data Início Matéria', 'Data Inicio Materia', 'Data Início', 'Data Inicio', 'Início', 'Inicio', 'Data']);
    const colStatusContrato = getCol(['Status Contrato', 'Status', 'Situação Contrato', 'Situacao Contrato', 'Situação', 'Situacao']);
    const colStatusMateria = getCol(['Status Matéria', 'Status Materia', 'Situação Matéria', 'Situacao Materia', 'Status da Materia', 'Status da Matéria', 'Situacao da Materia']);
    const colInadimplente = getCol(['Inadimplente', 'Inadimplência', 'Inadimplencia', 'Débito', 'Debito', 'Financeiro']);
    const colEntregaFisica = getCol(['Entrega Física', 'Entrega Fisica', 'Apostila Entregue', 'Material Entregue', 'Entregue']);
    const colAulaAtual = getCol(['Aula Atual', 'Aula', 'Aulas Concluídas', 'Aulas Concluidas', 'Nº Aula', 'No Aula', 'Numero Aula']);
    const colTipoContrato = getCol(['Tipo Contrato', 'Tipo de Contrato', 'Categoria Contrato', 'Plano']);
    const colDiasAgendamento = getCol(['Dias Agendamento', 'Dia Agendamento', 'Dias', 'Dia']);
    const colHorasAgendamento = getCol(['Horas Agendamento', 'Hora Agendamento', 'Horário', 'Horario', 'Horas']);
    const colProximaMateria = getCol(['Próxima Matéria', 'Proxima Materia', 'Próximo Módulo', 'Proximo Modulo']);
    const colTelefone = getCol(['Telefone Aluno', 'Telefone', 'Celular']);
    const colTotalAulas = getCol(['Aulas', 'Total Aulas', 'Qtd Aulas']);

    for (let i = 1; i < linhasBrutas.length; i++) {
      const row = linhasBrutas[i];
      if (!row || row.length === 0) continue;

      const aluno = String(row[colAluno] || '').trim();
      const materiaBruta = String(row[colMateria] || '').trim();
      const formacaoBruta = colFormacao !== -1 ? String(row[colFormacao] || '').trim() : '';
      const dataInicioBruta = colDataInicio !== -1 ? String(row[colDataInicio] || '').trim() : '';
      if (!aluno && !materiaBruta) continue;

      const statusContrato = String(row[colStatusContrato] || '').trim();
      const inadimplente = String(row[colInadimplente] || '').trim();
      const entregaFisica = String(row[colEntregaFisica] || '').trim();
      const aulaAtual = parseFloat(row[colAulaAtual]) || 0;
      const tipoContrato = String(row[colTipoContrato] || '').trim();

      // 1. Checa se é educador
      if (ehEducadorIgnorado(aluno, educadoresIgnorados)) {
        educadoresDescartados.push({ aluno, materia: limparNomeMateria(materiaBruta) });
        continue;
      }

      // 2. Checa se é curso/matéria de Digitação (não demanda material didático impresso)
      if (ehMateriaIgnorada(materiaBruta, formacaoBruta)) {
        digitacaoDescartada.push({
          aluno: aluno,
          materia: limparNomeMateria(materiaBruta),
          formacao: limparNomeMateria(formacaoBruta)
        });
        continue;
      }

      // 3. Checa Status Matéria — ignora silenciosamente matérias concluídas/encerradas
      const STATUS_MATERIA_IGNORADOS = ['concluido', 'concluida', 'encerrado', 'encerrada', 'cancelado', 'cancelada', 'inativo', 'inativa'];
      if (colStatusMateria !== -1) {
        const statusMat = normalizarTexto(String(row[colStatusMateria] || ''));
        if (STATUS_MATERIA_IGNORADOS.includes(statusMat)) {
          descartadosFiltro++;
          continue;
        }
      }

      // 4. Aplica os filtros de negócio (caso a planilha ainda não estivesse pré-filtrada)
      const passaStatus = colStatusContrato === -1 || normalizarTexto(statusContrato) === 'ativo';
      const passaInad = colInadimplente === -1 || ['nao', 'n', ''].includes(normalizarTexto(inadimplente));
      const passaEntrega = colEntregaFisica === -1 || ['nao', 'n', ''].includes(normalizarTexto(entregaFisica));
      let passaAula = true;
      if (colAulaAtual !== -1 && !todasAulas) {
        if (aulaMin !== null && aulaAtual < aulaMin) passaAula = false;
        if (aulaMax !== null && aulaAtual > aulaMax) passaAula = false;
      }
      const passaBolsista = colTipoContrato === -1 || !normalizarTexto(tipoContrato).includes('bolsista');

      if (passaStatus && passaInad && passaEntrega && passaAula && passaBolsista) {
        registrosValidos.push({
          aluno: aluno,
          materiaBruta: materiaBruta,
          materiaLimpa: limparNomeMateria(materiaBruta),
          formacao: limparNomeMateria(formacaoBruta),
          dataInicio: dataInicioBruta,
          aulaAtual: aulaAtual,
          diasAgendamento: colDiasAgendamento !== -1 ? String(row[colDiasAgendamento] || '').trim() : '',
          horasAgendamento: colHorasAgendamento !== -1 ? String(row[colHorasAgendamento] || '').trim() : '',
          proximaMateria: colProximaMateria !== -1 ? limparNomeMateria(String(row[colProximaMateria] || '').trim()) : '',
          telefone: colTelefone !== -1 ? String(row[colTelefone] || '').trim() : '',
          totalAulas: colTotalAulas !== -1 ? (parseFloat(row[colTotalAulas]) || 0) : 0
        });
      } else {
        descartadosFiltro++;
      }
    }
  } else {
    // Array de objetos já mapeados
    for (const item of linhasBrutas) {
      const aluno = String(item.aluno || item.Aluno || item['Aluno (a)'] || item['Aluno(a)'] || item.nome || item.Nome || '').trim();
      const materiaBruta = String(item.materia || item.Matéria || item.Materia || item.disciplina || item.Disciplina || item.modulo || item.Módulo || '').trim();
      const formacaoBruta = String(item.formacao || item.Formação || item.Formacao || item.curso || item.Curso || item.plano || '').trim();
      if (!aluno && !materiaBruta) continue;

      if (ehEducadorIgnorado(aluno, educadoresIgnorados)) {
        educadoresDescartados.push({ aluno, materia: limparNomeMateria(materiaBruta) });
        continue;
      }

      if (ehMateriaIgnorada(materiaBruta, formacaoBruta)) {
        digitacaoDescartada.push({
          aluno: aluno,
          materia: limparNomeMateria(materiaBruta),
          formacao: limparNomeMateria(formacaoBruta)
        });
        continue;
      }

      registrosValidos.push({
        aluno: aluno,
        materiaBruta: materiaBruta,
        materiaLimpa: limparNomeMateria(materiaBruta),
        formacao: limparNomeMateria(formacaoBruta),
        dataInicio: item.dataInicio || item['Data Início'] || item['Data Inicio'] || item.data || '',
        aulaAtual: item.aulaAtual || item['Aula Atual'] || item['Aulas Concluídas'] || item['Aulas Concluidas'] || item.aula || '',
        diasAgendamento: item.diasAgendamento || item['Dias Agendamento'] || item.dias || '',
        horasAgendamento: item.horasAgendamento || item['Horas Agendamento'] || item.horas || '',
        proximaMateria: limparNomeMateria(item.proximaMateria || item['Próxima Matéria'] || item['Proxima Materia'] || ''),
        telefone: item.telefone || item['Telefone Aluno'] || item.telefoneAluno || '',
        totalAulas: item.totalAulas || item.aulas || item['Aulas'] || 0
      });
    }
  }

  // Contagens por aluno único (para exibição inteligente na UI)
  const alunosElegiveisSet = new Set(registrosValidos.map(r => normalizarTexto(r.aluno)));
  // Alunos que só aparecem fora dos filtros (sem nenhum registro elegível)
  const alunosElegiveis = alunosElegiveisSet;
  const educadoresNorm = new Set(educadoresDescartados.map(e => normalizarTexto(e.aluno)));
  const digitacaoNorm = new Set(digitacaoDescartada.map(d => normalizarTexto(d.aluno)));

  Logger.log(`[ImportProcessor] Processamento concluído: ${registrosValidos.length} válidos (${alunosElegiveis.size} alunos únicos), ${educadoresDescartados.length} educadores ignorados, ${descartadosFiltro} fora do filtro.`);

  return {
    totalOriginal: linhasBrutas.length - (Array.isArray(linhasBrutas[0]) ? 1 : 0),
    totalValidos: registrosValidos.length,
    alunosUnicosElegiveis: alunosElegiveis.size,
    descartadosFiltro: descartadosFiltro,
    educadoresDescartados: educadoresDescartados,
    digitacaoDescartada: digitacaoDescartada,
    registros: registrosValidos
  };
}

/**
 * Insere os registros processados na folha ativa e adiciona linhas em branco ao final com trava de concorrência
 * @param {Array<Object>} registros - Lista de registros aprovados
 * @returns {Object} Resumo da inserção
 */
function inserirRegistrosNaFolha(registros) {
  if (!registros || registros.length === 0) {
    throw new Error('Nenhum registro para inserir.');
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    Logger.log('[ImportProcessor] Lock adquirido para inserção de registros na folha.');

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = (typeof obterAbaPedidoAtiva === 'function')
      ? obterAbaPedidoAtiva()
      : ss.getSheetByName(CONFIG.SHEETS.PEDIDO_PADRAO);

    const nomeDash = CONFIG.SHEETS.DASHBOARD || 'Dashboard';
    if (!sheet || sheet.getName() === nomeDash) {
      sheet = ss.getSheetByName(CONFIG.SHEETS.PEDIDO_PADRAO) || ss.insertSheet(CONFIG.SHEETS.PEDIDO_PADRAO);
    }
    sheet.showSheet();
    ss.setActiveSheet(sheet);
    
    // Se a folha ainda não tem cabeçalho, prepara primeiro
    const celulaCabecalho = sheet.getRange('A4').getValue();
    if (celulaCabecalho !== 'Aluno') {
      prepararFolhaPedido(obterTituloPedidoAtual(sheet) || 'ENTREGA DE MATERIAL - PEDIDO', true, sheet);
    }

    // Limpa registros anteriores a partir da linha 5 (Colunas A a G)
    const ultimaLinha = Math.max(sheet.getLastRow(), 5);
    if (ultimaLinha >= 5) {
      sheet.getRange(5, 1, ultimaLinha - 4, 7).clearContent();
      sheet.getRange(5, 1, ultimaLinha - 4, 7).clearFormat();
    }

    // Prepara matriz para inserção [Aluno, Matéria, Educador, Data, Entrega, Liberação, Aula Atual]
    const linhasParaInserir = registros.map(item => [
      item.aluno,
      item.materiaLimpa || item.materia,
      '', // Educador livre para digitação manual
      '', // Data
      '', // Entrega
      '', // Liberação
      item.aulaAtual ? `${item.aulaAtual}ª Aula` : '' // Coluna auxiliar para consulta
    ]);

    const totalLinhas = linhasParaInserir.length;
    const rangeDados = sheet.getRange(5, 1, totalLinhas, 7);
    rangeDados.setValues(linhasParaInserir);

    // Formata o bloco de dados importados
    formatarLinhasEmBranco(sheet, 5, totalLinhas);

    // Adiciona as linhas extras em branco para assinaturas e pedidos manuais
    const linhaFinal = 5 + totalLinhas;
    formatarLinhasEmBranco(sheet, linhaFinal, CONFIG.LINHAS_EXTRAS_MANUAIS);

    // Executa checagem de duplicidade imediatamente
    const duplicidades = verificarDuplicidadesFolha(sheet);
    Logger.log(`[ImportProcessor] ${totalLinhas} registros inseridos na folha. ${duplicidades.length} duplicidade(s) detectada(s).`);

    return {
      linhasInseridas: totalLinhas,
      linhasExtras: CONFIG.LINHAS_EXTRAS_MANUAIS,
      duplicidadesDetectadas: duplicidades.length
    };
  } catch (err) {
    Logger.log(`[ImportProcessor] Erro em inserirRegistrosNaFolha: ${err.message}`);
    throw err;
  } finally {
    lock.releaseLock();
    Logger.log('[ImportProcessor] Lock liberado em inserirRegistrosNaFolha.');
  }
}
