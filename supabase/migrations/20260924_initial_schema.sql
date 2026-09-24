-- ==============================================================================
-- GESTÃO DE APOSTILAS - MICROLINS POTIRENDABA
-- Migration: 20260924_initial_schema.sql
-- Descrição: Estrutura relacional completa, índices, triggers, RLS e RPCs
-- ==============================================================================

-- Extensão para geração de UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- 1. TABELA: units (Suporte multi-unidade preparado para expansão)
CREATE TABLE IF NOT EXISTS public.units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. TABELA: profiles (Perfis de usuário vinculados ao Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    role VARCHAR(50) NOT NULL DEFAULT 'operator' CHECK (role IN ('admin', 'operator', 'viewer')),
    unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. TABELA: unit_settings (Configurações centrais e identidade visual por unidade)
CREATE TABLE IF NOT EXISTS public.unit_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id UUID NOT NULL UNIQUE REFERENCES public.units(id) ON DELETE CASCADE,
    default_lesson_from INTEGER NOT NULL DEFAULT 4,
    default_lesson_to INTEGER NOT NULL DEFAULT 6,
    ignored_subjects TEXT[] NOT NULL DEFAULT ARRAY['Digitação', 'Digitacao'],
    excluded_contract_types TEXT[] NOT NULL DEFAULT ARRAY['Bolsista'],
    default_contract_status VARCHAR(50) NOT NULL DEFAULT 'Ativo',
    default_delinquency VARCHAR(50) NOT NULL DEFAULT 'Não',
    default_physical_delivery VARCHAR(50) NOT NULL DEFAULT 'Não',
    institutional_blue VARCHAR(20) NOT NULL DEFAULT '#0f3b7d',
    institutional_red VARCHAR(20) NOT NULL DEFAULT '#d91a2a',
    duplicate_background VARCHAR(20) NOT NULL DEFAULT '#fce8e6',
    duplicate_text VARCHAR(20) NOT NULL DEFAULT '#c5221f',
    extra_blank_rows INTEGER NOT NULL DEFAULT 15,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. TABELA: educators (Nomes de educadores a ignorar na importação de alunos)
CREATE TABLE IF NOT EXISTS public.educators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    normalized_name VARCHAR(255) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT educators_unit_name_key UNIQUE (unit_id, normalized_name)
);

-- 5. TABELA: orders (Pedidos de apostilas)
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
    order_number VARCHAR(20) NOT NULL, -- Ex: '#001', '#002'
    sequence_num INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL, -- Preserva maiúsculas/minúsculas exatas
    status VARCHAR(50) NOT NULL DEFAULT 'open' CHECK (status IN ('draft', 'open', 'archived', 'editing', 'cancelled')),
    archived_at TIMESTAMPTZ,
    competence_date DATE NOT NULL DEFAULT CURRENT_DATE,
    competence_month INTEGER NOT NULL,
    competence_year INTEGER NOT NULL,
    total_items INTEGER NOT NULL DEFAULT 0,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    original_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL, -- Caso restaurado
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT orders_unit_seq_key UNIQUE (unit_id, sequence_num)
);

-- 6. TABELA: order_items (Alunos e matérias de cada pedido)
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    student_name VARCHAR(255) NOT NULL,
    student_name_normalized VARCHAR(255) NOT NULL,
    subject_name VARCHAR(255) NOT NULL,
    subject_name_normalized VARCHAR(255) NOT NULL,
    raw_subject_name VARCHAR(255),
    course_name VARCHAR(255),
    educator_name VARCHAR(255),
    contract_number VARCHAR(100),
    current_lesson NUMERIC(5,1) NOT NULL DEFAULT 0,
    scheduled_day VARCHAR(50),
    scheduled_time VARCHAR(50),
    class_schedule VARCHAR(100), -- Ex: 'Segunda-Feira (15:30)'
    next_subject VARCHAR(255),
    phone VARCHAR(50),
    delivery_status VARCHAR(50) NOT NULL DEFAULT 'Pendente',
    delivery_date DATE,
    release_status VARCHAR(50) NOT NULL DEFAULT 'Pendente',
    duplicate_fingerprint VARCHAR(128) NOT NULL, -- hash(normalized_student + '|' + normalized_subject)
    is_internal_duplicate BOOLEAN NOT NULL DEFAULT false,
    is_historical_duplicate BOOLEAN NOT NULL DEFAULT false,
    historical_match_order_title VARCHAR(255),
    source_row INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. TABELA: import_files (Registro de auditoria dos arquivos de importação)
CREATE TABLE IF NOT EXISTS public.import_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    storage_path TEXT,
    total_rows INTEGER NOT NULL DEFAULT 0,
    imported_rows INTEGER NOT NULL DEFAULT 0,
    filtered_rows INTEGER NOT NULL DEFAULT 0,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. TABELA: audit_logs (Trilha de auditoria completa)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id UUID REFERENCES public.units(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- ÍNDICES DE PERFORMANCE E INTEGRIDADE
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_unit_id ON public.profiles(unit_id);
CREATE INDEX IF NOT EXISTS idx_educators_unit_norm ON public.educators(unit_id, normalized_name);
CREATE INDEX IF NOT EXISTS idx_orders_unit_status ON public.orders(unit_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_competence ON public.orders(unit_id, competence_year, competence_month);
CREATE INDEX IF NOT EXISTS idx_orders_archived_at ON public.orders(archived_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_fingerprint ON public.order_items(duplicate_fingerprint);
CREATE INDEX IF NOT EXISTS idx_order_items_student_subj ON public.order_items(student_name_normalized, subject_name_normalized);
CREATE INDEX IF NOT EXISTS idx_audit_logs_unit_entity ON public.audit_logs(unit_id, entity_type, entity_id);

-- ==============================================================================
-- FUNÇÕES E TRIGGERS (Atualização de updated_at e sequência de ordens)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_units_updated_at BEFORE UPDATE ON public.units FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_unit_settings_updated_at BEFORE UPDATE ON public.unit_settings FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_educators_updated_at BEFORE UPDATE ON public.educators FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_order_items_updated_at BEFORE UPDATE ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RPC: Obter próximo número sequencial de pedido por unidade
CREATE OR REPLACE FUNCTION public.get_next_order_sequence(p_unit_id UUID)
RETURNS TABLE (next_seq INT, next_number VARCHAR) AS $$
DECLARE
    v_max INT;
BEGIN
    SELECT COALESCE(MAX(sequence_num), 0) + 1 INTO v_max
    FROM public.orders
    WHERE unit_id = p_unit_id;

    next_seq := v_max;
    next_number := '#' || LPAD(v_max::TEXT, 3, '0');
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- POLÍTICAS DE ROW LEVEL SECURITY (RLS)
-- ==============================================================================

ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.educators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper: Obter unit_id do usuário logado
CREATE OR REPLACE FUNCTION public.current_user_unit_id()
RETURNS UUID AS $$
    SELECT unit_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper: Verificar se o usuário é admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
    SELECT (role = 'admin') FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Políticas para units:
CREATE POLICY "Usuários autenticados podem ver sua própria unidade" ON public.units
    FOR SELECT TO authenticated
    USING (id = public.current_user_unit_id());

-- Políticas para profiles:
CREATE POLICY "Usuários podem ver perfis de sua própria unidade" ON public.profiles
    FOR SELECT TO authenticated
    USING (unit_id = public.current_user_unit_id());

CREATE POLICY "Usuários podem atualizar seu próprio perfil" ON public.profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid());

CREATE POLICY "Admins podem gerenciar perfis de sua unidade" ON public.profiles
    FOR ALL TO authenticated
    USING (unit_id = public.current_user_unit_id() AND public.is_admin());

-- Políticas para unit_settings:
CREATE POLICY "Leitura de configurações da unidade" ON public.unit_settings
    FOR SELECT TO authenticated
    USING (unit_id = public.current_user_unit_id());

CREATE POLICY "Edição de configurações por admins/operadores" ON public.unit_settings
    FOR ALL TO authenticated
    USING (unit_id = public.current_user_unit_id());

-- Políticas para educators:
CREATE POLICY "Visualização de educadores da unidade" ON public.educators
    FOR SELECT TO authenticated
    USING (unit_id = public.current_user_unit_id());

CREATE POLICY "Gerenciamento de educadores da unidade" ON public.educators
    FOR ALL TO authenticated
    USING (unit_id = public.current_user_unit_id());

-- Políticas para orders:
CREATE POLICY "Visualização de pedidos da unidade" ON public.orders
    FOR SELECT TO authenticated
    USING (unit_id = public.current_user_unit_id());

CREATE POLICY "Gerenciamento de pedidos da unidade" ON public.orders
    FOR ALL TO authenticated
    USING (unit_id = public.current_user_unit_id());

-- Políticas para order_items:
CREATE POLICY "Visualização de itens de pedidos da unidade" ON public.order_items
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = order_items.order_id
            AND o.unit_id = public.current_user_unit_id()
        )
    );

CREATE POLICY "Gerenciamento de itens de pedidos da unidade" ON public.order_items
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = order_items.order_id
            AND o.unit_id = public.current_user_unit_id()
        )
    );

-- Políticas para import_files e audit_logs:
CREATE POLICY "Visualização de logs e importações da unidade" ON public.import_files
    FOR SELECT TO authenticated
    USING (unit_id = public.current_user_unit_id());

CREATE POLICY "Criação de registros de importação" ON public.import_files
    FOR INSERT TO authenticated
    WITH CHECK (unit_id = public.current_user_unit_id());

CREATE POLICY "Visualização de auditoria por admins" ON public.audit_logs
    FOR SELECT TO authenticated
    USING (unit_id = public.current_user_unit_id() AND public.is_admin());

CREATE POLICY "Inserção de auditoria" ON public.audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (unit_id = public.current_user_unit_id());
