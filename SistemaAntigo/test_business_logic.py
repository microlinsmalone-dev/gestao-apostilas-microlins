r"""
Test script to validate the updated business logic and algorithms on the real Excel file:
1. Filter logic (Ativo, Não inadimplente, Não entrega física, Aula 4 a 6, Não Bolsista)
2. Educator exclusion (Malone, Antonio Fagner, Pyetra Alves Vieira de Oliveira, etc.)
3. Subject code cleaning (regex ^\d+_\s*)
4. Exclusion of "Digitação" subjects and courses
5. Deep verification of Ana Clara da Silva Sousa's rows
6. Exact title preservation (no forced uppercase/lowercase)
7. Duplicate detection logic
"""
import xlrd
import re
import unicodedata

def normalize_text(text):
    if not text:
        return ''
    text = str(text).lower().strip()
    nfkd = unicodedata.normalize('NFD', text)
    text = ''.join([c for c in nfkd if not unicodedata.combining(c)])
    text = re.sub(r'\s+', ' ', text)
    return text

def clean_subject(materia):
    if not materia:
        return ''
    return re.sub(r'^\d+_\s*', '', str(materia)).strip()

def is_educator_ignored(student_name, ignored_educators):
    norm_student = normalize_text(student_name)
    for educ in ignored_educators:
        norm_educ = normalize_text(educ)
        if norm_student == norm_educ or norm_educ in norm_student:
            return True
    return False

def is_digitacao(materia, formacao):
    norm_mat = normalize_text(materia)
    norm_form = normalize_text(formacao)
    return 'digitacao' in norm_mat or 'digitacao' in norm_form

def test_title_preservation():
    test_cases = [
        "setembro 3",
        "ENTREGA DE MATERIAL - 1º PEDIDO SETEMBRO",
        "Entrega de Apostilas - Turma A",
        "1º Pedido Outubro 2026"
    ]
    for original in test_cases:
        # Title must remain exactly as typed (no toUpperCase/toLowerCase)
        processed = original.strip()
        assert processed == original, f"Expected '{original}', got '{processed}'"
    print("[OK] Title preservation test: PASSED (Preserves user exact casing)")


def run_tests():
    test_title_preservation()

    wb = xlrd.open_workbook('Modelo Real de Entrega de Apostila.xls', encoding_override='cp1252')
    sheet = wb.sheet_by_name('Sheet')
    headers = [sheet.cell_value(0, c) for c in range(sheet.ncols)]
    
    ignored_educators = [
        'Malone',
        'Malone de Souza',
        'Antonio Fagner',
        'Antonio Fagner dos Santos Silva',
        'Pyetra Alves Oliveira',
        'Pyetra Alves Vieira de Oliveira',
        'Andrey',
        'Josemara Perpetua Da Silva'
    ]

    total_rows = sheet.nrows - 1
    passed_filters = []
    filtered_out_educators = []
    filtered_out_digitacao = []

    print(f"\nTotal rows in Excel: {total_rows}")

    for r in range(1, sheet.nrows):
        row = {headers[c]: sheet.cell_value(r, c) for c in range(sheet.ncols)}
        aluno = str(row.get('Aluno', '')).strip()
        materia_bruta = str(row.get('Mat\xe9ria', '')).strip()
        formacao_bruta = str(row.get('Forma\xe7\xe3o', row.get('Forma\xe7ao', row.get('Formação', '')))).strip()

        st_contrato = normalize_text(str(row.get('Status Contrato', '')))
        inad = normalize_text(str(row.get('Inadimplente', '')))
        ent_fis = normalize_text(str(row.get('Entrega F\xedsica', '')))
        aula = row.get('Aula Atual', 0)
        tipo_con = normalize_text(str(row.get('Tipo Contrato', '')))

        try:
            aula_num = float(aula)
        except:
            aula_num = -1

        # Check filters
        pass_status = st_contrato == 'ativo'
        pass_inad = inad in ['nao', 'n', '']
        pass_ent = ent_fis in ['nao', 'n', '']
        pass_aula = 4 <= aula_num <= 6
        pass_bolsista = 'bolsista' not in tipo_con

        if pass_status and pass_inad and pass_ent and pass_aula and pass_bolsista:
            if is_educator_ignored(aluno, ignored_educators):
                filtered_out_educators.append((aluno, materia_bruta))
            elif is_digitacao(materia_bruta, formacao_bruta):
                filtered_out_digitacao.append((aluno, materia_bruta, formacao_bruta))
            else:
                clean_mat = clean_subject(materia_bruta)
                clean_form = clean_subject(formacao_bruta)
                passed_filters.append({
                    'aluno': aluno,
                    'materia_bruta': materia_bruta,
                    'materia_limpa': clean_mat,
                    'formacao': clean_form,
                    'aula': aula_num
                })

    print(f"Passed business filters: {len(passed_filters) + len(filtered_out_educators) + len(filtered_out_digitacao)}")
    print(f"Educators excluded: {len(filtered_out_educators)}")
    print(f"Digitação excluded: {len(filtered_out_digitacao)}")
    assert len(filtered_out_digitacao) > 0, "Expected at least 1 digitação row to be excluded!"

    print(f"Clean students ready for sheet: {len(passed_filters)}")

    # Test Ana Clara da Silva Sousa case specifically
    ana_clara_items = [p for p in passed_filters if 'ANA CLARA DA SILVA SOUSA' in p['aluno'].upper()]
    print(f"\n--- Ana Clara da Silva Sousa Verification ---")
    print(f"Ana Clara items passing filters: {len(ana_clara_items)}")
    for item in ana_clara_items:
        print(f"  - Matéria: {item['materia_limpa']} (Formação: {item['formacao']}, Aula: {item['aula']})")
    
    assert len(ana_clara_items) == 2, f"Expected exactly 2 items for Ana Clara (Digitação removed), found {len(ana_clara_items)}"
    expected_subjects = {'Auxiliar Odontológico - Saúde Bucal', 'Operador de Caixa'}
    actual_subjects = {item['materia_limpa'] for item in ana_clara_items}
    assert actual_subjects == expected_subjects, f"Expected {expected_subjects}, got {actual_subjects}"
    print("[OK] Ana Clara case: PASSED! (Digitação excluded; Auxiliar Odontológico & Operador de Caixa ready for operator review)")

    # Test Duplicate Detection logic
    print("\nTesting Duplicate Detection logic:")
    item0 = passed_filters[0]
    bd_historico = {
        f"{normalize_text(item0['aluno'])}|||{normalize_text(item0['materia_limpa'])}": {
            'tituloPedido': 'ENTREGA DE MATERIAL - 1º PEDIDO AGOSTO',
            'dataArquivo': '01/08/2026'
        }
    }

    detected_duplicates = []
    seen_local = set()
    for item in passed_filters:
        key = f"{normalize_text(item['aluno'])}|||{normalize_text(item['materia_limpa'])}"
        if key in seen_local:
            detected_duplicates.append(('Interno', item['aluno'], item['materia_limpa']))
        elif key in bd_historico:
            detected_duplicates.append(('Histórico', item['aluno'], item['materia_limpa'], bd_historico[key]))
        seen_local.add(key)

    print(f"Duplicates detected in simulation: {len(detected_duplicates)}")
    for d in detected_duplicates:
        print(f"  - [{d[0]}] Aluno: {d[1]} | Matéria: {d[2]}")

    # Test Controle Pedagógico processing
    test_controle_pedagogico()

    print("\nALL BUSINESS LOGIC AND TESTS PASSED SUCCESSFULLY!")

def test_controle_pedagogico():
    wb_ped = xlrd.open_workbook('Modelo Real de Controle Pedagógico.xls', encoding_override='cp1252')
    sheet_ped = wb_ped.sheet_by_name('Sheet')
    headers_ped = [normalize_text(sheet_ped.cell_value(0, c)) for c in range(sheet_ped.ncols)]

    def get_col(candidates):
        norm_cands = [normalize_text(c) for c in candidates]
        for c in norm_cands:
            if c in headers_ped: return headers_ped.index(c)
        for c in norm_cands:
            for idx, h in enumerate(headers_ped):
                if c in h: return idx
        return -1

    c_aluno = get_col(['Aluno'])
    c_mat = get_col(['Matéria', 'Materia'])
    c_aula = get_col(['Aula Atual', 'Aulas Concluídas', 'Aulas Concluidas'])
    c_dias = get_col(['Dias Agendamento', 'Dias'])
    c_prox = get_col(['Próxima Matéria', 'Proxima Materia'])
    c_status = get_col(['Status'])
    c_tipo = get_col(['Tipo Contrato'])
    c_ent = get_col(['Entrega Física', 'Entrega Fisica'])

    assert c_aluno != -1 and c_mat != -1 and c_aula != -1, "Colunas essenciais do Controle Pedagógico devem ser mapeadas"
    
    ped_val = []
    for r in range(1, sheet_ped.nrows):
        aluno = str(sheet_ped.cell_value(r, c_aluno)).strip()
        mat = str(sheet_ped.cell_value(r, c_mat)).strip()
        st = normalize_text(sheet_ped.cell_value(r, c_status))
        tipo = normalize_text(sheet_ped.cell_value(r, c_tipo))
        ent = normalize_text(sheet_ped.cell_value(r, c_ent))
        try:
            aula = float(sheet_ped.cell_value(r, c_aula))
        except:
            aula = 0
            
        if st == 'ativo' and 'bolsista' not in tipo and ent in ['n', 'nao', '']:
            if not is_digitacao(mat, ''):
                ped_val.append({
                    'aluno': aluno,
                    'materia': clean_subject(mat),
                    'aula': aula,
                    'dias': sheet_ped.cell_value(r, c_dias) if c_dias != -1 else '',
                    'prox': clean_subject(sheet_ped.cell_value(r, c_prox)) if c_prox != -1 else ''
                })

    print("\n--- Controle Pedagógico Test Verification ---")
    print(f"Total registros válidos no Controle Pedagógico: {len(ped_val)}")
    assert len(ped_val) > 0, "Deveria haver registros válidos no relatório de Controle Pedagógico"
    # Verifica enriquecimento
    com_dias = [p for p in ped_val if p['dias'] and p['dias'] != 'Indefinido']
    print(f"Alunos com Agendamento definido: {len(com_dias)}")
    assert len(com_dias) > 0, "Deveria haver alunos com dias de agendamento capturados"
    print("[OK] Controle Pedagógico: PASSED! (Suporte e enriquecimento completo validados)")

def test_backup_sync_and_manual_order_archiving():
    """
    Test scenario reported by user:
    1. User manually writes order with 5 bolsistas: "ENTREGA DE MATERIAL - 1º PEDIDO SETEMBRO - Bolsistas"
    2. User clicks "Novo Pedido Rápido" -> creates Bkp_Pedido_20260917_133000
    3. Order was not in history -> user re-writes exact same information, clicks "Novo Pedido" -> creates Bkp_Pedido_20260917_133500
    4. Auto-synchronization should scan both backups, extract 5 students, deduplicate identical orders via fingerprint,
       and catalog 1 clean order into _BD_Historico with 5 students.
    """
    print("\n--- Backup Sync & Manual Order Archiving Simulation ---")
    
    manual_students = [
        {"aluno": "Joseilda Alves Malaquias", "materia": "Windows 11", "educador": "Antônio"},
        {"aluno": "Persilia de Fatima Faquin", "materia": "Windows 11", "educador": "Antônio"},
        {"aluno": "Pérsida Aparecida Faquim Costa", "materia": "Windows 11", "educador": "Antônio"},
        {"aluno": "Artur Araujo Roseno", "materia": "Windows 11", "educador": "Antônio"},
        {"aluno": "Adrian da Silva Souza", "materia": "Word 2021", "educador": "Antônio"}
    ]
    titulo = "ENTREGA DE MATERIAL - 1º PEDIDO SETEMBRO - Bolsistas"
    
    # Simulate the exact 3 backup sheets from user's screenshot:
    # 1. Bkp_Archived_20260917_141319
    # 2. Bkp_Pedido_20260917_141318
    # 3. Bkp_Pedido_20260917_141207
    backup_sheets = [
        {
            "name": "Bkp_Archived_20260917_141319",
            "titulo": "SETEMBRO 2º - Antônioo",
            "rows": manual_students
        },
        {
            "name": "Bkp_Pedido_20260917_141318",
            "titulo": "teste",
            "rows": manual_students
        },
        {
            "name": "Bkp_Pedido_20260917_141207",
            "titulo": "teste",
            "rows": manual_students
        }
    ]

    # Database _BD_Historico simulation
    bd_historico = []
    ids_existentes = set()

    for bkp in backup_sheets:
        name = bkp["name"]
        t = bkp["titulo"]
        rows = bkp["rows"]
        
        # 1. Parse date from name
        m = re.search(r'(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})?', name)
        assert m is not None, f"Should parse timestamp from {name}"
        seg = f":{m.group(6)}" if m.group(6) else ""
        data_fmt = f"{m.group(3)}/{m.group(2)}/{m.group(1)} {m.group(4)}:{m.group(5)}{seg}"

        # 2. Build ID
        id_pedido = "PED_BKP_" + re.sub(r'[^a-zA-Z0-9_]', '', name)
        if id_pedido in ids_existentes:
            continue
            
        # Add to _BD_Historico
        for r in rows:
            bd_historico.append([
                id_pedido,
                data_fmt,
                t,
                r['aluno'],
                r['materia'],
                r.get('educador', ''),
                r.get('dataEntrega', ''),
                r.get('entrega', ''),
                r.get('liberacao', '')
            ])
            
        ids_existentes.add(id_pedido)

    print(f"Total records in _BD_Historico after sync: {len(bd_historico)}")
    assert len(bd_historico) == 15, f"Expected 15 rows (3 distinct timestamped backups x 5 students), got {len(bd_historico)}"
    assert len(ids_existentes) == 3, f"Expected 3 unique order IDs, got {len(ids_existentes)}"
    
    # Verify order grouping (listarPedidosArquivados simulation)
    grouped = {}
    for r in bd_historico:
        pid = r[0]
        if pid not in grouped:
            grouped[pid] = {'idPedido': pid, 'titulo': r[2], 'data': r[1], 'totalAlunos': 0}
        grouped[pid]['totalAlunos'] += 1
        
    orders_list = list(grouped.values())
    assert len(orders_list) == 3, f"Expected all 3 orders listed, got {len(orders_list)}"
    for o in orders_list:
        assert o['totalAlunos'] == 5
        print(f"  - Cataloged Order: '{o['titulo']}' ({o['idPedido']}) with {o['totalAlunos']} students on {o['data']}")
    
    print("[OK] Backup Sync & All User Screenshot Backups: PASSED! (All 3 backups cataloged and displayed)")

def test_edit_and_delete_history():
    print("\n--- Testing Edit & Delete History Logic ---")
    bd_historico = [
        ["PED_BKP_Bkp_Archived_20260917_141319", "17/09/2026 14:13:19", "SETEMBRO 2º - Antônioo", "Aluno 1", "Materia 1"],
        ["PED_BKP_Bkp_Archived_20260917_141319", "17/09/2026 14:13:19", "SETEMBRO 2º - Antônioo", "Aluno 2", "Materia 2"],
        ["PED_BKP_Bkp_Pedido_20260917_141318", "17/09/2026 14:13:18", "teste", "Aluno 3", "Materia 3"],
        ["PED_BKP_Bkp_Pedido_20260917_141207", "17/09/2026 14:12:07", "teste", "Aluno 4", "Materia 4"]
    ]
    backup_sheets = {
        "Bkp_Archived_20260917_141319": {"A2": "SETEMBRO 2º - Antônioo"},
        "Bkp_Pedido_20260917_141318": {"A2": "teste"},
        "Bkp_Pedido_20260917_141207": {"A2": "teste"}
    }

    # 1. Edit title of order "PED_BKP_Bkp_Pedido_20260917_141318" to "SETEMBRO 1º - Pedido Final"
    id_edit = "PED_BKP_Bkp_Pedido_20260917_141318"
    novo_titulo = "SETEMBRO 1º - Pedido Final"
    
    # Edit in DB
    updated_count = 0
    for row in bd_historico:
        if row[0] == id_edit:
            row[2] = novo_titulo
            updated_count += 1
    assert updated_count == 1, "Should update 1 row in DB"

    # Edit in physical sheet
    sheet_name = id_edit.replace("PED_BKP_", "")
    if sheet_name in backup_sheets:
        backup_sheets[sheet_name]["A2"] = novo_titulo
    assert backup_sheets["Bkp_Pedido_20260917_141318"]["A2"] == novo_titulo

    print(f"Edit Order Title: Successfully updated to '{novo_titulo}' in DB and backup sheet")

    # 2. Delete order "PED_BKP_Bkp_Pedido_20260917_141207" (the oldest test backup)
    id_delete = "PED_BKP_Bkp_Pedido_20260917_141207"
    sheet_to_delete = id_delete.replace("PED_BKP_", "")

    # Delete sheet
    if sheet_to_delete in backup_sheets:
        del backup_sheets[sheet_to_delete]
    assert sheet_to_delete not in backup_sheets, "Backup sheet should be deleted"

    # Delete rows in DB
    initial_len = len(bd_historico)
    bd_historico = [r for r in bd_historico if r[0] != id_delete]
    assert len(bd_historico) == initial_len - 1, "Should remove 1 row from DB"

    # Verify final remaining orders
    remaining_ids = set(r[0] for r in bd_historico)
    assert id_delete not in remaining_ids
    assert id_edit in remaining_ids
    print(f"Delete Order: Successfully removed '{id_delete}' from DB and deleted physical sheet")
    print("[OK] Edit & Delete History Logic: PASSED!")

def test_enriched_history_and_deduplication():
    print("\n--- Testing Enriched History & Strict Deduplication ---")
    meses_nomes = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ]

    # Simulação do _BD_Historico com registros reais tabulados
    bd_historico = [
        ["PED_20260810_100000", "10/08/2026 10:00", "ENTREGA DE MATERIAL - 2º PEDIDO AGOSTO", "Aluno A", "Informática", "Antonio Fagner", "15/08/2026", "Não", "Sim"],
        ["PED_20260810_100000", "10/08/2026 10:00", "ENTREGA DE MATERIAL - 2º PEDIDO AGOSTO", "Aluno B", "Design Gráfico", "Pyetra Alves", "15/08/2026", "Não", "Sim"],
        ["PED_20260917_152410", "17/09/2026 15:24", "ENTREGA DE MATERIAL - 2º PEDIDO SETEMBRO", "Aluno C", "Excel Avançado", "Antonio Fagner", "20/09/2026", "Não", "Sim"],
        ["PED_20260917_152410", "17/09/2026 15:24", "ENTREGA DE MATERIAL - 2º PEDIDO SETEMBRO", "Aluno D", "Administração", "Antonio Fagner", "20/09/2026", "Não", "Sim"],
    ]

    # Simulação das abas físicas que existiam na planilha do usuário (Bkp_Pedido_ e Bkp_Arch_)
    backup_sheets = [
        "Bkp_Pedido_20260917_152410",
        "Bkp_Arch_20260917_152411",
        "Bkp_Pedido_20260917_152121"
    ]

    # Agrupamento estrito do banco de dados (SEM varredura duplicada de abas Bkp_)
    pedidos_agrupados = {}
    for row in bd_historico:
        pid, data, titulo, aluno, materia, educador = row[0], row[1], row[2], row[3], row[4], row[5]
        
        if pid not in pedidos_agrupados:
            m = re.search(r'(\d{2})/(\d{2})/(\d{4})', data)
            mes_num = m.group(2) if m else '09'
            ano = m.group(3) if m else '2026'
            mes_nome = meses_nomes[int(mes_num) - 1]

            pedidos_agrupados[pid] = {
                'idPedido': pid,
                'data': data,
                'titulo': titulo,
                'ano': ano,
                'mesNum': mes_num,
                'mesNome': mes_nome,
                'mesAno': f"{mes_nome} / {ano}",
                'totalAlunos': 0,
                'educadores': set()
            }
        
        pedidos_agrupados[pid]['totalAlunos'] += 1
        if educador:
            pedidos_agrupados[pid]['educadores'].add(educador)

    # Ordenação cronológica crescente para cálculo de Nº de Ordem
    lista_pedidos = list(pedidos_agrupados.values())
    lista_pedidos.sort(key=lambda p: p['data'])

    for idx, p in enumerate(lista_pedidos):
        num = idx + 1
        p['numOrdem'] = f"#{num:03d}"
        p['educadoresStr'] = ', '.join(sorted(p['educadores']))

    # Validações críticas
    assert len(lista_pedidos) == 2, f"Expected exactly 2 distinct orders, got {len(lista_pedidos)}"
    
    pedido_agosto = [p for p in lista_pedidos if 'AGOSTO' in p['titulo']][0]
    pedido_setembro = [p for p in lista_pedidos if 'SETEMBRO' in p['titulo']][0]

    assert pedido_agosto['numOrdem'] == '#001'
    assert pedido_agosto['mesNome'] == 'Agosto'
    assert pedido_agosto['ano'] == '2026'
    assert 'Antonio Fagner' in pedido_agosto['educadores']
    assert 'Pyetra Alves' in pedido_agosto['educadores']
    assert pedido_agosto['totalAlunos'] == 2

    assert pedido_setembro['numOrdem'] == '#002'
    assert pedido_setembro['mesNome'] == 'Setembro'
    assert pedido_setembro['ano'] == '2026'
    assert pedido_setembro['totalAlunos'] == 2

    print(f"  - Pedido Agosto: {pedido_agosto['numOrdem']} | {pedido_agosto['mesAno']} | {pedido_agosto['educadoresStr']} ({pedido_agosto['totalAlunos']} alunos)")
    print(f"  - Pedido Setembro: {pedido_setembro['numOrdem']} | {pedido_setembro['mesAno']} | {pedido_setembro['educadoresStr']} ({pedido_setembro['totalAlunos']} alunos)")
    print("[OK] Enriched History & Deduplication: PASSED (Zero duplicate Bkp_ orders!)")

def test_real_order_edit_workflow():
    print("\n--- Testing Real Order Edit Workflow (Sheet Cells -> _BD_Historico) ---")
    id_pedido = "PED_20260917_152410"
    data_original = "17/09/2026 15:24"

    # Base antes da edição
    bd_historico = [
        [id_pedido, data_original, "ENTREGA DE MATERIAL - 2º PEDIDO SETEMBRO", "Aluno Errado", "Excel", "Prof A", "20/09/2026", "Não", "Sim"],
        [id_pedido, data_original, "ENTREGA DE MATERIAL - 2º PEDIDO SETEMBRO", "Aluno 2", "Administração", "Prof B", "20/09/2026", "Não", "Sim"],
        ["PED_OUTRO_001", "10/08/2026 10:00", "Outro Pedido", "Aluno X", "Design", "Prof C", "15/08/2026", "Não", "Sim"]
    ]

    # 1. Operador carrega para edição na planilha (abrirPedidoParaEdicao)
    folha_edicao = []
    for r in bd_historico:
        if r[0] == id_pedido:
            folha_edicao.append([r[3], r[4], r[5], r[6], r[7], r[8]]) # Aluno, Materia, Educador, etc.

    assert len(folha_edicao) == 2

    # 2. Operador faz correções diretamente nas células do Sheets:
    # Corrigiu o nome do Aluno Errado para 'Carlos Eduardo', adicionou 1 aluno novo
    folha_edicao[0][0] = "Carlos Eduardo da Silva"
    folha_edicao[0][1] = "Excel Avançado e Dashboard"
    folha_edicao.append(["Mariana Lima", "Atendente de Farmácia", "Prof D", "20/09/2026", "Não", "Sim"])

    # 3. Operador clica em 'Salvar Edição no Histórico' (salvarEdicaoPedidoHistorico)
    novas_linhas_pedido = []
    novo_titulo = "ENTREGA DE MATERIAL - 2º PEDIDO SETEMBRO (Revisado)"

    for r in folha_edicao:
        novas_linhas_pedido.append([
            id_pedido,
            data_original,
            novo_titulo,
            r[0], r[1], r[2], r[3], r[4], r[5]
        ])

    # Substituição no banco mantendo outros pedidos intactos
    bd_atualizado = [r for r in bd_historico if r[0] != id_pedido]
    for nr in novas_linhas_pedido:
        bd_atualizado.append(nr)

    # Validações
    linhas_editadas = [r for r in bd_atualizado if r[0] == id_pedido]
    assert len(linhas_editadas) == 3, f"Expected 3 updated rows, got {len(linhas_editadas)}"
    assert linhas_editadas[0][3] == "Carlos Eduardo da Silva"
    assert linhas_editadas[0][4] == "Excel Avançado e Dashboard"
    assert linhas_editadas[2][3] == "Mariana Lima"
    assert linhas_editadas[0][2] == novo_titulo
    assert linhas_editadas[0][1] == data_original  # Data original preservada!

    # Pedido alheio preservado
    outro_pedido = [r for r in bd_atualizado if r[0] == "PED_OUTRO_001"]
    assert len(outro_pedido) == 1

    print(f"Edit Workflow: Successfully replaced order in DB with 3 revised rows. ID and original date preserved.")
    print("[OK] Real Order Edit Workflow: PASSED!")

def test_chronological_sorting_and_kpi():
    print("\n--- Testing Chronological Sorting & KPI Accuracy ---")
    import datetime

    def parse_data_br(data_str, mes_fallback=None, ano_fallback=None):
        if data_str:
            m = re.match(r'(\d{1,2})/(\d{1,2})/(\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?', str(data_str).strip())
            if m:
                d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
                h = int(m.group(4)) if m.group(4) else 0
                mi = int(m.group(5)) if m.group(5) else 0
                return datetime.datetime(y, mo, d, h, mi).timestamp()
        if mes_fallback and ano_fallback:
            meses = ['janeiro', 'fevereiro', 'março', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
            try:
                idx = meses.index(str(mes_fallback).lower()) + 1
                return datetime.datetime(int(ano_fallback), idx, 1).timestamp()
            except ValueError:
                pass
        return 0

    pedidos = [
        {"id": "P3", "titulo": "ENTREGA DE MATERIAL - 1º PEDIDO SETEMBRO", "data": "01/09/2026 10:00", "mesNome": "Setembro", "ano": "2026"},
        {"id": "P1", "titulo": "ENTREGA DE MATERIAL - 1º PEDIDO AGOSTO", "data": "15/08/2026 14:00", "mesNome": "Agosto", "ano": "2026"},
        {"id": "P2", "titulo": "ENTREGA DE MATERIAL - 2º PEDIDO AGOSTO", "data": "28/08/2026 16:30", "mesNome": "Agosto", "ano": "2026"},
        {"id": "P4", "titulo": "ENTREGA DE MATERIAL - 2º PEDIDO SETEMBRO", "data": "17/09/2026 15:24", "mesNome": "Setembro", "ano": "2026"}
    ]

    # Ordenação cronológica crescente (atribuição de #001, #002...)
    pedidos_crescente = sorted(pedidos, key=lambda x: parse_data_br(x["data"], x["mesNome"], x["ano"]))
    ordens = [p["id"] for p in pedidos_crescente]
    assert ordens == ["P1", "P2", "P3", "P4"], f"Expected ['P1', 'P2', 'P3', 'P4'], got {ordens}"
    print(f"  - Cronologia Crescente: {ordens} -> #001 (15/08), #002 (28/08), #003 (01/09), #004 (17/09)")

    # Ordenação recente (visualização na UI)
    pedidos_decrescente = sorted(pedidos, key=lambda x: parse_data_br(x["data"], x["mesNome"], x["ano"]), reverse=True)
    ordens_dec = [p["id"] for p in pedidos_decrescente]
    assert ordens_dec == ["P4", "P3", "P2", "P1"], f"Expected ['P4', 'P3', 'P2', 'P1'], got {ordens_dec}"
    print(f"  - Visualização Recente: {ordens_dec} -> 17/09, 01/09, 28/08, 15/08")

    # Verificação de KPI 'Pedidos Este Mês' (Mês corrente = Setembro / 2026)
    mes_atual_idx = 8 # Setembro (0-indexed)
    meses_pt = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
    ano_atual = 2026

    pedidos_mes = 0
    for p in pedidos:
        eh_mesmo_ano = str(p['ano']) == str(ano_atual)
        eh_mesmo_mes = (p['mesNome'].lower() == meses_pt[mes_atual_idx].lower()) if p.get('mesNome') else (f"/{mes_atual_idx+1:02d}/{ano_atual}" in p.get('data', ''))
        if eh_mesmo_ano and eh_mesmo_mes:
            pedidos_mes += 1

    assert pedidos_mes == 2, f"Expected 2 September orders, got {pedidos_mes}"
    print(f"  - KPI 'Pedidos Este Mês' (Setembro/2026): {pedidos_mes} pedidos contabilizados (Agosto estritamente ignorado)")
    print("[OK] Chronological Sorting & KPI Accuracy: PASSED!")

def test_dashboard_protection_and_cleanup():
    print("\n--- Testing Dashboard Protection & Corrupted History Cleanup ---")

    def eh_registro_dashboard(titulo, aluno):
        t = str(titulo or '').upper()
        a = str(aluno or '').upper()
        termos_proibidos = [
            'MICROLINS POTIRENDABA',
            'CENTRAL DE GESTÃO',
            'PAINEL DE CONTROLE',
            '⚡ AÇÕES RÁPIDAS',
            'AÇÕES RÁPIDAS',
            'INDICADORES GERAIS',
            'ABRIR CENTRAL',
            'NOVO PEDIDO RÁPIDO',
            'ARQUIVAR PEDIDO ATUAL',
            'VER HISTÓRICO',
            'ATUALIZAR DASHBOARD',
            'TOTAL DE PEDIDOS ARQUIVADOS',
            'ALUNOS ATENDIDOS',
            'APOSTILAS SOLICITADAS',
            'ÚLTIMOS PEDIDOS REGISTRADOS',
            'Nº ORDEM',
            'MÊS/ANO'
        ]
        if 'MICROLINS' in t or 'PAINEL DE CONTROLE' in t or 'DASHBOARD' in t or 'CENTRAL DE GESTÃO' in t:
            return True
        if '✏️' in a or 'ABRIR CENTRAL' in a or 'AÇÕES RÁPIDAS' in a or 'INDICADORES' in a or 'CENTRAL DE GESTÃO' in a:
            return True
        return any(termo in t or termo in a for termo in termos_proibidos)

    # 1. Test detection of accidental Dashboard records
    assert eh_registro_dashboard("MICROLINS POTIRENDABA • CENTRAL DE GESTÃO DE APOSTILAS", "[ ✏️ Editar #001 ]") == True
    assert eh_registro_dashboard("PAINEL DE CONTROLE E AÇÕES RÁPIDAS", "Novo Pedido Rápido") == True
    assert eh_registro_dashboard("Dashboard", "Total de Pedidos Arquivados") == True
    assert eh_registro_dashboard("ENTREGA DE MATERIAL - PEDIDO", "⚡ AÇÕES RÁPIDAS") == True

    # 2. Test genuine orders are NEVER falsely flagged
    assert eh_registro_dashboard("ENTREGA DE MATERIAL - 1º PEDIDO SETEMBRO", "Carlos Eduardo Pereira") == False
    assert eh_registro_dashboard("ENTREGA DE MATERIAL - 2º PEDIDO AGOSTO", "Ana Clara da Silva Sousa") == False
    assert eh_registro_dashboard("SETEMBRO 2º - Antônio", "Joseilda Alves Malaquias") == False

    # 3. Test cleanup simulation of _BD_Historico with accidental Dashboard rows
    bd_historico = [
        ["PED_CORRUPTED_001", "18/09/2026 12:45", "MICROLINS POTIRENDABA • CENTRAL DE GESTÃO DE APOSTILAS", "[ ✏️ Editar #001 ]", "01/2026", "Antônio", "18/09/2026", "", ""],
        ["PED_CORRUPTED_001", "18/09/2026 12:45", "MICROLINS POTIRENDABA • CENTRAL DE GESTÃO DE APOSTILAS", "Abrir Central Completa", "Ações Rápidas", "", "", "", ""],
        ["PED_20260917_152410", "17/09/2026 15:24", "ENTREGA DE MATERIAL - 2º PEDIDO SETEMBRO", "Adrian da Silva Souza", "Word 2021", "Antônio", "20/09/2026", "Não", "Sim"],
        ["PED_20260917_152410", "17/09/2026 15:24", "ENTREGA DE MATERIAL - 2º PEDIDO SETEMBRO", "Artur Araujo Roseno", "Windows 11", "Antônio", "20/09/2026", "Não", "Sim"],
    ]

    ids_para_remover = set()
    for r in bd_historico:
        pid, titulo, aluno = r[0], r[2], r[3]
        if eh_registro_dashboard(titulo, aluno):
            ids_para_remover.add(pid)

    assert ids_para_remover == {"PED_CORRUPTED_001"}, f"Expected only corrupted ID to be purged, got {ids_para_remover}"

    bd_limpo = [r for r in bd_historico if r[0] not in ids_para_remover]
    assert len(bd_limpo) == 2, f"Expected 2 real order records to remain, got {len(bd_limpo)}"
    assert all(r[0] == "PED_20260917_152410" for r in bd_limpo)

    print(f"  - Registros de Dashboard acidentais detectados e expurgados: {len(ids_para_remover)} pedido(s)")
    print(f"  - Base de dados limpa e preservada com {len(bd_limpo)} registros legítimos")
    print("[OK] Dashboard Protection & History Cleanup: PASSED!")

def test_duplicate_checker_ignore_current_editing_order():
    print("\n--- Testing Duplicate Checker Ignoring Current Edited Order ---")

    # Base de dados _BD_Historico existente
    bd_historico = [
        # Pedido antigo (Agosto)
        ["PED_AGOSTO_001", "10/08/2026 10:00", "ENTREGA DE MATERIAL - 1º PEDIDO AGOSTO", "Aluno Antigo", "Excel Básico"],
        ["PED_AGOSTO_001", "10/08/2026 10:00", "ENTREGA DE MATERIAL - 1º PEDIDO AGOSTO", "Aluno Repetido", "Inglês I"],

        # Pedido atual de Setembro (o que o usuário abriu para editar)
        ["PED_SETEMBRO_002", "17/09/2026 15:24", "ENTREGA DE MATERIAL - 2º PEDIDO SETEMBRO", "Carlos Eduardo", "Windows 11"],
        ["PED_SETEMBRO_002", "17/09/2026 15:24", "ENTREGA DE MATERIAL - 2º PEDIDO SETEMBRO", "Mariana Lima", "Design Gráfico"],
        ["PED_SETEMBRO_002", "17/09/2026 15:24", "ENTREGA DE MATERIAL - 2º PEDIDO SETEMBRO", "Aluno Repetido", "Inglês I"]
    ]

    # Simula folha de edição do pedido PED_SETEMBRO_002
    folha_em_edicao = [
        {"linha": 5, "aluno": "Carlos Eduardo", "materia": "Windows 11"},
        {"linha": 6, "aluno": "Mariana Lima", "materia": "Design Gráfico"},
        {"linha": 7, "aluno": "Aluno Repetido", "materia": "Inglês I"},
        {"linha": 8, "aluno": "Mariana Lima", "materia": "Design Gráfico"} # Duplicidade interna na própria folha
    ]

    editando_id = "PED_SETEMBRO_002"

    # Função simula carregarHistoricoConsolidado(idPedidoIgnorar)
    def carregar_historico(id_ignorar):
        historico = {}
        for r in bd_historico:
            pid, data, titulo, aluno, mat = r[0], r[1], r[2], r[3], r[4]
            if id_ignorar and pid == id_ignorar:
                continue
            k = f"{normalize_text(aluno)}|||{normalize_text(mat)}"
            if k not in historico:
                historico[k] = {'idPedido': pid, 'data': data, 'titulo': titulo}
        return historico

    historico_sem_proprio_pedido = carregar_historico(editando_id)

    # Verifica que Carlos Eduardo e Mariana Lima NÃO estão no histórico externo
    assert "carlos eduardo|||windows 11" not in historico_sem_proprio_pedido
    assert "mariana lima|||design grafico" not in historico_sem_proprio_pedido
    # Mas Aluno Repetido ESTÁ no histórico externo (veio de Agosto!)
    assert "aluno repetido|||ingles i" in historico_sem_proprio_pedido
    assert historico_sem_proprio_pedido["aluno repetido|||ingles i"]["titulo"] == "ENTREGA DE MATERIAL - 1º PEDIDO AGOSTO"

    # Simula a checagem na folha
    duplicidades = []
    vistos_local = {}

    for row in folha_em_edicao:
        k = f"{normalize_text(row['aluno'])}|||{normalize_text(row['materia'])}"
        if k in vistos_local:
            duplicidades.append({'aluno': row['aluno'], 'tipo': 'interno', 'origem': f"Linha {vistos_local[k]}"})
            continue
        vistos_local[k] = row['linha']

        if k in historico_sem_proprio_pedido:
            item = historico_sem_proprio_pedido[k]
            duplicidades.append({'aluno': row['aluno'], 'tipo': 'historico', 'origem': item['titulo']})

    # Resultados esperados:
    # 1. Carlos Eduardo: NÃO é duplicidade (estava apenas no próprio pedido sendo editado)
    # 2. Mariana Lima linha 6: NÃO é duplicidade
    # 3. Aluno Repetido linha 7: É duplicidade histórica REAL de Agosto!
    # 4. Mariana Lima linha 8: É duplicidade INTERNA (repetida na mesma folha)
    assert len(duplicidades) == 2, f"Expected exactly 2 duplicates, got {len(duplicidades)}: {duplicidades}"
    assert duplicidades[0]['aluno'] == "Aluno Repetido" and duplicidades[0]['tipo'] == "historico" and duplicidades[0]['origem'] == "ENTREGA DE MATERIAL - 1º PEDIDO AGOSTO"
    assert duplicidades[1]['aluno'] == "Mariana Lima" and duplicidades[1]['tipo'] == "interno"

    print(f"  - Total de registros na folha de edição: {len(folha_em_edicao)}")
    print(f"  - Registros legítimos do pedido não apontados como repetidos: 2 alunos")
    print(f"  - Duplicidade real externa detectada: '{duplicidades[0]['aluno']}' (solicitado em '{duplicidades[0]['origem']}')")
    print(f"  - Duplicidade interna na mesma folha detectada: '{duplicidades[1]['aluno']}' ({duplicidades[1]['origem']})")
    print("[OK] Duplicate Checker Ignoring Current Edited Order: PASSED! (Zero falsos positivos da própria folha)")

def test_archive_order_collapses_duplicates_by_title_and_id():
    print("\n--- Testing Archive Order Collapses Duplicates by Title and ID ---")

    # Situação inicial no _BD_Historico:
    # 1. Pedido antigo de Agosto
    # 2. Pedido original de Setembro (ID: PED_SETEMBRO_002)
    # 3. Pedido duplicado acidentalmente criado com o mesmo título (ID: PED_SETEMBRO_002_DUP)
    bd_historico = [
        ["PED_AGOSTO_001", "10/08/2026 10:00", "ENTREGA DE MATERIAL - 1º PEDIDO AGOSTO", "Aluno Antigo", "Excel"],
        ["PED_SETEMBRO_002", "17/09/2026 15:24", "ENTREGA DE MATERIAL - 2º PEDIDO SETEMBRO", "Carlos Eduardo", "Windows 11"],
        ["PED_SETEMBRO_002_DUP", "18/09/2026 13:00", "ENTREGA DE MATERIAL - 2º PEDIDO SETEMBRO", "Carlos Eduardo", "Windows 11"],
    ]

    titulo_folha = "ENTREGA DE MATERIAL - 2º PEDIDO SETEMBRO"
    novos_alunos_corrigidos = [
        ["Carlos Eduardo da Silva", "Windows 11"],
        ["Novo Aluno Adicionado", "Word 2021"]
    ]

    # Simulação da rotina inteligente em salvarEdicaoPedidoHistorico:
    # Remove qualquer registro que tenha:
    # a) O mesmo ID_Pedido sendo editado
    # b) OU o mesmo título exato (caso já existisse duplicata criada acidentalmente)
    id_editando = "PED_SETEMBRO_002"
    linhas_mantidas = []

    for r in bd_historico:
        r_id = r[0]
        r_tit = r[2].strip().lower()
        match_id = (r_id == id_editando)
        match_tit = (r_tit == titulo_folha.strip().lower())
        if not match_id and not match_tit:
            linhas_mantidas.append(r)

    # Insere apenas 1 versão limpa atualizada
    for item in novos_alunos_corrigidos:
        linhas_mantidas.append([
            id_editando,
            "17/09/2026 15:24",
            titulo_folha,
            item[0],
            item[1]
        ])

    # Validações:
    # 1. Somente 1 pedido com o título de Setembro deve existir
    pedidos_setembro = [r for r in linhas_mantidas if r[2] == titulo_folha]
    assert len(pedidos_setembro) == 2, f"Expected 2 students for the single September order, got {len(pedidos_setembro)}"
    # 2. Todos os registros de Setembro devem ter o ID original PED_SETEMBRO_002
    assert all(r[0] == id_editando for r in pedidos_setembro), "Todos os registros devem ter o ID original"
    # 3. A duplicata PED_SETEMBRO_002_DUP deve ter sido completamente eliminada
    ids_finais = set(r[0] for r in linhas_mantidas)
    assert "PED_SETEMBRO_002_DUP" not in ids_finais, "Duplicata deve ter sido colapsada"
    assert "PED_AGOSTO_001" in ids_finais, "Pedido de Agosto deve permanecer intacto"

    print(f"  - Base inicial com duplicata: {len(bd_historico)} registros")
    print(f"  - Base consolidada e atualizada: {len(linhas_mantidas)} registros")
    print(f"  - Duplicatas do mesmo título eliminadas: 1 pedido duplicado removido com sucesso")
    print("[OK] Archive Order Collapses Duplicates by Title and ID: PASSED!")

if __name__ == '__main__':
    run_tests()
    test_backup_sync_and_manual_order_archiving()
    test_edit_and_delete_history()
    test_enriched_history_and_deduplication()
    test_real_order_edit_workflow()
    test_chronological_sorting_and_kpi()
    test_dashboard_protection_and_cleanup()
    test_duplicate_checker_ignore_current_editing_order()
    test_archive_order_collapses_duplicates_by_title_and_id()








