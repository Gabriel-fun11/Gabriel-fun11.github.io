const ARQUIVO_BANCO = 'banco_caso_prep.json';

// Pega os valores direto das caixas de texto do HTML
const QTD_QUESTOES_PADRAO = parseInt(document.getElementById('inputQtdQuestoes').value) || 5;  // Enunciados
const QTD_ITENS_PADRAO = parseInt(document.getElementById('inputQtdItens').value) || 7;        // Exs por enunciado

// ==========================================
// FUNÇÕES AUXILIARES (Carregamento e Storage)
// ==========================================

async function carregar_json(nome_arquivo, valor_padrao) {
    try {
        const resposta = await fetch(nome_arquivo);
        if (!resposta.ok) return valor_padrao;
        return await resposta.json();
    } catch (erro) {
        console.error(`[DEBUG] Erro ao carregar ${nome_arquivo}:`, erro);
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
        if (!resposta.ok) throw new Error(`Fonte ${url} não encontrada.`);
        const buffer = await resposta.arrayBuffer();
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        return window.btoa(binary);
    } catch (erro) {
        console.warn(`[DEBUG] Aviso: Não foi possível carregar a fonte ${url}.`);
        return null;
    }
}

// Carrega Normal, Negrito e Itálico
async function carregarTodasFontes() {
    const normal = await carregarFonte('times.ttf');
    const negrito = await carregarFonte('timesbd.ttf');
    const italico = await carregarFonte('timesi.ttf'); // Fonte itálica adicionada!
    return { normal, negrito, italico };
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
// FUNÇÃO INTELIGENTE DE TEXTO COM ITÁLICO (*)
// ==========================================
// Essa função quebra o texto onde tem asteriscos e desenha misturando Normal e Itálico no PDF
function desenharTextoComItalico(pdf, texto, x, y, larguraMaxima) {
    // Se não tiver asterisco, imprime normal de uma vez
    if (!texto.includes('*')) {
        const linhas = pdf.splitTextToSize(texto, larguraMaxima);
        pdf.setFont("TimesCyr", "normal");
        pdf.text(linhas, x, y);
        return y + (linhas.length * 6) + 3;
    }

    // Quebra o texto usando o asterisco como marcador
    // Exemplo: "Isso é *muito* legal" vira um array de pedaços
    const pedaços = texto.split('*');
    let linhaAtualX = x;
    let linhaAtualY = y;
    const alturaLinha = 6;

    // Começa com fonte normal
    let eItalico = false;

    for (let i = 0; i < pedaços.length; i++) {
        const pedaço = pedaços[i];
        if (pedaço === "") {
            eItalico = !eItalico; // Alterna o estado do itálico se houver asteriscos duplos/adjacentes
            continue;
        }

        pdf.setFont("TimesCyr", eItalico ? "italic" : "normal");

        // Palavra por palavra para quebrar linha se necessário
        const palavras = pedaço.split(' ');
        for (let p = 0; p < palavras.length; p++) {
            const palavra = palavras[p] + (p < palavras.length - 1 ? ' ' : '');
            const larguraPalavra = pdf.getTextWidth(palavra);

            // Se passar da largura máxima da página, pula para a linha de baixo
            if (linhaAtualX + larguraPalavra > x + larguraMaxima) {
                linhaAtualX = x;
                linhaAtualY += alturaLinha;
            }

            pdf.text(palavra, linhaAtualX, linhaAtualY);
            linhaAtualX += larguraPalavra;
        }

        eItalico = !eItalico; // Alterna para o próximo bloco
    }

    return linhaAtualY + alturaLinha;
}

// ==========================================
// GERAÇÃO DO PDF
// ==========================================

async function salvar_pdf(lista_gerada) {
    if (!window.jspdf) {
        alert("Erro: A biblioteca jsPDF não carregou.");
        return;
    }

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
    if (fontes.italico) {
        pdf.addFileToVFS("timesi.ttf", fontes.italico);
        pdf.addFont("timesi.ttf", "TimesCyr", "italic"); // Registra o itálico no jsPDF
    }
    
    // --- CABEÇALHO ---
    pdf.setFont("TimesCyr", "bold"); 
    pdf.setFontSize(18);
    pdf.text("Lista de exercícios", 105, 20, { align: "center" });

    pdf.setFontSize(12);
    pdf.text("Aluno(a):", 20, 35);
    pdf.text("Habilitação:", 140, 35);

    const dataHoje = new Date().toLocaleDateString('pt-BR');
    pdf.text(`Simulado de Língua Russa - ${dataHoje}`, 20, 45);

    // --- CORPO DAS QUESTÕES ---
    let y = 65; 
    const margemEsquerda = 20; 
    const recuoLista = 30; 
    const larguraAreaTexto = 170; 
    const larguraAreaLista = 160; 

    for (const [pergunta, itens] of Object.entries(lista_gerada)) {
        if (y > 275) { pdf.addPage(); y = 20; }
        
        // Enunciado em negrito
        pdf.setFont("TimesCyr", "bold"); 
        const linhasPergunta = pdf.splitTextToSize(pergunta, larguraAreaTexto);
        pdf.text(linhasPergunta, margemEsquerda, y);
        y += (linhasPergunta.length * 6) + 4; 

        // Alternativas/Itens (agora passando pela função que aceita *itálico*)
        itens.forEach((texto) => {
            if (y > 275) { pdf.addPage(); y = 20; }
            y = desenharTextoComItalico(pdf, texto, recuoLista, y, larguraAreaLista);
        });
        
        y += 10; 
    }
    
    pdf.save("Lista_De_Exercicio.pdf");
}

// ==========================================
// LÓGICA DE SORTEIO DE SIMULADO
// ==========================================

async function gerar_lista() {
    const banco = await carregar_json(ARQUIVO_BANCO, {});
    
    if (Object.keys(banco).length === 0) {
        alert("Aviso: O arquivo JSON está vazio ou não pôde ser lido.");
        return;
    }

    const feitas = obterQuestoesFeitas();
    let questoesComDisponiveis = [];

    for (const [idQuestao, letras] of Object.entries(banco)) {
        const letras_feitas = feitas[idQuestao] || [];
        const letras_disponiveis = letras.filter(letra => !letras_feitas.includes(letra));

        if (letras_disponiveis.length > 0) {
            questoesComDisponiveis.push({ 
                id: idQuestao, 
                disponiveis: letras_disponiveis 
            });
        }
    }

    if (questoesComDisponiveis.length === 0) {
        alert("Você já resolveu todas as alternativas do banco!");
        return;
    }

    questoesComDisponiveis = embaralharArray(questoesComDisponiveis);
    const questoesSelecionadas = questoesComDisponiveis.slice(0, QTD_QUESTOES_PADRAO);
    
    const lista_gerada = {};

    for (const questao of questoesSelecionadas) {
        const alternativasEmbaralhadas = embaralharArray(questao.disponiveis);
        const alternativasEscolhidas = alternativasEmbaralhadas.slice(0, QTD_ITENS_PADRAO);
        
        lista_gerada[questao.id] = alternativasEscolhidas;

        if (!feitas[questao.id]) {
            feitas[questao.id] = [];
        }
        feitas[questao.id].push(...alternativasEscolhidas);
    }

    localStorage.setItem('questoes_feitas', JSON.stringify(feitas));
    await salvar_pdf(lista_gerada);
}

// ==========================================
// EVENTOS DOS BOTÕES
// ==========================================

const btnGerarEl = document.getElementById('btnGerar');
if (btnGerarEl) {
    btnGerarEl.addEventListener('click', gerar_lista);
}

const btnResetarEl = document.getElementById('btnResetar');
if (btnResetarEl) {
    btnResetarEl.addEventListener('click', () => {
        localStorage.removeItem('questoes_feitas');
        alert("Progresso reiniciado com sucesso!");
        location.reload();
    });
}

// FUNçÔES

function casos(){
    window.location.href = "./casos.html"
}

function cprep(){
    window.location.href = "./caso-prepositivo.html"
}

function inicio(){
    window.location.href = "./index.html"
}

function oops(){
    alert("Em manutenção!")
}