import { describe, it, expect } from 'vitest';
import {
  isValidForecastSubject,
  resolveCourseTotalLessons,
  computeStudentsForecast,
  getDefaultCourseDurations,
  ALLOWED_SPECIAL_SUBJECTS,
  resolveNextSequentialSubject,
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

    expect(resolveCourseTotalLessons('Robótica - Módulo I', catalog).totalLessons).toBe(24);
    expect(resolveCourseTotalLessons('Robótica - Módulo II', catalog).totalLessons).toBe(24);
    expect(resolveCourseTotalLessons('Desenvolvimento de Games', catalog).totalLessons).toBe(24);
    expect(resolveCourseTotalLessons('Desenvolvimento de Games 3D - Módulo I', catalog).totalLessons).toBe(24);
    expect(resolveCourseTotalLessons('Desenvolvimento de Games 3D - Módulo II', catalog).totalLessons).toBe(16);
    expect(resolveCourseTotalLessons('Lógica de Programação', catalog).totalLessons).toBe(12);
    expect(resolveCourseTotalLessons('Google Adwords', catalog).totalLessons).toBe(8);
    expect(resolveCourseTotalLessons('Redes - Cabeamento e Infraestrutura', catalog).totalLessons).toBe(13);
    expect(resolveCourseTotalLessons('Redes - Lógica e Estruturação', catalog).totalLessons).toBe(12);
    expect(resolveCourseTotalLessons('Redes - Tecnologias Wireless', catalog).totalLessons).toBe(8);

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
        rawSubjectName: '161870_Robótica - Módulo I',
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

    // 3 alunos únicos no período
    expect(result.uniqueStudentsCount).toBe(3);
    // Demanda distribuída ao longo dos ciclos e meses
    expect(result.forecastItems.length).toBeGreaterThanOrEqual(3);

    // Aluno imediato no Mês 1
    const imediato = result.forecastItems.find(
      (i) => i.studentName === 'Aluno Imediato' && i.stage === 'atual'
    );
    expect(imediato?.status).toBe('imediato');
    expect(imediato?.estimatedMonthIndex).toBe(1);

    // Aluno projetado padrão
    const projetado = result.forecastItems.find(
      (i) => i.studentName === 'Aluno Projetado Padrão' && i.stage === 'atual'
    );
    expect(projetado?.status).toBe('projetado');
    expect(projetado?.lessonsPerWeek).toBe(2);
    expect(projetado?.isSpecial).toBe(false);

    // Aluno especial rápido
    const especial = result.forecastItems.find(
      (i) => i.studentName === 'Aluno Especial Rápido'
    );
    expect(especial?.lessonsPerWeek).toBe(4);
    expect(especial?.isSpecial).toBe(true);

    // Verifica que o resumo mensal tem 4 meses e distribui demandas
    expect(result.monthlySummaries.length).toBe(4);
    expect(result.monthlySummaries[0].totalWorkbooks).toBeGreaterThan(0);
    expect(result.totalWorkbooksCount).toBeGreaterThan(0);

    // REGRA DE NEGÓCIO: APENAS MATÉRIA ATUAL E PRÓXIMA MATÉRIA
    // 1. Nenhuma matéria com stage 'futura' pode ser gerada
    const hasFutura = result.forecastItems.some((i: any) => i.stage === 'futura');
    expect(hasFutura).toBe(false);

    // 2. Todos os itens gerados devem ser estritamente 'atual' ou 'proxima'
    result.forecastItems.forEach((item) => {
      expect(['atual', 'proxima']).toContain(item.stage);
    });

    // 3. Nenhum aluno deve ter mais de 2 demandas no período
    const studentDemandsMap = new Map<string, number>();
    result.forecastItems.forEach((item) => {
      studentDemandsMap.set(item.studentName, (studentDemandsMap.get(item.studentName) || 0) + 1);
    });
    studentDemandsMap.forEach((count) => {
      expect(count).toBeLessThanOrEqual(2);
    });

    // 4. Aluno Especial Rápido que cursava Robótica - Módulo I deve ter como próxima matéria Robótica - Módulo II
    const especialNext = result.forecastItems.find(
      (i) => i.studentName === 'Aluno Especial Rápido' && i.stage === 'proxima'
    );
    expect(especialNext?.subjectName).toBe('Robótica - Módulo II');
  });

  it('deve resolver a próxima matéria sequencial lógica (Módulo I -> Módulo II)', () => {
    const catalog = getDefaultCourseDurations();

    expect(
      resolveNextSequentialSubject('Assistente Administrativo e Rotinas Administrativas - Módulo I', catalog)
    ).toBe('Assistente Administrativo e Rotinas Administrativas - Módulo II');

    expect(
      resolveNextSequentialSubject('Adobe Photoshop - Creative Cloud - Módulo I', catalog)
    ).toBe('Adobe Photoshop - Creative Cloud - Módulo II');

    expect(
      resolveNextSequentialSubject('Robótica - Módulo I', catalog)
    ).toBe('Robótica - Módulo II');

    // Cursos sem numeração de módulo retornam null
    expect(resolveNextSequentialSubject('Excel 2021', catalog)).toBeNull();
    expect(resolveNextSequentialSubject('Word 2021', catalog)).toBeNull();
  });

  it('deve agrupar contratos com múltiplas matérias e não explodir matérias não iniciadas no Mês 1', () => {
    const catalog = getDefaultCourseDurations();
    // Simula 1 aluno que possui 6 matérias no contrato do pacote (como ocorre no relatório real)
    const mockStudentMultiRows = [
      {
        studentName: 'Douglas Henrique',
        rawSubjectName: '161860_CorelDraw Graphics Suite - Módulo II',
        currentLesson: 14,
        startDate: '2026-02-01', // Iniciada
        physicalDelivery: 'Sim', // Já entregue
      },
      {
        studentName: 'Douglas Henrique',
        rawSubjectName: '161884_Adobe Illustrator - Creative Cloud',
        currentLesson: 10,
        startDate: '2026-03-01', // Iniciada
        physicalDelivery: 'Não', // Demanda imediata
      },
      {
        studentName: 'Douglas Henrique',
        rawSubjectName: '161873_Internet e Outlook',
        currentLesson: 1,
        startDate: '', // NÃO iniciada (na fila da grade)
        physicalDelivery: 'Não',
      },
      {
        studentName: 'Douglas Henrique',
        rawSubjectName: '161876_Internet, Redes Sociais e Aplicativos',
        currentLesson: 1,
        startDate: '', // NÃO iniciada
        physicalDelivery: 'Não',
      },
      {
        studentName: 'Douglas Henrique',
        rawSubjectName: '161871_Excel 2021',
        currentLesson: 1,
        startDate: '', // NÃO iniciada
        physicalDelivery: 'Não',
      },
      {
        studentName: 'Douglas Henrique',
        rawSubjectName: '161870_Word 2021',
        currentLesson: 1,
        startDate: '', // NÃO iniciada
        physicalDelivery: 'Não',
      },
    ];

    const result = computeStudentsForecast({
      rawOrProcessedItems: mockStudentMultiRows,
      coursesConfig: catalog,
      frequencyConfigs: {},
      triggerLesson: 4,
      horizonMonths: 4,
    });

    // 1 único aluno
    expect(result.uniqueStudentsCount).toBe(1);

    // No Mês 1, APENAS a matéria iniciada sem livro (Illustrator) deve ser agendada imediatamente
    // Matérias não iniciadas da grade como Word, Excel, Internet NUNCA devem ser agendadas para o Mês 1
    const m1Items = result.forecastItems.filter((i) => i.estimatedMonthIndex === 1 && i.status === 'imediato');
    expect(m1Items.length).toBe(1);
    expect(m1Items[0].subjectName).toBe('Adobe Illustrator - Creative Cloud');

    // A próxima matéria deve ser selecionada da fila da grade (Internet e Outlook)
    const proximaItems = result.forecastItems.filter((i) => i.stage === 'proxima');
    expect(proximaItems.length).toBeGreaterThanOrEqual(1);
    expect(proximaItems[0].subjectName).toBe('Internet e Outlook');

    // As outras matérias da grade (Excel, Word) NÃO devem gerar demandas simultâneas
    const hasWord = result.forecastItems.some((i) => i.subjectName.includes('Word'));
    expect(hasWord).toBe(false);
  });
});
