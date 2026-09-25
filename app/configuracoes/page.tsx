'use client';

import React, { useEffect, useState } from 'react';
import { Settings, Save, CheckCircle2, Sliders, Plus, X, Tag } from 'lucide-react';
import { supabase } from '../../lib/supabase/client';
import { UnitSettings } from '../../types';
import { useDialog } from '../../components/ui/dialog';

export default function ConfiguracoesPage() {
  const { showAlert, showToast } = useDialog();
  const [settings, setSettings] = useState<UnitSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);

  // Estados locais para adição de novos itens na lista
  const [newSubject, setNewSubject] = useState('');
  const [newContractType, setNewContractType] = useState('');

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

  const handleAddSubject = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const val = newSubject.trim();
    if (!val || !settings) return;
    if (settings.ignored_subjects.includes(val)) {
      showToast('Esta matéria já está na lista.', 'warning');
      return;
    }
    setSettings({
      ...settings,
      ignored_subjects: [...settings.ignored_subjects, val],
    });
    setNewSubject('');
  };

  const handleRemoveSubject = (itemToRemove: string) => {
    if (!settings) return;
    setSettings({
      ...settings,
      ignored_subjects: settings.ignored_subjects.filter((s) => s !== itemToRemove),
    });
  };

  const handleAddContractType = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const val = newContractType.trim();
    if (!val || !settings) return;
    if (settings.excluded_contract_types.includes(val)) {
      showToast('Este contrato já está na lista.', 'warning');
      return;
    }
    setSettings({
      ...settings,
      excluded_contract_types: [...settings.excluded_contract_types, val],
    });
    setNewContractType('');
  };

  const handleRemoveContractType = (itemToRemove: string) => {
    if (!settings) return;
    setSettings({
      ...settings,
      excluded_contract_types: settings.excluded_contract_types.filter((c) => c !== itemToRemove),
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    try {
      setIsSaving(true);
      const { error } = await supabase
        .from('unit_settings')
        .upsert(
          {
            unit_id: settings.unit_id,
            default_lesson_from: settings.default_lesson_from,
            default_lesson_to: settings.default_lesson_to,
            ignored_subjects: settings.ignored_subjects,
            excluded_contract_types: settings.excluded_contract_types,
            extra_blank_rows: settings.extra_blank_rows,
            institutional_blue: settings.institutional_blue,
            institutional_red: settings.institutional_red,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'unit_id' }
        );

      if (error) throw error;
      setSuccessMsg(true);
      showToast('Configurações atualizadas com sucesso!', 'success');
      setTimeout(() => setSuccessMsg(false), 3000);
    } catch (err: any) {
      showAlert(
        `Erro ao salvar configurações no banco de dados:\n${err.message || 'Verifique as permissões de acesso.'}`,
        'error',
        'Falha ao Salvar'
      );
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
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0f3b7d] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Aula Final (Até)</label>
              <input
                type="number"
                value={settings.default_lesson_to}
                onChange={(e) => setSettings({ ...settings, default_lesson_to: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0f3b7d] focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Matérias e Contratos Excluídos - Formato de Lista Interativa */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Tag className="w-4 h-4 text-[#0f3b7d]" /> Regras de Exclusão de Matérias e Contratos
          </h2>

          {/* Lista de Matérias Ignoradas */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block">
                Matérias Ignoradas por Padrão
              </label>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Alunos com estas matérias não terão apostilas solicitadas (ex: digitação sem material físico).
              </p>
            </div>

            {/* Badges / Lista */}
            <div className="flex flex-wrap gap-2 p-3 bg-slate-50 border border-slate-200/80 rounded-xl min-h-[50px] items-center">
              {settings.ignored_subjects.length === 0 ? (
                <span className="text-xs text-slate-400 italic">Nenhuma matéria adicionada à lista.</span>
              ) : (
                settings.ignored_subjects.map((sub) => (
                  <span
                    key={sub}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 shadow-sm group hover:border-red-200 transition-colors"
                  >
                    <span>{sub}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSubject(sub)}
                      className="text-slate-400 hover:text-red-500 rounded p-0.5 transition-colors"
                      title={`Remover "${sub}"`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))
              )}
            </div>

            {/* Input para Adicionar Novo Item */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSubject();
                  }
                }}
                placeholder="Digitar nome da matéria e pressionar Enter..."
                className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0f3b7d] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handleAddSubject()}
                disabled={!newSubject.trim()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-[#0f3b7d] text-slate-700 hover:text-white rounded-lg text-xs font-semibold transition-all disabled:opacity-40 disabled:hover:bg-slate-100 disabled:hover:text-slate-700"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar</span>
              </button>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Lista de Contratos Excluídos */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block">
                Tipos de Contrato Excluídos
              </label>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Alunos com esses tipos contratuais serão ignorados do pedido.
              </p>
            </div>

            {/* Badges / Lista */}
            <div className="flex flex-wrap gap-2 p-3 bg-slate-50 border border-slate-200/80 rounded-xl min-h-[50px] items-center">
              {settings.excluded_contract_types.length === 0 ? (
                <span className="text-xs text-slate-400 italic">Nenhum tipo de contrato excluído.</span>
              ) : (
                settings.excluded_contract_types.map((contract) => (
                  <span
                    key={contract}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 shadow-sm group hover:border-red-200 transition-colors"
                  >
                    <span>{contract}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveContractType(contract)}
                      className="text-slate-400 hover:text-red-500 rounded p-0.5 transition-colors"
                      title={`Remover "${contract}"`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))
              )}
            </div>

            {/* Input para Adicionar Novo Tipo de Contrato */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newContractType}
                onChange={(e) => setNewContractType(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddContractType();
                  }
                }}
                placeholder="Digitar tipo de contrato e pressionar Enter..."
                className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0f3b7d] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handleAddContractType()}
                disabled={!newContractType.trim()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-[#0f3b7d] text-slate-700 hover:text-white rounded-lg text-xs font-semibold transition-all disabled:opacity-40 disabled:hover:bg-slate-100 disabled:hover:text-slate-700"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar</span>
              </button>
            </div>
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
                  className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-[#0f3b7d]"
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
                  className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-[#0f3b7d]"
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
