'use client';

import React, { useEffect, useState } from 'react';
import { Settings, Save, CheckCircle2, Sliders } from 'lucide-react';
import { supabase } from '../../lib/supabase/client';
import { UnitSettings } from '../../types';

export default function ConfiguracoesPage() {
  const [settings, setSettings] = useState<UnitSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      try {
        setLoading(true);
        const unitId = process.env.NEXT_PUBLIC_DEFAULT_UNIT_ID || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
        const { data, error } = await supabase
          .from('unit_settings')
          .select('*')
          .eq('unit_id', unitId)
          .single();

        if (error) throw error;
        setSettings(data);
      } catch (err) {
        console.warn('Configurações offline ou padrão:', err);
        // Fallback default
        setSettings({
          id: '1',
          unit_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          default_lesson_from: 4,
          default_lesson_to: 6,
          ignored_subjects: ['Digitação', 'Digitacao'],
          excluded_contract_types: ['Bolsista'],
          default_contract_status: 'Ativo',
          default_delinquency: 'Não',
          default_physical_delivery: 'Não',
          institutional_blue: '#0f3b7d',
          institutional_red: '#d91a2a',
          duplicate_background: '#fce8e6',
          duplicate_text: '#c5221f',
          extra_blank_rows: 15,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    try {
      setIsSaving(true);
      const { error } = await supabase
        .from('unit_settings')
        .upsert({
          unit_id: settings.unit_id,
          default_lesson_from: settings.default_lesson_from,
          default_lesson_to: settings.default_lesson_to,
          ignored_subjects: settings.ignored_subjects,
          excluded_contract_types: settings.excluded_contract_types,
          extra_blank_rows: settings.extra_blank_rows,
          institutional_blue: settings.institutional_blue,
          institutional_red: settings.institutional_red,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
      setSuccessMsg(true);
      setTimeout(() => setSuccessMsg(false), 3000);
    } catch (err: any) {
      alert(`Erro ao salvar configurações: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading || !settings) {
    return <div className="p-8 text-xs text-slate-400">Carregando configurações...</div>;
  }

  return (
    <div className="p-8 space-y-6 max-w-4xl mx-auto w-full">
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Settings className="w-6 h-6 text-[#0f3b7d]" />
          Parâmetros da Unidade (Microlins Potirendaba)
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Regras de negócio padronizadas, parâmetros de importação e identidade visual
        </p>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Configurações atualizadas com sucesso!</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Faixa Padrão de Aulas */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#0f3b7d]" /> Faixa de Aulas Padrão
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Aula Inicial (De)</label>
              <input
                type="number"
                value={settings.default_lesson_from}
                onChange={(e) => setSettings({ ...settings, default_lesson_from: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Aula Final (Até)</label>
              <input
                type="number"
                value={settings.default_lesson_to}
                onChange={(e) => setSettings({ ...settings, default_lesson_to: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* Matérias e Contratos Excluídos */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-800">Regras de Exclusão de Matérias</h2>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">
              Matérias Ignoradas por Padrão (separadas por vírgula)
            </label>
            <input
              type="text"
              value={settings.ignored_subjects.join(', ')}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  ignored_subjects: e.target.value.split(',').map((s) => s.trim()),
                })
              }
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Exemplo: Digitação, Digitacao
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">
              Tipos de Contrato Excluídos
            </label>
            <input
              type="text"
              value={settings.excluded_contract_types.join(', ')}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  excluded_contract_types: e.target.value.split(',').map((s) => s.trim()),
                })
              }
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
          </div>
        </div>

        {/* Identidade Visual */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-800">Identidade Visual Microlins Potirendaba</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Azul Institucional</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.institutional_blue}
                  onChange={(e) => setSettings({ ...settings, institutional_blue: e.target.value })}
                  className="w-8 h-8 rounded border border-slate-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={settings.institutional_blue}
                  onChange={(e) => setSettings({ ...settings, institutional_blue: e.target.value })}
                  className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Vermelho Institucional</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.institutional_red}
                  onChange={(e) => setSettings({ ...settings, institutional_red: e.target.value })}
                  className="w-8 h-8 rounded border border-slate-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={settings.institutional_red}
                  onChange={(e) => setSettings({ ...settings, institutional_red: e.target.value })}
                  className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex items-center gap-2 bg-[#0f3b7d] hover:bg-[#0a2e68] text-white px-6 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{isSaving ? 'Salvando...' : 'Salvar Parâmetros'}</span>
        </button>
      </form>
    </div>
  );
}
