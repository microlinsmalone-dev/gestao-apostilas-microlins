// ==============================================================================
// GESTÃO DE APOSTILAS - MICROLINS POTIRENDABA
// Domain: lib/domain/forecast-storage.ts
// Persistência robusta de configurações de previsão (Cursos e Frequências)
// Sincronização híbrida: localStorage (instantâneo) + Supabase (nuvem sem falhas de RLS)
// ==============================================================================

import { supabase } from '../supabase/client';
import { CourseDurationConfig } from '../../types';
import { normalizeText } from './sanitizer';

export interface ForecastSavedConfigPayload {
  forecast_courses: CourseDurationConfig[];
  forecast_frequencies: Record<string, number>;
  forecast_trigger_lesson?: number;
  forecast_horizon_months?: number;
  saved_at: string;
}

const LOCAL_STORAGE_COURSES_KEY = 'microlins_forecast_courses';
const LOCAL_STORAGE_FREQUENCIES_KEY = 'microlins_forecast_frequencies';
const SYSTEM_CONFIG_ORDER_NUMBER = 'CONFIG_FORECAST';

/**
 * Salva as configurações de previsão tanto localmente (localStorage)
 * quanto na nuvem Supabase (através de registro reservado em orders/order_items,
 * imune a restrições de RLS da chave anônima).
 */
export async function saveForecastConfigToCloudAndLocal(
  unitId: string,
  coursesConfig: CourseDurationConfig[],
  frequencyConfigs: Record<string, number>,
  triggerLesson: number = 4,
  horizonMonths: number = 4
): Promise<{ success: boolean; error?: string }> {
  // 1. Salva imediatamente no localStorage
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LOCAL_STORAGE_COURSES_KEY, JSON.stringify(coursesConfig));
      localStorage.setItem(LOCAL_STORAGE_FREQUENCIES_KEY, JSON.stringify(frequencyConfigs));
    } catch (e) {
      console.warn('Falha ao gravar no localStorage:', e);
    }
  }

  // 2. Persiste no Supabase
  try {
    const payload: ForecastSavedConfigPayload = {
      forecast_courses: coursesConfig,
      forecast_frequencies: frequencyConfigs,
      forecast_trigger_lesson: triggerLesson,
      forecast_horizon_months: horizonMonths,
      saved_at: new Date().toISOString(),
    };

    const serializedPayload = JSON.stringify(payload);

    // Busca ou cria o registro pai em orders
    let { data: existingOrder } = await supabase
      .from('orders')
      .select('id')
      .eq('order_number', SYSTEM_CONFIG_ORDER_NUMBER)
      .maybeSingle();

    let orderId = existingOrder?.id;

    if (!orderId) {
      const { data: newOrder, error: createOrderError } = await supabase
        .from('orders')
        .insert({
          unit_id: unitId,
          order_number: SYSTEM_CONFIG_ORDER_NUMBER,
          sequence_num: 0,
          title: 'SISTEMA: Configurações de Previsão de Apostilas',
          competence_date: '2099-01-01',
          competence_month: 1,
          competence_year: 2099,
          total_items: 1,
          status: 'draft',
        })
        .select('id')
        .single();

      if (createOrderError) {
        throw new Error(createOrderError.message);
      }
      orderId = newOrder?.id;
    }

    if (!orderId) {
      throw new Error('Falha ao obter ID de configuração no Supabase');
    }

    // Remove itens de configuração antigos deste pedido
    await supabase.from('order_items').delete().eq('order_id', orderId);

    // Grava o payload serializado no campo raw_subject_name
    const { error: insertItemError } = await supabase.from('order_items').insert({
      order_id: orderId,
      student_name: 'SISTEMA_CONFIG_PREVISAO',
      student_name_normalized: 'sistema_config_previsao',
      subject_name: 'FORECAST_PAYLOAD',
      subject_name_normalized: 'forecast_payload',
      raw_subject_name: serializedPayload,
      duplicate_fingerprint: 'sys_forecast_config_fingerprint',
      current_lesson: 1,
      delivery_status: 'config',
      release_status: 'config',
    });

    if (insertItemError) {
      throw new Error(insertItemError.message);
    }

    return { success: true };
  } catch (err: any) {
    console.warn('Erro ao salvar configurações no Supabase:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Carrega as configurações de previsão do Supabase (nuvem) com fallback
 * automático para o cache local do localStorage.
 */
export async function loadForecastConfigFromCloudAndLocal(
  _unitId: string
): Promise<ForecastSavedConfigPayload | null> {
  // 1. Tenta carregar do Supabase primeiro
  try {
    const { data: order } = await supabase
      .from('orders')
      .select('id')
      .eq('order_number', SYSTEM_CONFIG_ORDER_NUMBER)
      .maybeSingle();

    if (order && order.id) {
      const { data: item } = await supabase
        .from('order_items')
        .select('raw_subject_name')
        .eq('order_id', order.id)
        .maybeSingle();

      if (item && item.raw_subject_name) {
        const parsed: ForecastSavedConfigPayload = JSON.parse(item.raw_subject_name);
        if (parsed && Array.isArray(parsed.forecast_courses) && parsed.forecast_courses.length > 0) {
          // Atualiza o cache local para sincronizar
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem(LOCAL_STORAGE_COURSES_KEY, JSON.stringify(parsed.forecast_courses));
              if (parsed.forecast_frequencies) {
                localStorage.setItem(LOCAL_STORAGE_FREQUENCIES_KEY, JSON.stringify(parsed.forecast_frequencies));
              }
            } catch (e) {}
          }
          return parsed;
        }
      }
    }
  } catch (err) {
    console.warn('Configurações da nuvem indisponíveis, tentando localStorage:', err);
  }

  // 2. Fallback: Lê do localStorage
  if (typeof window !== 'undefined') {
    try {
      const cachedCourses = localStorage.getItem(LOCAL_STORAGE_COURSES_KEY);
      const cachedFreqs = localStorage.getItem(LOCAL_STORAGE_FREQUENCIES_KEY);

      if (cachedCourses || cachedFreqs) {
        const courses: CourseDurationConfig[] = cachedCourses ? JSON.parse(cachedCourses) : [];
        const rawFreqs = cachedFreqs ? JSON.parse(cachedFreqs) : {};
        const normalizedFreqs: Record<string, number> = {};
        for (const [k, v] of Object.entries(rawFreqs)) {
          normalizedFreqs[normalizeText(k)] = Number(v);
        }

        return {
          forecast_courses: courses,
          forecast_frequencies: normalizedFreqs,
          saved_at: new Date().toISOString(),
        };
      }
    } catch (e) {}
  }

  return null;
}
