import { describe, it, expect } from 'vitest';
import {
  isValidForecastSubject,
  resolveCourseTotalLessons,
  computeStudentsForecast,
  getDefaultCourseDurations,
  ALLOWED_SPECIAL_SUBJECTS,
} from '../../lib/domain/forecast-engine';

describe('Motor de Previsão de Apostilas & Cronograma de Compras', () => {
  it('deve validar matérias com código numérico e higienizar prefixo', () => {
    const res1 = isValidForecastSubject('161870_Word 2021');
    expect(res1.valid).toBe(true);
    expect(res1.cleanName).toBe('Word 2021');

    const res2 = isValidForecastSubject('161869_Windows 11');
    expect(res2.valid).toBe(true);
    expect(res2.cleanName).toBe('Windows 11');
  });

  it('deve rejeitar cursos descontinuados sem prefixo e ignorar digitação/inglês', () => {
    const resYoutuber = isValidForecastSubject('Youtuber');
    expect(resYoutuber.valid).toBe(false);

    const resDigitacao = isValidForecastSubject('161880_Digitação');
    expect(resDigitacao.valid).toBe(false);

    const resIngles = isValidForecastSubject('161890_Inglês');
    expect(resIngles.valid).toBe(false);
  });

  it('deve permitir matérias comportamentais mesmo sem código numérico', () => {
    ALLOWED_SPECIAL_SUBJECTS.forEach((subj) => {
      const res = isValidForecastSubject(subj);
      expect(res.valid).toBe(true);
    });
  });

  it('deve aplicar as durações de cursos das exceções conhecidas da Microlins', () => {
    const catalog = getDefaultCourseDurations();

    expect(resolveCourseTotalLessons('Robótica 1', catalog).totalLessons).toBe(24);
    expect(resolveCourseTotalLessons('Robótica 2', catalog).totalLessons).toBe(24);
    expect(resolveCourseTotalLessons('Desenvolvimento de Games 2D', catalog).totalLessons).toBe(24);
    expect(resolveCourseTotalLessons('Desenvolvimento de Games 3D - Módulo I', catalog).totalLessons).toBe(24);
    expect(resolveCourseTotalLessons('Desenvolvimento de Games 3D - Módulo II', catalog).totalLessons).toBe(16);
    expect(resolveCourseTotalLessons('Lógica de Programação', catalog).totalLessons).toBe(12);
    expect(resolveCourseTotalLessons('Google Adwords', catalog).totalLessons).toBe(8);
    expect(resolveCourseTotalLessons('Redes - Cabeamento e Infraestrutura', catalog).totalLessons).toBe(13);
    expect(resolveCourseTotalLessons('Redes - Lógica e Estruturação', catalog).totalLessons).toBe(12);
    expect(resolveCourseTotalLessons('Redes - Tecnologia Wireless', catalog).totalLessons).toBe(8);

    // Duração padrão para cursos comuns
    expect(resolveCourseTotalLessons('Word 2021', catalog).totalLessons).toBe(16);
    expect(resolveCourseTotalLessons('Curso Desconhecido X', catalog).totalLessons).toBe(16);
  });

  it('deve calcular a previsão cronológica para alunos no ritmo padrão (2x/semana) e especiais (4x/semana)', () => {
    const catalog = getDefaultCourseDurations();
    const mockStudents = [
      {
        studentName: 'Aluno Imediato',
        rawSubjectName: '161870_Word 2021',
        currentLesson: 5, // >= 4 (gatilho) e sem entrega física
        physicalDelivery: 'Não',
        remainingSubjectsCount: 2,
      },
      {
        studentName: 'Aluno Projetado Padrão',
        rawSubjectName: '161870_Word 2021',
        currentLesson: 1, // aula 1, gatilho 4 -> faltam 3 aulas. Com 2 aulas/sem, semana 2 (Mês 1)
        physicalDelivery: 'Não',
        remainingSubjectsCount: 2,
      },
      {
        studentName: 'Aluno Especial Rápido',
        rawSubjectName: '161870_Robótica 1',
        currentLesson: 20, // faltam 4 aulas para acabar a matéria de 24 aulas
        physicalDelivery: 'Sim', // já tem dessa, precisará da PRÓXIMA matéria
        remainingSubjectsCount: 1,
      },
    ];

    const frequencyConfigs = {
      'aluno especial rapido': 4, // 4 aulas por semana!
    };

    const result = computeStudentsForecast({
      rawOrProcessedItems: mockStudents,
      coursesConfig: catalog,
      frequencyConfigs,
      triggerLesson: 4,
      horizonMonths: 4,
    });

    expect(result.forecastItems.length).toBe(3);

    // Aluno imediato
    const imediato = result.forecastItems.find((i) => i.studentName === 'Aluno Imediato');
    expect(imediato?.status).toBe('imediato');
    expect(imediato?.estimatedMonthIndex).toBe(1);

    // Aluno projetado padrão
    const projetado = result.forecastItems.find((i) => i.studentName === 'Aluno Projetado Padrão');
    expect(projetado?.status).toBe('projetado');
    expect(projetado?.lessonsPerWeek).toBe(2);
    expect(projetado?.isSpecial).toBe(false);

    // Aluno especial rápido
    const especial = result.forecastItems.find((i) => i.studentName === 'Aluno Especial Rápido');
    expect(especial?.lessonsPerWeek).toBe(4);
    expect(especial?.isSpecial).toBe(true);

    // Verifica que o resumo mensal tem 4 meses
    expect(result.monthlySummaries.length).toBe(4);
    expect(result.monthlySummaries[0].totalWorkbooks).toBeGreaterThan(0);
  });
});
