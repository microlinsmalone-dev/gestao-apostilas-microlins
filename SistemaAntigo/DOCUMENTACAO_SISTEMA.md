# 📘 Documentação Técnica e Operacional • Gestão de Apostilas
**Microlins Potirendaba**  
*Sistema Integrado Google Sheets + Google Apps Script (Web App)*

---

## 1. Visão Geral do Sistema

O sistema **Gestão de Apostilas - Microlins Potirendaba** foi desenvolvido para transformar o processo de solicitação, impressão, controle de duplicidades e histórico de material didático em um fluxo ágil, seguro e automatizado.

O sistema opera de forma híbrida:
1. **Planilha Google Sheets:** Onde as folhas oficiais de pedido de apostilas são impressas para assinatura dos alunos e arquivadas.
2. **Web App / Central de Gestão:** Uma aplicação web moderna e integrada, com design profissional em SVG, executada tanto em tela cheia quanto em modais dentro da planilha.

---

## 2. Arquitetura de Arquivos e Módulos

```
src/
├── Config.js              # Configurações globais, regras de negócio e estilos
├── DashboardManager.js    # Tela inicial Dashboard no Sheets, KPIs e política de abas limpas
├── ImportProcessor.js     # Motor de leitura de relatórios e enriquecimento de dados
├── DuplicateChecker.js    # Detector de duplicidades (internas e com histórico)
├── OrderManager.js        # Geração, formatação e ciclo de vida da folha oficial
├── ArchiveManager.js      # Persistência no _BD_Historico, edição real, restauração e exclusão
├── ExportService.js       # Exportação direta para PDF e Excel
├── UiMenu.js              # Menus do Google Sheets, gatilhos (onOpen, onEdit) e templates
└── ui/
    ├── Styles.html        # Design System moderno em CSS, variáveis e SVGs
    ├── WebApp.html        # Central de Gestão completa (Single Page Application)
    ├── DialogImport.html  # Modal de importação rápida via planilha
    ├── DialogArchive.html # Modal de consulta e restauração de histórico
    ├── DialogDuplicates.html # Modal de auditoria de duplicidades
    └── DialogEducators.html  # Modal de configuração de educadores
test_business_logic.py     # Suíte de testes automatizados em Python
```

---

## 3. Guia Detalhado dos Módulos

### 3.1. `Config.js` (Configurações Centrais)
* **Nomes Reservados:**
  * `CONFIG.SHEETS.PEDIDO_PADRAO`: `'Pedido Atual'`
  * `CONFIG.SHEETS.BD_HISTORICO`: `'_BD_Historico'` (Aba oculta com a base definitiva)
  * `CONFIG.SHEETS.CONFIGURACOES`: `'Configurações'`
* **Regras de Negócio Padronizadas:**
  * Status de Contrato: `'Ativo'`
  * Inadimplência: `'Não'`
  * Entrega Física: `'Não'`
  * Faixa Padrão de Aulas: 4 a 6 (customizável livremente na interface)
  * Exclusão de Contratos: `'Bolsista'`
  * Matérias Ignoradas por Padrão: `['Digitação', 'Digitacao']`
* **Estilos e Identidade Visual Microlins:**
  * Azul Institucional: `#0f3b7d`
  * Vermelho Institucional: `#d91a2a`
  * Cores de Alerta de Duplicidade: `#fce8e6` (fundo) e `#c5221f` (texto)

---

### 3.2. `ImportProcessor.js` (Processador de Relatórios)
* **Suporte Universal a Relatórios:**
  1. *Relatório de Entrega de Apostila* (modelo operacional de materiais).
  2. *Controle Pedagógico* (`Modelo Real de Controle Pedagógico.xls`).
* **Enriquecimento Pedagógico:**
  * **Dias e Horas de Agendamento:** Captura dia da semana e horário da aula (ex: `Segunda-Feira (15:30)`) para facilitar a separação física das apostilas por turma.
  * **Próxima Matéria:** Previsão da matéria subsequente para antecipação de compras.
  * **Telefone de Contato:** Disponível para contato rápido com alunos.
* **Filtros Flexíveis:**
  * O backend aceita o parâmetro `{ todasAulas: true }`, permitindo que o operador filtre dinamicamente qualquer faixa de aulas no navegador sem novas requisições.

---

### 3.3. `DuplicateChecker.js` (Controle Inteligente de Duplicidades)
* **Duplicidade Interna:** Detecta quando o mesmo aluno e matéria aparecem mais de uma vez no mesmo pedido.
* **Duplicidade Histórica:** Compara cada registro com toda a base acumulada de pedidos anteriores gravados no `_BD_Historico`.
* **Marcação Visual:** Aplica destaque vermelho suave e notas informativas diretamente nas células do Google Sheets para alertar o operador.

---

### 3.4. `OrderManager.js` (Folha Oficial no Sheets)
* **Estrutura da Folha A4:**
  * **Linha 1:** Respiro visual (12px).
  * **Linha 2:** Título Principal Mesclado (A2:F2) preservando a digitação exata em maiúsculas/minúsculas.
  * **Linha 3:** Separação visual (8px).
  * **Linha 4:** Cabeçalhos oficiais (*Aluno*, *Matéria*, *Educador*, *Data*, *Entrega*, *Liberação*, *Aula Atual*).
  * **AutoFilter Automático:** Ativa filtros suspensos nativos do Google Sheets na Linha 4 (Colunas A a G).
  * **Linhas 5+:** Registros de alunos aprovados + 15 linhas extras em branco formatadas para anotações manuais e assinaturas.
* **Sincronização Bidirecional de Títulos:**
  * Se a aba for renomeada no Google Sheets, a função `obterTituloPedidoAtual` atualiza automaticamente a célula A2 ao clicar em "Atualizar" no painel.

---

### 3.5. `DashboardManager.js` (Tela Inicial e Indicadores em Tempo Real)
* **Tela Inicial Interativa (`Dashboard`):**
  * Aba principal posicionada na primeira posição da planilha com design institucional Microlins (`#0f3b7d` / `#d91a2a`).
  * **Indicadores em Tempo Real (KPIs):** Total de Pedidos Arquivados, Apostilas Entregues, Pedidos no Mês Atual e Status do Sistema (Livre / Em Aberto / Em Edição).
  * **6 Ações Rápidas por Checkbox (Coluna B, Linhas 6–11):** Células interativas com gatilho `onEdit`:
    * Linha 6 → 🚀 Abrir Central Completa
    * Linha 7 → 📄 Novo Pedido Rápido
    * Linha 8 → 📦 Arquivar Pedido Atual
    * Linha 9 → 📚 Ver Histórico de Pedidos
    * Linha 10 → ⚙️ Configurações
    * Linha 11 → 🔄 Atualizar Dashboard
  * **Tabela de Pedidos Recentes (Linhas 15–20):** Exibe os últimos pedidos consolidados. Clicar na célula da coluna B de qualquer linha abre **diretamente a edição** daquele pedido na folha de cálculo, identificando-o pelo número de ordem.
* **Política de Abas Limpas (`recolherAbasParaDashboard`):**
  * Mantém exclusivamente a aba `Dashboard` visível no dia a dia. As abas de suporte (`_BD_Historico`, `Configurações` e folha de trabalho quando vazia) permanecem ocultas.

---

### 3.6. `ArchiveManager.js` (Gestão Definitiva de Histórico e Edição Real)
* **Persistência Centralizada e Sem Redundâncias (`_BD_Historico`):**
  * Base única relacional oculta. Elimina definitivamente a geração de abas de backup clonadas (`Bkp_Pedido_*` e `Bkp_Arch_*`), impedindo qualquer duplicidade visual no histórico.
* **Metadados Enriquecidos (`listarPedidosArquivados`):**
  * **Nº de Ordem Sequencial:** Identificação cronológica amigável (`#001`, `#002`, `#003`...).
  * **Competência de Mês e Ano:** Extração precisa de Mês e Ano para filtros dinâmicos.
  * **Educadores do Pedido:** Agrupamento de todos os educadores das matérias do pedido para filtros específicos por professor.
* **Higienização de Backups Antigos (`limparAbasBackupAntigas`):**
  * Sincroniza qualquer registro pendente em abas antigas para o `_BD_Historico` e remove com segurança as abas físicas de backup, mantendo a planilha 100% limpa.
* **Fluxo Real de Edição de Pedidos:**
  * `abrirPedidoParaEdicao(idPedido)`: Reabre qualquer pedido arquivado diretamente na folha de cálculo do Google Sheets com todos os alunos e matérias, permitindo correções livres nas células.
  * `salvarEdicaoPedidoHistorico()`: Lê as correções da planilha, atualiza o bloco no `_BD_Historico` (preservando o ID e a data de criação original) e recolhe a visualização para o Dashboard.
  * `cancelarEdicaoPedido()`: Descarta a edição local sem alterar o histórico.
* **Restauração e Exclusão Seguras:**
  * `restaurarPedidoEmNovaAba()`: Monta nova via formatada a partir do banco para reimpressão.
  * `apagarPedidoHistorico()`: Remove definitivamente os registros do banco de dados consolidado.
* **Consolidação de Duplicidades no Histórico (`consolidarPedidosDuplicadosHistorico`):**
  * Analisa o `_BD_Historico` em busca de pedidos arquivados acidentalmente mais de uma vez (mesmo título e mesmos alunos). Mantém apenas a primeira ocorrência e remove as duplicatas, invalidando o cache e recalculando o Dashboard ao final.
* **Limpeza de Registros Acidentais do Dashboard (`limparRegistrosCorrompidosHistorico`):**
  * Detecta e remove do `_BD_Historico` quaisquer registros que sejam dados internos do Dashboard arquivados indevidamente (via `ehRegistroDashboard_`). Após a limpeza, reconstrói o Dashboard forçando reconstrução completa da estrutura visual (`forcarReconstrucao = true`).

---

### 3.7. `ExportService.js` (Exportação Direta)
* **Download Direto sem Bloqueio:**
  * `obterUrlExportacaoPDF()`: Gera link de impressão em PDF pronto para download no formato A4 retrato com cabeçalhos repetidos e margens ajustadas.
  * `obterUrlExportacaoExcel()`: Gera link de download direto do formato `.xlsx`.

---

### 3.8. `UiMenu.js` (Gatilhos e Menus)
* **Menu Superior "Gestão de Apostilas" (13 itens):**
  * 🏠 Ir para o Dashboard (Início)
  * 🚀 Central de Apostilas (Painel Completo)
  * 📄 Novo Pedido Rápido (com arquivamento prévio automático)
  * 📦 Arquivar Pedido Atual
  * 📚 Histórico de Pedidos
  * *(separador)*
  * 💾 Salvar Edição no Histórico
  * ❌ Cancelar Edição de Pedido
  * *(separador)*
  * 🖨️ Exportar para PDF
  * 📊 Exportar para Excel
  * *(separador)*
  * ⚙️ Configurações (Microlins)
  * 🧹 Limpar Abas Antigas de Backup
  * 🧹 Remover Pedidos Duplicados no Histórico
  * 🧹 Limpar Registros Acidentais do Dashboard
* **Inicialização Automática (`onOpen`):**
  * Garante que as abas `_BD_Historico` e `Configurações` existam assim que a planilha for aberta. Inicializa o Dashboard e recolhe abas secundárias automaticamente.
* **Gatilho de Edição (`onEdit`):**
  * Responde aos checkboxes das 6 ações rápidas do Dashboard (Coluna B, Linhas 6–11) e ao clique na tabela de pedidos recentes (Coluna B, Linhas 15–20) para abertura direta de edição.
* **Ponto de Entrada Web App (`doGet`):**
  * Renderiza `ui/WebApp.html` com suporte a execução externa (`.../exec`).
* **Carregamento Resiliente de Templates (`createTemplateSafely`):**
  * Tenta múltiplas convenções de nome (`ui/Nome`, `Nome`, `ui_Nome`) para garantir compatibilidade independente de como os arquivos foram nomeados no Apps Script.

---

## 4. Recursos da Interface (Web App SPA)

### 4.1. Aba "Importar e Inspecionar"
* **Upload por Arraste ou Clique:** Aceita arquivos `.xls`, `.xlsx`, `.csv` e `.txt`.
* **Filtros Livres de Aula:**
  * Campos numéricos `De:` e `Até:` (ex: 4 a 6, 1 a 10, etc.) com atualização em tempo real.
  * Botão de atalho **"Todas as Aulas"**.
* **Ordenação Dinâmica:**
  * Seletor suspenso e cabeçalhos de tabela clicáveis com setas SVG (*Aula*, *Aluno*, *Matéria*).
* **Curadoria do Operador:**
  * Botão **"Excluir"** individual por aluno com atualização instantânea de contadores.
  * Campo de edição do **Título do Pedido**.
  * Botão **"Gerar Folha no Sheets"** que escreve a planilha oficial formatada.

### 4.2. Aba "Folha Atual no Sheets"
* Visualização dos dados da folha em andamento na planilha.
* **Dropdown Seletor de Folhas:** Permite alternar entre diferentes abas abertas.
* **Botão `[ ✏️ Renomear ]`:** Altera o título da aba e da célula A2 simultaneamente via modal.
* **Botão `[ 📦 Arquivar e Nova Folha ]`:** Arquiva o pedido no `_BD_Historico` e limpa a folha para o próximo pedido.

### 4.3. Aba "Histórico de Pedidos"
* Listagem completa de todos os pedidos arquivados no banco de dados consolidado.
* **4 Ações Rápidas por Linha:**
  1. `[ 📅 Data ]`: Altera a data de arquivamento, competência (mês/ano) e título do pedido (essencial para catalogar pedidos passados de meses anteriores).
  2. `[ ✏️ Editar ]`: Reabre o pedido na folha de cálculo do Google Sheets para correção de nomes de alunos, matérias e educadores diretamente nas células, com salvamento direto no banco via menu.
  3. `[ ↩️ Restaurar ]`: Restaura uma cópia fiel do pedido em uma nova aba para conferência/reimpressão.
  4. `[ 🗑️ Apagar ]`: Remove o pedido definitivamente do banco e atualiza a tela e o Dashboard instantaneamente sem alertas bloqueantes e sem necessidade de recarregar.

### 4.4. Aba "Configurar Educadores"
* Cadastro de educadores, professores e nomes administrativos a ignorar durante a importação.
* Sincronização automática com a aba `Configurações` da planilha.

---

## 5. Validação e Testes Automatizados

O sistema conta com suíte completa de testes unitários e de integração em [test_business_logic.py](file:///d:/Malone/Projetos/Sistemas_Microlins/Apps%20Scripts/Gest%C3%A3o%20de%20Apostilas/test_business_logic.py):

```bash
python test_business_logic.py
```

### Cobertura dos Testes:
* **Preservação de Título:** Garante que maiúsculas e minúsculas não sofram `toUpperCase` forçado.
* **Filtragem de Contratos e Exclusão de Digitação:** Valida que bolsistas e matérias de digitação são excluídos conforme a regra de negócio.
* **Caso de Teste Real (Ana Clara):** Garante a curadoria correta de múltiplas matérias ativas.
* **Suporte ao Controle Pedagógico:** Valida o mapeamento de dias, horários e previsão de matérias.
* **Sincronização de Backups:** Simula as abas físicas de backup simultâneas da planilha real (`Bkp_Archived_...` e `Bkp_Pedido_...`) confirmando a catalogação e exibição no histórico.
* **Edição Real e Exclusão de Histórico:** Testa a edição real de células na folha de cálculo e salvamento direto no banco, além da exclusão completa sem deixar dados órfãos.
* **Ordenação Cronológica e Precisão de KPIs:** Valida que pedidos passados (ex: 15/08) ordenam estritamente antes de pedidos atuais (ex: 01/09) e que o KPI "Pedidos Este Mês" conta apenas os pedidos pertencentes à competência atual.
* **Compilação e Sintaxe:** Validação em máquina virtual JS (Node.js) de 100% dos scripts `.js` e `.html` sem erros de sintaxe.
