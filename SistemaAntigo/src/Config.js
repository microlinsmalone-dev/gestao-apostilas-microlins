/**
 * ==============================================================================
 * GESTÃO DE APOSTILAS - MICROLINS
 * Arquivo: Config.js
 * Descrição: Configurações centrais, nomes de abas, regras de negócio e estilos
 * ==============================================================================
 */

const CONFIG = {
  // Nomes das abas reservadas do sistema
  SHEETS: {
    DASHBOARD: 'Dashboard',
    PEDIDO_PADRAO: 'Pedido Atual',
    BD_HISTORICO: '_BD_Historico',
    CONFIGURACOES: 'Configurações'
  },

  // Educadores padrão a serem ignorados caso apareçam como alunos
  DEFAULT_EDUCADORES_IGNORADOS: [
    'Malone de Souza',
    'Antonio Fagner dos Santos Silva',
    'Pyetra Alves Vieira de Oliveira',
  ],

  // Colunas da Folha de Pedido
  COLUNAS_PEDIDO: [
    'Aluno',
    'Matéria',
    'Educador',
    'Data',
    'Entrega',
    'Liberação'
  ],

  // Coluna Auxiliar (não impressa)
  COLUNA_AUXILIAR_AULA: 'Aula Atual',

  // Larguras recomendadas para impressão A4 Retrato (em pixels)
  LARGURAS_COLUNAS: {
    1: 250, // A - Aluno
    2: 240, // B - Matéria
    3: 130, // C - Educador
    4: 75,  // D - Data
    5: 140, // E - Entrega (espaço para assinatura)
    6: 85,  // F - Liberação (OK / Visto)
    7: 85   // G - Aula Atual (coluna de consulta interna)
  },

  // Quantidade padrão de linhas extras em branco para anotações manuais
  LINHAS_EXTRAS_MANUAIS: 15,

  // Filtros de negócio obrigatórios para o relatório do sistema interno
  FILTROS: {
    STATUS_CONTRATO: 'Ativo',
    INADIMPLENTE: 'Não',
    ENTREGA_FISICA: 'Não',
    AULA_ATUAL_MIN: 4,
    AULA_ATUAL_MAX: 6,
    TIPO_CONTRATO_EXCLUIR: 'Bolsista',
    MATERIAS_EXCLUIR_PADRAO: ['Digitação', 'Digitacao']
  },

  // Paleta de cores e estilos visuais (Microlins Potirendaba)
  ESTILOS: {
    HEADER_BG: '#f8f9fa',
    HEADER_TEXT: '#1a1a1a',
    BORDER_COLOR: '#000000',
    ROW_HEIGHT: 24,
    HEADER_ROW_HEIGHT: 28,
    TITLE_ROW_HEIGHT: 36,
    DUPLICATE_BG: '#fce8e6', // Vermelho suave de alerta
    DUPLICATE_TEXT: '#c5221f',
    // Cores Institucionais Microlins Potirendaba
    MICROLINS_BLUE: '#0f3b7d',
    MICROLINS_BLUE_DARK: '#0a2e68',
    MICROLINS_RED: '#d91a2a',
    MICROLINS_RED_LIGHT: '#fce8e8',
    MICROLINS_BG_LIGHT: '#f8fafd',
    CONFIG_HEADER_BG: '#0f3b7d',
    CONFIG_HEADER_TEXT: '#ffffff'
  },

  // Configurações de Cache do Apps Script
  CACHE: {
    HISTORICO_KEY: 'historico_bd_apostilas',
    TTL_SEGUNDOS: 600 // 10 minutos
  },

  // Configurações de Backup de Segurança
  BACKUP: {
    PREFIXO_PEDIDO: 'Bkp_Pedido',
    PREFIXO_SOBRESCRITA: 'Bkp_Substituicao'
  }
};

