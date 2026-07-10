const ARQUIVO_BANCO = 'banco_questoes.json';

// ==========================================
// CONFIGURAÇÕES DO GERADOR (Variáveis X e Y)
// ==========================================


// ==========================================
// FUNÇÕES AUXILIARES (Carregamento e Storage)
// ==========================================

async function carregar_json(nome_arquivo, valor_padrao) {
    try {
        const resposta = await fetch(nome_arquivo);
        if (!resposta.ok) return valor_padrao;
        return await resposta.json();
    } catch (erro) {
        console.warn(`Erro ao carregar ${nome_arquivo}:`, erro);
        return valor_padrao;
    }
}

function obterQuestoesFeitas() {
    const dados = localStorage.getItem('questoes_feitas');
    return dados ? JSON.parse(dados) : {};
}

async function carregarFonte(url) {
    try {
        const resposta = await fetch(url);
        if (!resposta.ok) throw new Error("Fonte não encontrada.");
        const buffer = await resposta.arrayBuffer();
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        return window.btoa(binary);
    } catch (erro) {
        console.error("Erro na fonte:", erro);
        return null;
    }
}

async function carregarTodasFontes() {
    const normal = await carregarFonte('times.ttf');
    const negrito = await carregarFonte('timesbd.ttf');
    return { normal, negrito };
}

function embaralharArray(array) {
    const copia = [...array];
    for (let i = copia.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copia[i], copia[j]] = [copia[j], copia[i]];
    }
    return copia;
}

// ==========================================
// GERAÇÃO DO PDF
// ==========================================

async function salvar_pdf(lista_gerada) {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    
    const fontes = await carregarTodasFontes(); 
    
    if (fontes.normal) {
        pdf.addFileToVFS("times.ttf", fontes.normal);
        pdf.addFont("times.ttf", "TimesCyr", "normal");
    }
    if (fontes.negrito) {
        pdf.addFileToVFS("timesbd.ttf", fontes.negrito);
        pdf.addFont("timesbd.ttf", "TimesCyr", "bold"); 
    }
    
    // --- CABEÇALHO ---
    pdf.setFont("TimesCyr", "bold"); 
    pdf.setFontSize(18);
    pdf.text("Lista de exercícios", 105, 20, { align: "center" });

    pdf.setFontSize(12);
    pdf.text("Aluno(a):", 20, 35);
    pdf.text("Habilitação:", 140, 35);

    const dataHoje = new Date().toLocaleDateString('pt-BR');
    pdf.text(`Simulado de Língua Russa I - ${dataHoje}`, 20, 45);

    // --- CORPO DAS QUESTÕES ---
    let y = 65; 
    const margemEsquerda = 20; 
    const recuoLista = 30; 
    const larguraAreaTexto = 170; 
    const larguraAreaLista = 160; 

    for (const [pergunta, itens] of Object.entries(lista_gerada)) {
        if (y > 275) { pdf.addPage(); y = 20; }
        
        pdf.setFont("TimesCyr", "bold"); 
        const linhasPergunta = pdf.splitTextToSize(pergunta, larguraAreaTexto);
        pdf.text(linhasPergunta, margemEsquerda, y);
        
        y += (linhasPergunta.length * 6) + 4; 

        pdf.setFont("TimesCyr", "normal"); 
        
        itens.forEach((texto, index) => {
            if (y > 275) { pdf.addPage(); y = 20; }
            
            const textoComNumero = `${texto}`;
            const linhasItem = pdf.splitTextToSize(textoComNumero, larguraAreaLista);
            pdf.text(linhasItem, recuoLista, y);
            
            y += (linhasItem.length * 6) + 3;
        });
        
        y += 10; 
    }
    
    pdf.save("Lista_De_Exercicio.pdf");
}

// ==========================================
// LÓGICA DE SORTEIO (Aleatório Multi-Questões com Debug)
// ==========================================

async function gerar_lista() {
    console.log("=== INICIANDO GERAÇÃO DE SIMULADO ===");

    // 1. CAPTURAR OS VALORES DO HTML
    const qtdQuestoesSorteiadas = parseInt(document.getElementById('inputQtdQuestoes').value) || 1;
    const qtdItensPorQuestao = parseInt(document.getElementById('inputQtdItens').value) || 1;
    
    console.log(`[Config] Enunciados solicitados: ${qtdQuestoesSorteiadas}`);
    console.log(`[Config] Alternativas solicitadas por enunciado: ${qtdItensPorQuestao}`);

    const banco = await carregar_json(ARQUIVO_BANCO, {});
    const feitas = obterQuestoesFeitas();
    let questoesComDisponiveis = [];

    console.log("[Storage] Questões já feitas anteriormente:", feitas);

    // PASSO 1: Mapear o que está disponível
    for (const [nomeAssunto, questoes] of Object.entries(banco)) {
        for (const [idQuestao, letras] of Object.entries(questoes)) {
            const letras_feitas = feitas[idQuestao] || [];
            const letras_disponiveis = letras.filter(letra => !letras_feitas.includes(letra));

            if (letras_disponiveis.length > 0) {
                questoesComDisponiveis.push({ 
                    id: idQuestao, 
                    disponiveis: letras_disponiveis 
                });
            }
        }
    }

    console.log(`[Filtro] Questões com alternativas ainda disponíveis:`, questoesComDisponiveis);

    if (questoesComDisponiveis.length === 0) {
        console.warn("[Aviso] O banco de questões inéditas esgotou!");
        alert("Você já resolveu todas as alternativas do banco!");
        return;
    }

    // PASSO 2: Sortear as Questões usando o valor do Input (X)
    questoesComDisponiveis = embaralharArray(questoesComDisponiveis);
    const questoesSelecionadas = questoesComDisponiveis.slice(0, qtdQuestoesSorteiadas);
    
    console.log(`[Sorteio] ${questoesSelecionadas.length} enunciados foram selecionados.`);

    const lista_gerada = {};

    // PASSO 3: Sortear as Alternativas usando o valor do Input (Y)
    for (const questao of questoesSelecionadas) {
        const alternativasEmbaralhadas = embaralharArray(questao.disponiveis);
        const alternativasEscolhidas = alternativasEmbaralhadas.slice(0, qtdItensPorQuestao);
        
        lista_gerada[questao.id] = alternativasEscolhidas;

        if (!feitas[questao.id]) {
            feitas[questao.id] = [];
        }
        feitas[questao.id].push(...alternativasEscolhidas);
    }

    console.log("[Final] Objeto gerado para o PDF:", lista_gerada);
    console.log("[Storage] Novo estado salvo no navegador:", feitas);

    // PASSO 4: Salvar e Gerar
    localStorage.setItem('questoes_feitas', JSON.stringify(feitas));
    await salvar_pdf(lista_gerada);
    
    console.log("=== GERAÇÃO CONCLUÍDA ===");
}

// ==========================================
// RENDERIZAÇÃO DE CHECKBOXES
// ==========================================

async function renderizarCheckboxes() {
    const banco = await carregar_json(ARQUIVO_BANCO, {});
    const container = document.getElementById('containerCheckboxes');
    container.innerHTML = '';

    for (const [nomeAssunto, questoes] of Object.entries(banco)) {
        const divGrupo = document.createElement('div');
        divGrupo.style.marginBottom = "20px";
        divGrupo.style.backgroundColor = "#e0e0e0";
        divGrupo.style.padding = "10px";
        divGrupo.style.borderRadius = "10px";

        const checkMestre = document.createElement('input');
        checkMestre.type = 'checkbox';
        checkMestre.style.marginRight = "10px";
        
        const tituloAssunto = document.createElement('h4');
        tituloAssunto.style.display = "inline";
        tituloAssunto.innerText = nomeAssunto;
        
        divGrupo.appendChild(checkMestre);
        divGrupo.appendChild(tituloAssunto);
        divGrupo.appendChild(document.createElement('br'));

        checkMestre.addEventListener('change', (e) => {
            const filhos = divGrupo.querySelectorAll('.checkbox-questao');
            filhos.forEach(filho => filho.checked = e.target.checked);
        });

        for (const [id, letras] of Object.entries(questoes)) {
            const label = document.createElement('label');
            label.style.display = "block";
            label.innerHTML = `<input type="checkbox" class="checkbox-questao" value='${JSON.stringify({id, conteudo: letras})}'> ${id}`;
            divGrupo.appendChild(label);
        }
        container.appendChild(divGrupo);
    }
}

// ==========================================
// INTERFACE E EVENTOS
// ==========================================

document.getElementById('btnGerar').addEventListener('click', gerar_lista);

document.getElementById('btnResetar').addEventListener('click', () => {
    localStorage.removeItem('questoes_feitas');
    location.reload();
});

document.getElementById('navHome').addEventListener('click', () => {
    document.getElementById('TelaHome').style.display = 'block';
    document.getElementById('TelaQuestoes').style.display = 'none';
});

document.getElementById('navQuestoes').addEventListener('click', async () => {
    document.getElementById('TelaHome').style.display = 'none';
    document.getElementById('TelaQuestoes').style.display = 'block';
    await renderizarCheckboxes(); 
});

document.getElementById('btnGerarManual').addEventListener('click', async () => {
    const selecionados = document.querySelectorAll('.checkbox-questao:checked');
    if (selecionados.length === 0) return alert("Selecione algo!");

    const lista_gerada = {};
    selecionados.forEach(c => {
        const d = JSON.parse(c.value);
        lista_gerada[d.id] = d.conteudo;
    });
    await salvar_pdf(lista_gerada);
});