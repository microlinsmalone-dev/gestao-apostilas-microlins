// ==============================================================================
// GESTÃO DE APOSTILAS - MICROLINS POTIRENDABA
// Test: tests/unit/forecast-storage.test.ts
// Testes unitários para persistência de cursos e frequências
// ==============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  saveForecastConfigToCloudAndLocal,
  loadForecastConfigFromCloudAndLocal,
} from '../../lib/domain/forecast-storage';
import { CourseDurationConfig } from '../../types';

// Mock do supabase client
vi.mock('../../lib/supabase/client', () => {
  let mockItemPayload: string | null = null;
  return {
    supabase: {
      from: vi.fn((table: string) => {
        if (table === 'orders') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: { id: 'mock-order-id', order_number: 'CONFIG_FORECAST' },
                  error: null,
                })),
              })),
            })),
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: { id: 'mock-order-id' },
                  error: null,
                })),
              })),
            })),
          };
        }
        if (table === 'order_items') {
          return {
            delete: vi.fn(() => ({
              eq: vi.fn(async () => ({ error: null })),
            })),
            insert: vi.fn(async (params: any) => {
              mockItemPayload = params.raw_subject_name;
              return { error: null };
            }),
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: mockItemPayload ? { raw_subject_name: mockItemPayload } : null,
                  error: null,
                })),
              })),
            })),
          };
        }
        return {};
      }),
    },
  };
});

describe('Forecast Storage - Persistência Confiável', () => {
  const dummyCourses: CourseDurationConfig[] = [
    { id: '1', name: 'Excel Avançado', totalLessons: 24, active: true },
    { id: '2', name: 'Photoshop', totalLessons: 32, active: true },
  ];

  const dummyFrequencies: Record<string, number> = {
    'edson fernando da silva': 4,
    'halley bomfim nascimento da silva': 1,
  };

  beforeEach(() => {
    // Mock simples de localStorage em ambiente node
    const store: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, val: string) => {
        store[key] = val;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        for (const k of Object.keys(store)) delete store[k];
      },
    });
    vi.stubGlobal('window', {});
  });

  it('deve salvar configurações no localStorage e no Supabase com sucesso', async () => {
    const res = await saveForecastConfigToCloudAndLocal(
      'unit-123',
      dummyCourses,
      dummyFrequencies,
      4,
      4
    );

    expect(res.success).toBe(true);
    expect(localStorage.getItem('microlins_forecast_courses')).toBeTruthy();
    expect(localStorage.getItem('microlins_forecast_frequencies')).toBeTruthy();
  });

  it('deve carregar as configurações salvas recuperando cursos e frequências', async () => {
    await saveForecastConfigToCloudAndLocal(
      'unit-123',
      dummyCourses,
      dummyFrequencies,
      4,
      4
    );

    const loaded = await loadForecastConfigFromCloudAndLocal('unit-123');
    expect(loaded).not.toBeNull();
    expect(loaded?.forecast_courses.length).toBe(2);
    expect(loaded?.forecast_frequencies['edson fernando da silva']).toBe(4);
  });
});
