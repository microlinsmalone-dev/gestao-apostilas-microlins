# Sistema de Gestão de Apostilas - Microlins

Sistema de controle e conferência de materiais didáticos desenvolvido para Google Sheets e Google Apps Script. O sistema automatiza a higienização de dados exportados pelo sistema de gestão interno, aplica filtros de contrato e aulas, identifica pedidos duplicados para o mesmo aluno e consolida o histórico de entregas.

---

## Funcionalidades Principais

1. **Prevenção de Duplicidades:** Identifica repetições no pedido corrente e cruza os registros contra o histórico consolidado (`_BD_Historico`), evitando entregas duplicadas para o mesmo aluno na mesma matéria.
2. **Higienização de Matérias:** Remove automaticamente códigos técnicos de prefixo (exemplo: `161869_Windows 11` é formatado como `Windows 11`).
3. **Exclusão de Digitação:** Desconsidera automaticamente cursos ou matérias de "Digitação", que não demandam material didático físico.
4. **Exclusão de Educadores:** Desconsidera automaticamente registros vinculados a educadores cadastrados no sistema como alunos (exemplo: Malone, Antonio Fagner, Pyetra Alves Vieira de Oliveira).
5. **Preservação Fiel do Título:** Mantém exatamente a formatação em maiúsculas/minúsculas digitada pelo usuário no cabeçalho e na aba.
6. **Central de Gestão Web Integrada (HTML):** Fluxo unificado onde o operador define o título, importa a planilha, inspeciona alunos com múltiplas matérias/cursos futuros, remove itens com 1 clique e clica em **"Finalizar e Gerar Planilha no Sheets"**.
7. **Identidade Visual Microlins Potirendaba:** Interface e aba de configurações padronizadas com as cores corporativas (Azul Real `#0f3b7d` e Vermelho `#d91a2a`).
8. **Coluna de Apoio (Aula Atual):** Exibe a aula atual de cada aluno na planilha para conferência em tela, sendo automaticamente omitida na exportação para PDF e na impressão.
9. **Histórico Consolidado:** Armazena os pedidos arquivados em uma base de dados interna estruturada, permitindo restauração e conferência sem necessidade de manter múltiplas abas abertas.
10. **Exportação Padronizada:** Gera o documento de entrega formatado em folha A4 formato Retrato ou arquivo Excel (.xlsx) com o nome baseado no título do pedido.

---

## Estrutura do Projeto

```
Gestão de Apostilas/
├── src/
│   ├── Config.js                # Constantes, larguras de coluna e parâmetros de negócio
│   ├── UiMenu.js                # Menus do Google Sheets e ponto de entrada doGet
│   ├── OrderManager.js          # Criação, layout e formatação da folha de pedido
│   ├── ImportProcessor.js       # Filtros de negócio, exclusão de educadores e sanitização
│   ├── DuplicateChecker.js      # Mecanismo de identificação e destaque de duplicidades
│   ├── ArchiveManager.js        # Banco de dados histórico e restauração de registros
│   ├── ExportService.js         # Exportação para PDF (A4 Retrato) e Excel
│   └── ui/
│       ├── Styles.html          # Estilos CSS corporativos Microlins Potirendaba
│       ├── WebApp.html          # Painel web completo com fluxo unificado de novo pedido
│       ├── DialogImport.html    # Diálogo de importação de arquivos com SheetJS
│       ├── DialogDuplicates.html# Diálogo de resolução de duplicidades
│       ├── DialogEducators.html # Gerenciador de educadores desconsiderados
│       └── DialogArchive.html   # Consulta e restauração de histórico
├── test_business_logic.py       # Testes unitários das regras de negócio com dados reais
└── README.md                    # Documentação técnica e operacional
```

---

## Implantação no Google Sheets

### 1. Criação da Planilha
1. Acesse o [Google Sheets](https://sheets.new) e crie uma nova planilha.
2. Defina o nome do documento (exemplo: `Gestão de Apostilas - Microlins`).

### 2. Acesso ao Editor de Scripts
1. No menu superior da planilha, acesse **Extensões** > **Apps Script**.

### 3. Criação dos Arquivos de Script (.gs)
No painel esquerdo do editor, clique em **+** > **Script** e crie os seguintes arquivos com o conteúdo da pasta `src/`:

* `Config` (conteúdo de `src/Config.js`)
* `UiMenu` (conteúdo de `src/UiMenu.js`)
* `OrderManager` (conteúdo de `src/OrderManager.js`)
* `ImportProcessor` (conteúdo de `src/ImportProcessor.js`)
* `DuplicateChecker` (conteúdo de `src/DuplicateChecker.js`)
* `ArchiveManager` (conteúdo de `src/ArchiveManager.js`)
* `ExportService` (conteúdo de `src/ExportService.js`)

### 4. Criação dos Arquivos HTML (.html)
No painel esquerdo do editor do Apps Script, clique em **+** > **HTML** e crie os seguintes arquivos com o conteúdo da pasta `src/ui/`:

* `WebApp` ou `ui/WebApp` (conteúdo de `src/ui/WebApp.html`)
* `Styles` ou `ui/Styles` (conteúdo de `src/ui/Styles.html`)
* `DialogImport` ou `ui/DialogImport` (conteúdo de `src/ui/DialogImport.html`)
* `DialogDuplicates` ou `ui/DialogDuplicates` (conteúdo de `src/ui/DialogDuplicates.html`)
* `DialogEducators` ou `ui/DialogEducators` (conteúdo de `src/ui/DialogEducators.html`)
* `DialogArchive` ou `ui/DialogArchive` (conteúdo de `src/ui/DialogArchive.html`)

*(Observação: O sistema é resiliente e reconhece automaticamente qualquer um dos formatos: direto como `WebApp`, com barra `ui/WebApp` ou com sublinhado `ui_WebApp`).*

### 5. Salvar e Inicializar
1. Pressione `Ctrl + S` para salvar todos os arquivos.
2. Recarregue a página da planilha no navegador (`F5`).
3. O menu **Gestão de Apostilas** estará disponível na barra superior.

### 6. Publicação como Web App (Opcional - Acesso Externo)
1. No canto superior direito do Apps Script, clique em **Implantar** > **Nova implantação**.
2. Tipo: **Aplicativo da Web**.
3. Executar como: **Eu** (sua conta).
4. Quem pode acessar: **Qualquer pessoa** (ou conforme as políticas da unidade).
5. Clique em **Implantar**.
> **Dica Importante:** Sempre que fizer alterações no código, para atualizar a URL `/exec`, vá em **Implantar** > **Gerenciar implantações** > Editar (ícone de lápis) > Versão: **Nova versão** > **Salvar**. Para testar em tempo real sem criar novas versões, use a URL da **Implantação de teste** (terminada em `/dev`).

---

## Guia de Operação

### 1. Central de Apostilas (Fluxo Recomendado)
* Acesse no menu do Sheets: **Gestão de Apostilas** > **🚀 Central de Apostilas (Painel Completo)**.
* **Passo 1:** Digite o título desejado no campo *Novo Pedido* (o sistema respeita rigorosamente maiúsculas e minúsculas).
* **Passo 2:** Arraste ou selecione a planilha exportada do sistema (.xls ou .xlsx).
* **Passo 3:** Revise os alunos na tabela de inspeção. Alunos com mais de uma matéria ou com cursos futuros recebem alertas visuais e podem ser removidos com 1 clique no botão **🗑️ Excluir**.
* **Passo 4:** Clique em **🚀 Finalizar e Gerar Planilha no Sheets**. A folha é preenchida e formatada com bordas, alinhamentos e 15 linhas extras para assinaturas manuais.

### 2. Novo Pedido Rápido (Via Planilha Direta)
* Acesse: **Gestão de Apostilas** > **📄 Novo Pedido Rápido**.
* Se houver registros na folha atual, o sistema arquiva automaticamente antes de criar a nova.
* Digite o título no campo *Insira o título da nova folha de pedido:* e confirme.

### 3. Arquivar Pedido Atual
* Acesse: **Gestão de Apostilas** > **📦 Arquivar Pedido Atual**.
* Ou use o checkbox de ação rápida **Linha 8** no Dashboard.
* O sistema identifica a folha de pedido ativa, exibe uma confirmação com o título e a salva no `_BD_Historico`, retornando ao Dashboard.

### 4. Histórico de Pedidos
* Acesse: **Gestão de Apostilas** > **📚 Histórico de Pedidos**.
* Ou use o checkbox de ação rápida **Linha 9** no Dashboard.
* Exibe todos os pedidos arquivados com as 4 ações por linha (Data, Editar, Restaurar, Apagar).

### 5. Editar um Pedido Arquivado
* **Via menu:** Acesse o Histórico, clique em **✏️ Editar** na linha desejada. O pedido abre na folha de cálculo.
* **Via Dashboard:** Na tabela de Pedidos Recentes (linhas 15–20), clique na célula da **coluna B** da linha do pedido desejado. A edição abre automaticamente.
* Faça as correções diretamente nas células da planilha.
* Para salvar: **Gestão de Apostilas** > **💾 Salvar Edição no Histórico**.
* Para descartar: **Gestão de Apostilas** > **❌ Cancelar Edição de Pedido**.

### 6. Exportação de Documentos
* **PDF:** Selecione **Gestão de Apostilas** > **🖨️ Exportar para PDF** (folha A4 Retrato com margens e sem a coluna auxiliar).
* **Excel:** Selecione **Gestão de Apostilas** > **📊 Exportar para Excel**.

### 7. Configurações da Unidade (Microlins Potirendaba)
* Acesse: **Gestão de Apostilas** > **⚙️ Configurações (Microlins)**.
* Visualize o painel formatado com identidade visual nobre da unidade para controle da lista de educadores e parâmetros operacionais.

### 8. Ferramentas de Higienização (Menu Gestão de Apostilas)
* **🧹 Limpar Abas Antigas de Backup:** Varre abas `Bkp_*`, sincroniza registros pendentes ao `_BD_Historico` e remove as abas físicas. Ideal para planilhas migradas de versões anteriores.
* **🧹 Remover Pedidos Duplicados no Histórico:** Detecta pedidos com mesmo título e mesmos alunos arquivados mais de uma vez e consolida em uma única entrada limpa.
* **🧹 Limpar Registros Acidentais do Dashboard:** Remove do `_BD_Historico` quaisquer dados internos do Dashboard gravados indevidamente, recalculando e reconstruindo o painel em seguida.

