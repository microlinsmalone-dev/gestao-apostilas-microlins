'use client';

import React, { useEffect, useState } from 'react';
import { Settings, Save, CheckCircle2, Sliders, Plus, X, Tag, Info } from 'lucide-react';
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
        if (typeof window !== 'undefined' && data) {
          localStorage.setItem('microlins_unit_settings', JSON.stringify(data));
        }
      } catch (err) {
        console.warn('Configurações offline ou padrão:', err);
        // Fallback default
        const fallbackSettings: UnitSettings = {
          id: '1',
          unit_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          default_lesson_from: 2,
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
        };
        setSettings(fallbackSettings);
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
      if (typeof window !== 'undefined' && settings) {
        localStorage.setItem('microlins_unit_settings', JSON.stringify(settings));
      }
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
          Parâmetros
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Regras de negócio padronizadas e parâmetros de importação
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

        {/* Matérias e Contratos Excluídos - Formato de 2 Colunas e Lista */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Tag className="w-4 h-4 text-[#0f3b7d]" /> Regras de Exclusão de Matérias e Contratos
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Defina as matérias e os tipos contratuais que não devem gerar pedidos de apostilas.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Coluna 1: Lista de Matérias Ignoradas */}
            <div className="space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block">
                    Matérias Ignoradas por Padrão ({settings.ignored_subjects.length})
                  </label>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Alunos com estas matérias não terão apostilas solicitadas (ex: digitação sem material físico).
                  </p>
                </div>

                {/* Lista Vertical com Scroll */}
                <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl max-h-64 min-h-[140px] overflow-y-auto space-y-1.5">
                  {settings.ignored_subjects.length === 0 ? (
                    <div className="text-xs text-slate-400 italic p-3 text-center">Nenhuma matéria adicionada à lista.</div>
                  ) : (
                    settings.ignored_subjects.map((sub) => (
                      <div
                        key={sub}
                        className="flex items-center justify-between px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 shadow-xs group hover:border-slate-300 transition-colors"
                      >
                        <span className="truncate pr-2">{sub}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSubject(sub)}
                          className="text-slate-400 hover:text-red-500 rounded p-0.5 transition-colors shrink-0"
                          title={`Remover "${sub}"`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Input para Adicionar Novo Item */}
              <div className="flex items-center gap-2 pt-1">
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
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-[#0f3b7d] text-slate-700 hover:text-white rounded-lg text-xs font-semibold transition-all disabled:opacity-40 disabled:hover:bg-slate-100 disabled:hover:text-slate-700 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar</span>
                </button>
              </div>
            </div>

            {/* Coluna 2: Lista de Contratos Excluídos */}
            <div className="space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block">
                    Tipos de Contrato Excluídos ({settings.excluded_contract_types.length})
                  </label>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Marque os tipos contratuais que devem ser ignorados do pedido.
                  </p>
                </div>

                {/* Lista Vertical com Scroll */}
                <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl max-h-64 min-h-[140px] overflow-y-auto space-y-1.5">
                  {settings.excluded_contract_types.length === 0 ? (
                    <div className="text-xs text-slate-400 italic p-3 text-center">Nenhum tipo de contrato cadastrado.</div>
                  ) : (
                    settings.excluded_contract_types.map((contract) => (
                      <div
                        key={contract}
                        className="flex items-center justify-between px-3 py-1.5 bg-white border border-slate-200 rounded-lg shadow-xs group hover:border-slate-300 transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-4 h-4 rounded border-2 border-[#0f3b7d] bg-[#0f3b7d] flex items-center justify-center shrink-0">
                            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <span className="text-xs font-medium text-slate-700">{contract}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveContractType(contract)}
                          className="text-slate-400 hover:text-red-500 rounded p-0.5 transition-colors shrink-0"
                          title={`Remover "${contract}" permanentemente`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Input para Adicionar Novo Tipo de Contrato */}
              <div className="space-y-1 pt-1">
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
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-[#0f3b7d] text-slate-700 hover:text-white rounded-lg text-xs font-semibold transition-all disabled:opacity-40 disabled:hover:bg-slate-100 disabled:hover:text-slate-700 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar</span>
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 italic flex items-center gap-1 mt-1">
                  <Info className="w-3.5 h-3.5 text-[#0f3b7d] shrink-0 not-italic" />
                  <span>Os tipos acima serão excluídos automaticamente ao importar planilhas.</span>
                </p>
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
