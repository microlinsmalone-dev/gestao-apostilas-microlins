/**
 * ==============================================================================
 * GESTÃO DE APOSTILAS - MICROLINS
 * Arquivo: ExportService.js
 * Descrição: Exportação automática para PDF (A4 Retrato) e Excel com nome dinâmico
 * ==============================================================================
 */

/**
 * Exporta a folha atual para PDF formatado em A4 Retrato
 */
function exportarPedidoPDF() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = (typeof obterAbaPedidoAtiva === 'function')
    ? obterAbaPedidoAtiva()
    : ss.getActiveSheet();

  const nomeDash = CONFIG.SHEETS.DASHBOARD || 'Dashboard';
  const NOMES_SISTEMA = [CONFIG.SHEETS.BD_HISTORICO, CONFIG.SHEETS.CONFIGURACOES, nomeDash];

  if (!sheet || NOMES_SISTEMA.includes(sheet.getName()) || sheet.getLastRow() < 5) {
    SpreadsheetApp.getUi().alert('Aviso', 'Nenhuma folha de pedido com registros aberta para exportar em PDF.', SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }

  const titulo = (typeof obterTituloPedidoAtual === 'function') ? obterTituloPedidoAtual(sheet) : 'Pedido';
  const nomeArquivo = `${titulo}.pdf`;

  SpreadsheetApp.getActiveSpreadsheet().toast('Gerando arquivo PDF em alta qualidade...', 'Exportação', 5);

  // Garante que a coluna G (Aula Atual) NUNCA seja impressa no PDF
  const colunaAulaEstavaOculta = sheet.isColumnHiddenByUser(7);
  sheet.hideColumns(7);

  try {
    const url = gerarUrlExportacao(ss.getId(), sheet.getSheetId(), 'pdf');
    const token = ScriptApp.getOAuthToken();
    const response = UrlFetchApp.fetch(url, {
      headers: {
        'Authorization': 'Bearer ' + token
      },
      muteHttpExceptions: true
    });

    if (response.getResponseCode() === 200) {
      const blob = response.getBlob().setName(nomeArquivo);
      const arquivo = DriveApp.createFile(blob);

      const html = `
        <div style="font-family: 'Segoe UI', sans-serif; padding: 20px; text-align: center;">
          <h3 style="color: #1a73e8; margin-top: 0;">PDF Gerado com Sucesso</h3>
          <p style="font-size: 14px; color: #444;">O arquivo <b>${nomeArquivo}</b> foi salvo no Google Drive com formatação A4 Retrato.</p>
          <div style="margin: 25px 0;">
            <a href="${arquivo.getUrl()}" target="_blank" style="background: #1a73e8; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-right: 10px; display: inline-block;">Visualizar no Drive</a>
            <a href="${arquivo.getDownloadUrl()}" target="_blank" style="background: #1e8e3e; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Baixar Arquivo</a>
          </div>
          <button onclick="google.script.host.close()" style="border: 1px solid #dadce0; background: #fff; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Fechar</button>
        </div>
      `;
      const htmlOutput = HtmlService.createHtmlOutput(html).setWidth(460).setHeight(240);
      SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Exportar para PDF');
    } else {
      // Fallback via link direto se não tiver permissão de Drive
      abrirLinkExportacaoDireta(url, nomeArquivo, 'PDF');
    }
  } catch (e) {
    const url = gerarUrlExportacao(ss.getId(), sheet.getSheetId(), 'pdf');
    abrirLinkExportacaoDireta(url, nomeArquivo, 'PDF');
  } finally {
    // Restaura a exibição da coluna G na tela para consulta do usuário
    if (!colunaAulaEstavaOculta) {
      sheet.showColumns(7);
    }
  }
}

/**
 * Obtém a URL direta de download do PDF para o Web App
 * @returns {Object} { url, nomeArquivo }
 */
function obterUrlExportacaoPDF(nomeAbaAlvo) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = obterAbaPedidoAtiva(nomeAbaAlvo);
  if (!sheet) throw new Error('Folha de pedido não encontrada para exportar.');
  const titulo = obterTituloPedidoAtual(sheet);
  const nomeArquivo = `${titulo}.pdf`;
  const url = gerarUrlExportacao(ss.getId(), sheet.getSheetId(), 'pdf');
  return { url: url, nomeArquivo: nomeArquivo };
}

/**
 * Obtém a URL direta de download do Excel para o Web App
 * @param {string} [nomeAbaAlvo] - Nome específico da aba (opcional)
 * @returns {Object} { url, nomeArquivo }
 */
function obterUrlExportacaoExcel(nomeAbaAlvo) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = obterAbaPedidoAtiva(nomeAbaAlvo);
  const titulo = obterTituloPedidoAtual(sheet);
  const nomeArquivo = `${titulo}.xlsx`;
  const gidParam = sheet ? `&gid=${sheet.getSheetId()}` : '';
  const url = `https://docs.google.com/spreadsheets/d/${ss.getId()}/export?format=xlsx${gidParam}`;
  return { url: url, nomeArquivo: nomeArquivo };
}

/**
 * Exporta o arquivo para formato Excel (.xlsx) (para uso no menu do Sheets)
 */
function exportarPedidoExcel() {
  const info = obterUrlExportacaoExcel();
  abrirLinkExportacaoDireta(info.url, info.nomeArquivo, 'Excel (.xlsx)');
}

/**
 * Monta os parâmetros de URL para renderização otimizada em folha A4
 */
function gerarUrlExportacao(spreadsheetId, sheetId, formato) {
  const params = [
    'exportFormat=' + formato,
    'format=' + formato,
    'size=a4',             // Folha A4
    'portrait=true',       // Retrato
    'fitw=true',           // Ajustar à largura da página
    'gridlines=false',     // Não exibir grade cinza padrão
    'printtitle=false',    // Não repetir título do documento
    'sheetnames=false',    // Não imprimir nome da aba
    'fzr=false',           // Não congelar cabeçalhos na impressão
    'top_margin=0.5',
    'bottom_margin=0.5',
    'left_margin=0.4',
    'right_margin=0.4',
    'c1=0',                // Coluna inicial A (0)
    'c2=6',                // Coluna final F (6) - Exclui coluna G da impressão
    'gid=' + sheetId       // Apenas a aba ativa
  ];

  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?` + params.join('&');
}

/**
 * Abre janela para download direto do arquivo gerado no Google Sheets
 */
function abrirLinkExportacaoDireta(url, nomeArquivo, tipo) {
  try {
    const html = `
      <div style="font-family: 'Segoe UI', sans-serif; padding: 20px; text-align: center;">
        <h3 style="color: #1a73e8; margin-top: 0;">Download de ${tipo}</h3>
        <p style="font-size: 14px; color: #555;">Clique no botão abaixo para baixar <b>${nomeArquivo}</b>:</p>
        <div style="margin: 25px 0;">
          <a href="${url}" target="_blank" style="background: #1a73e8; color: #fff; padding: 10px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Download</a>
        </div>
        <button onclick="google.script.host.close()" style="border: 1px solid #dadce0; background: #fff; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Fechar</button>
      </div>
    `;
    const htmlOutput = HtmlService.createHtmlOutput(html).setWidth(420).setHeight(220);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, `Exportar para ${tipo}`);
  } catch (e) {
    Logger.log(`[ExportService] Interface UI indisponível (execução via WebApp ou trigger): ${e.message}`);
  }
}
