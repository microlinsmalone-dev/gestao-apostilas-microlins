-- ==============================================================================
-- GESTÃO DE APOSTILAS - MICROLINS POTIRENDABA
-- Seed Data: supabase/seed.sql
-- Dados iniciais da unidade, configurações padrão e educadores
-- ==============================================================================

-- 1. Unidade Padrão
INSERT INTO public.units (id, name, slug, active)
VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Microlins Potirendaba',
    'potirendaba',
    true
) ON CONFLICT (slug) DO NOTHING;

-- 2. Configurações da Unidade
INSERT INTO public.unit_settings (
    unit_id,
    default_lesson_from,
    default_lesson_to,
    ignored_subjects,
    excluded_contract_types,
    default_contract_status,
    default_delinquency,
    default_physical_delivery,
    institutional_blue,
    institutional_red,
    duplicate_background,
    duplicate_text,
    extra_blank_rows
) VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    4,
    6,
    ARRAY['Digitação', 'Digitacao'],
    ARRAY['Bolsista'],
    'Ativo',
    'Não',
    'Não',
    '#0f3b7d',
    '#d91a2a',
    '#fce8e6',
    '#c5221f',
    15
) ON CONFLICT (unit_id) DO NOTHING;

-- 3. Educadores Padrão da Unidade
INSERT INTO public.educators (unit_id, name, normalized_name, active) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Malone de Souza', 'malone de souza', true),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Antonio Fagner dos Santos Silva', 'antonio fagner dos santos silva', true),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Pyetra Alves Vieira de Oliveira', 'pyetra alves vieira de oliveira', true),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Andrey', 'andrey', true),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Josemara Perpetua Da Silva', 'josemara perpetua da silva', true)
ON CONFLICT (unit_id, normalized_name) DO NOTHING;
