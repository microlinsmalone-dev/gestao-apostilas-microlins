# Gestão de Apostilas • Microlins Potirendaba (Versão Web)

Aplicação Web moderna, independente e de alta precisão desenvolvida em **Next.js (App Router) + TypeScript + Supabase (PostgreSQL + RLS) + Tailwind CSS**, substituindo integralmente a antiga infraestrutura de Google Sheets e Google Apps Script.

---

## 🚀 Tecnologias

- **Frontend:** Next.js 15, React 19, Tailwind CSS, Lucide React
- **Backend / Banco de Dados:** Supabase (PostgreSQL 15+, Row Level Security, RPCs)
- **Processamento de Planilhas:** SheetJS (`xlsx`) para arquivos `.xls`, `.xlsx` e `.csv`
- **Automação & Regras de Negócio:** Módulos de domínio isolados em TypeScript

---

## 📋 Regras de Negócio e Funcionalidades

1. **Higienização de Matérias:** Remoção automática do prefixo numérico (ex: `161869_Windows 11` vira `Windows 11`).
2. **Exclusão de Digitação:** Desconsidera matérias e cursos de Digitação que não demandam material físico.
3. **Exclusão de Educadores:** Filtra automaticamente nomes cadastrados de educadores para evitar que entrem no pedido de apostilas.
4. **Filtros de Contrato:** Valida status `Ativo`, inadimplência `Não`, entrega física `Não` e exclui `Bolsista`.
5. **Filtro Flexível de Aulas:** Permite selecionar faixa de aulas (padrão 4 a 6) ou alternar dinamicamente para "Todas as Aulas" instantaneamente na tela.
6. **Prevenção de Duplicidades em Dupla Camada:**
   - **Interna:** Alerta itens repetidos no mesmo pedido em elaboração.
   - **Histórica:** Compara contra todos os pedidos já arquivados no Supabase, alertando o operador e informando o título do pedido em que a apostila já foi entregue.
7. **Preservação Fiel do Título:** Mantém rigorosamente maiúsculas e minúsculas conforme digitado pelo operador.
8. **Edição Real in-place:** Permite reabrir qualquer pedido arquivado no histórico, editar nomes de alunos e matérias diretamente na tabela e salvar no banco mantendo o ID e a data de criação original.
9. **Exportação:** Geração de planilha Excel `.xlsx` e documento A4 formato Retrato com espaço para assinaturas.
10. **Dashboard em Tempo Real:** Indicadores de Total de Pedidos, Apostilas Entregues, Pedidos no Mês e Status do Sistema.

---

## 💻 Como Rodar o Sistema no seu Computador

### 1. Pré-requisito
Certifique-se de ter o [Node.js](https://nodejs.org/) instalado.

### 2. Configurar Variáveis de Ambiente
O arquivo `.env.local` já está configurado com as chaves do seu Supabase:
```env
NEXT_PUBLIC_SUPABASE_URL=https://apfcbkucxjcleqxarlmv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_DZAXwbvMzgz31wR-pmbNkg_aNg3ofG0
NEXT_PUBLIC_DEFAULT_UNIT_ID=a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
```

### 3. Iniciar o Servidor
Execute no terminal:
```bash
npm run dev
```
Abra o navegador em: [http://localhost:3000](http://localhost:3000)

---

## 🗄️ Estrutura do Banco no Supabase

Para aplicar a estrutura do banco e dados iniciais no seu painel do Supabase:
1. Acesse o **SQL Editor** no painel do Supabase (`https://supabase.com/dashboard/project/apfcbkucxjcleqxarlmv/sql`).
2. Copie e execute o conteúdo de:
   - [`supabase/migrations/20260924_initial_schema.sql`](supabase/migrations/20260924_initial_schema.sql)
   - [`supabase/seed.sql`](supabase/seed.sql)

---

## 🌐 Como Publicar na Nuvem (Vercel) e GitHub

Se você ainda não tem familiaridade com o GitHub, o processo é simples:

### Passo 1: Criar Repositório no GitHub
1. Acesse [github.com](https://github.com/) e crie uma conta (se ainda não tiver).
2. Clique no botão verde **"New"** para criar um novo repositório chamado `gestao-apostilas-microlins`.
3. Escolha **Private** (Privado) e clique em **Create repository**.

### Passo 2: Fazer o Upload ou Sincronização
Você pode usar o aplicativo visual gratuito [GitHub Desktop](https://desktop.github.com/):
1. Instale o GitHub Desktop.
2. Clique em **File** > **Add Local Repository** e selecione esta pasta do projeto.
3. Clique em **Publish repository**.

### Passo 3: Publicar na Vercel (Gratuito)
1. Acesse [vercel.com](https://vercel.com/) e faça login com sua conta do GitHub.
2. Clique em **Add New...** > **Project**.
3. Selecione o repositório `gestao-apostilas-microlins`.
4. Em **Environment Variables**, adicione as mesmas variáveis do seu arquivo `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_DEFAULT_UNIT_ID`
5. Clique em **Deploy**. Em cerca de 1 minuto, seu sistema estará online com um link seguro (ex: `https://gestao-apostilas-microlins.vercel.app`).
