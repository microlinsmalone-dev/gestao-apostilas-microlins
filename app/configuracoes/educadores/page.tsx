'use client';

import React, { useEffect, useState } from 'react';
import {
  GraduationCap,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  Search,
  AlertCircle
} from 'lucide-react';
import { supabase } from '../../../lib/supabase/client';
import { normalizeText } from '../../../lib/domain/sanitizer';
import { Educator } from '../../../types';
import { useDialog } from '../../../components/ui/dialog';

export default function EducadoresPage() {
  const { showAlert, showConfirm, showToast } = useDialog();
  const [educators, setEducators] = useState<Educator[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [newName, setNewName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const loadEducators = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('educators')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setEducators(data || []);
    } catch (err: any) {
      console.warn('Erro ao buscar educadores:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEducators();
  }, []);

  const handleAddEducator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      setIsAdding(true);
      setErrorMsg('');
      const unitId = process.env.NEXT_PUBLIC_DEFAULT_UNIT_ID || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
      const clean = newName.trim();
      const norm = normalizeText(clean);

      const { data, error } = await supabase
        .from('educators')
        .insert({
          unit_id: unitId,
          name: clean,
          normalized_name: norm,
          active: true,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('Este educador já está cadastrado.');
        }
        throw error;
      }

      setNewName('');
      showToast(`Educador "${clean}" adicionado com sucesso!`, 'success');
      loadEducators();
    } catch (err: any) {
      const msg = err.message || 'Erro ao adicionar educador.';
      setErrorMsg(msg);
      showAlert(
        `Não foi possível adicionar o educador:\n${msg}`,
        'error',
        'Erro ao Salvar'
      );
    } finally {
      setIsAdding(false);
    }
  };

  const handleToggleActive = async (educator: Educator) => {
    try {
      const { error } = await supabase
        .from('educators')
        .update({ active: !educator.active })
        .eq('id', educator.id);

      if (error) throw error;
      showToast(
        `Educador "${educator.name}" ${!educator.active ? 'ativado' : 'desativado'}.`,
        'info'
      );
      loadEducators();
    } catch (err: any) {
      showAlert(`Erro ao atualizar status: ${err.message}`, 'error');
    }
  };

  const handleDeleteEducator = (id: string, name: string) => {
    showConfirm({
      title: 'Excluir Educador',
      message: `Tem certeza que deseja remover "${name}" da lista de exclusão?`,
      confirmText: 'Sim, excluir',
      cancelText: 'Cancelar',
      type: 'warning',
      onConfirm: async () => {
        try {
          const { error } = await supabase.from('educators').delete().eq('id', id);
          if (error) throw error;
          showToast(`Educador "${name}" removido com sucesso.`, 'success');
          loadEducators();
        } catch (err: any) {
          showAlert(`Erro ao excluir educador: ${err.message}`, 'error');
        }
      },
    });
  };

  const filtered = educators.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 space-y-6 max-w-5xl mx-auto w-full">
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <GraduationCap className="w-6 h-6 text-[#0f3b7d]" />
          Configuração de Educadores
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Nomes cadastrados nesta lista são automaticamente desconsiderados como alunos durante a importação
        </p>
      </div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Formulário de Adição */}
      <form
        onSubmit={handleAddEducator}
        className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center gap-3"
      >
        <div className="flex-1 w-full">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nome completo do educador / funcionário a ignorar..."
            className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f3b7d]"
          />
        </div>
        <button
          type="submit"
          disabled={isAdding || !newName.trim()}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0f3b7d] hover:bg-[#0a2e68] text-white rounded-lg text-xs font-semibold shadow-sm transition-all disabled:opacity-50 shrink-0 w-full sm:w-auto justify-center"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{isAdding ? 'Adicionando...' : 'Adicionar Educador'}</span>
        </button>
      </form>

      {/* Tabela de Educadores */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700">
            Total Cadastrado: {educators.length} educador(es)
          </span>

          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar educador..."
              className="w-full pl-8 pr-3 py-1 text-xs border border-slate-300 rounded-md focus:outline-none"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-xs">Carregando educadores...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">Nenhum educador encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-4">Nome do Educador</th>
                  <th className="py-2.5 px-4 text-center">Status</th>
                  <th className="py-2.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((edu) => (
                  <tr key={edu.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-4 font-semibold text-slate-900">{edu.name}</td>
                    <td className="py-2.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(edu)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          edu.active
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}
                      >
                        {edu.active ? (
                          <>
                            <CheckCircle className="w-3 h-3 text-emerald-600" /> Ativo
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 text-slate-400" /> Inativo
                          </>
                        )}
                      </button>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteEducator(edu.id, edu.name)}
                        className="text-slate-400 hover:text-red-600 p-1 rounded"
                        title="Excluir educador"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
