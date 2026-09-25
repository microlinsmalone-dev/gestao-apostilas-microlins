-- ==============================================================================
-- GESTÃO DE APOSTILAS - MICROLINS POTIRENDABA
-- Correção de Políticas RLS (Row Level Security) para Acesso Anônimo/Público
-- Arquivo: supabase/migrations/20260925_fix_rls_policies.sql
-- ==============================================================================

-- 1. Desabilitar RLS ou criar políticas irrestritas para 'anon' e 'authenticated'

-- UNIT_SETTINGS
ALTER TABLE public.unit_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Leitura de configurações da unidade" ON public.unit_settings;
DROP POLICY IF EXISTS "Edição de configurações por admins/operadores" ON public.unit_settings;
DROP POLICY IF EXISTS "Acesso total a unit_settings para anon e authenticated" ON public.unit_settings;

CREATE POLICY "Acesso total a unit_settings para anon e authenticated"
ON public.unit_settings
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- EDUCATORS
ALTER TABLE public.educators ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Visualização de educadores da unidade" ON public.educators;
DROP POLICY IF EXISTS "Gerenciamento de educadores da unidade" ON public.educators;
DROP POLICY IF EXISTS "Acesso total a educators para anon e authenticated" ON public.educators;

CREATE POLICY "Acesso total a educators para anon e authenticated"
ON public.educators
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- ORDERS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Visualização de pedidos da unidade" ON public.orders;
DROP POLICY IF EXISTS "Gerenciamento de pedidos da unidade" ON public.orders;
DROP POLICY IF EXISTS "Acesso total a orders para anon e authenticated" ON public.orders;

CREATE POLICY "Acesso total a orders para anon e authenticated"
ON public.orders
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- ORDER_ITEMS
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Visualização de itens de pedidos da unidade" ON public.order_items;
DROP POLICY IF EXISTS "Gerenciamento de itens de pedidos da unidade" ON public.order_items;
DROP POLICY IF EXISTS "Acesso total a order_items para anon e authenticated" ON public.order_items;

CREATE POLICY "Acesso total a order_items para anon e authenticated"
ON public.order_items
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- UNITS
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários autenticados podem ver sua própria unidade" ON public.units;
DROP POLICY IF EXISTS "Acesso total a units para anon e authenticated" ON public.units;

CREATE POLICY "Acesso total a units para anon e authenticated"
ON public.units
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- IMPORT_FILES
ALTER TABLE public.import_files ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Visualização de logs e importações da unidade" ON public.import_files;
DROP POLICY IF EXISTS "Criação de registros de importação" ON public.import_files;
DROP POLICY IF EXISTS "Acesso total a import_files para anon e authenticated" ON public.import_files;

CREATE POLICY "Acesso total a import_files para anon e authenticated"
ON public.import_files
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- AUDIT_LOGS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Visualização de auditoria por admins" ON public.audit_logs;
DROP POLICY IF EXISTS "Inserção de auditoria" ON public.audit_logs;
DROP POLICY IF EXISTS "Acesso total a audit_logs para anon e authenticated" ON public.audit_logs;

CREATE POLICY "Acesso total a audit_logs para anon e authenticated"
ON public.audit_logs
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);
