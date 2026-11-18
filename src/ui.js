'use strict';
(function () {
  const $ = id => document.getElementById(id);
  const eng = new HP12C({ comma: true });
  const api = window.hp12c || null;           // ponte do Electron (ausente no navegador)

  // ---------- layout das teclas: [id, rótulo, f (laranja), g (azul), tecla de atalho] ----------
  const KEYS = [
    ['n', 'n', 'AMORT', '12×', 'n'], ['i', 'i', 'INT', '12÷', 'i'], ['PV', 'PV', 'NPV', 'CFo', 'p'], ['PMT', 'PMT', 'RND', 'CFj', 'm'], ['FV', 'FV', 'IRR', 'Nj', 'v'],
    ['CHS', 'CHS', '', 'DATE', 'h'], ['7', '7', '', 'BEG', '7'], ['8', '8', '', 'END', '8'], ['9', '9', '', 'MEM', '9'], ['div', '÷', '', '', '/'],
    ['yx', 'y<sup>x</sup>', 'PRICE', '√x', 'y'], ['inv', '1/x', 'YTM', 'e<sup>x</sup>', 'q'], ['pT', '%T', 'SL', 'LN', 't'], ['dP', 'Δ%', 'SOYD', 'FRAC', 'd'], ['pc', '%', 'DB', 'INTG', '%'],
    ['EEX', 'EEX', '', 'ΔDYS', 'e'], ['4', '4', '', 'D.MY', '4'], ['5', '5', '', 'M.DY', '5'], ['6', '6', '', 'x̄ w', '6'], ['mul', '×', '', '', '*'],
    ['RS', 'R/S', 'P/R', 'PSE', '␣'], ['SST', 'SST', 'Σ', 'BST', '→'], ['Rd', 'R↓', 'PRGM', 'GTO', '↓'], ['xy', 'x≷y', 'FIN', 'x≤y', 'x'], ['CLx', 'CLX', 'REG', 'x=0', 'Del'],
    ['ENTER', 'ENTER', 'PREFIX', 'LSTx', '↵'], ['1', '1', '', 'x̂ , r', '1'], ['2', '2', '', 'ŷ , r', '2'], ['3', '3', '', 'n!', '3'], ['sub', '−', '', '←', '-'],
    ['ON', 'ON', '', '', 'o'], ['f', 'f', '', '', 'f'], ['g', 'g', '', '', 'g'], ['STO', 'STO', '', '', 's'], ['RCL', 'RCL', '', '', 'r'], null,
    ['0', '0', '', 'x̄', '0'], ['.', '•', '', 's', ','], ['sum', 'Σ+', '', 'Σ−', 'z'], ['add', '+', '', '', '+']
  ];
  const BR = { 1: [[1, 2, 'BOND'], [3, 5, 'DEPRECIATION']], 2: [[2, 6, 'CLEAR']] };
  const GROW = [1, 3, 5, 7];

  function build() {
    let h = '<div class="c12-case"><div class="c12-face"><div class="c12-lcdframe"><div class="c12-lcd" id="lcd">' +
      '<div class="c12-disp" id="disp" aria-live="polite">0,00</div>' +
      '<div class="c12-ann"><span id="aUser">USER</span><span id="aF">f</span><span id="aG">g</span><span id="aBeg">BEGIN</span><span id="aDmy">D.MY</span><span id="aC">C</span><span id="aPrgm">PRGM</span></div>' +
      '</div></div><div class="c12-logo" aria-hidden="true"><div class="hp">hp</div><div class="mod">12C</div></div></div>' +
      '<div class="c12-panel"><div class="c12-keys">';
    Object.keys(BR).forEach(r => BR[r].forEach(([c1, c2, t]) => {
      h += '<div class="c12-br" style="grid-row:' + (GROW[r] - 1) + ';grid-column:' + c1 + ' / ' + (c2 + 1) + '"><span>' + t + '</span></div>';
    }));
    KEYS.forEach((k, idx) => {
      if (!k) return;
      const r = Math.floor(idx / 10), c = idx % 10 + 1;
      const cls = k[0] === 'f' ? ' kf' : (k[0] === 'g' ? ' kg' : (k[0] === 'ENTER' ? ' kent' : ''));
      const gr = k[0] === 'ENTER' ? GROW[r] + ' / span 3' : GROW[r];
      h += '<div class="c12-c" style="grid-row:' + gr + ';grid-column:' + c + '"><span class="lf">' + (k[2] || '&nbsp;') + '</span>' +
        '<button type="button" class="c12-k' + cls + '" data-k="' + k[0] + '" data-sc="' + k[4] + '" tabindex="-1"><span class="lm">' + k[1] + '</span>' +
        (k[3] ? '<span class="lg">' + k[3] + '</span>' : '') + '</button></div>';
    });
    h += '</div><div class="c12-brand" aria-hidden="true"><b>HEWLETT·PACKARD</b><i></i></div></div></div>';
    $('calc').innerHTML = h;
  }

  // ---------- renderização ----------
  let lastSaved = '';
  function render() {
    const v = eng.view();
    const disp = $('disp');
    disp.textContent = v.text;
    disp.classList.toggle('txt', /^[A-Za-z]/.test(v.text) && !/^Error/.test(v.text));
    $('lcd').classList.toggle('off', v.off);
    $('aF').classList.toggle('on', v.f); $('aG').classList.toggle('on', v.g);
    $('aBeg').classList.toggle('on', v.begin); $('aDmy').classList.toggle('on', v.dmy);
    $('aC').classList.toggle('on', v.c); $('aPrgm').classList.toggle('on', v.prgm);
    renderRegs();
    scheduleSave();
  }
  function renderRegs() {
    const el = $('regs'); if (el.classList.contains('hidden')) return;
    const f = x => Number(x).toLocaleString('pt-BR', { maximumFractionDigits: 6 });
    const st = eng.st.slice(); st[0] = eng.x;
    const parts = [['X', st[0]], ['Y', st[1]], ['Z', st[2]], ['T', st[3]], ['LSTx', eng.lastX],
      ['n', eng.fin.n], ['i', eng.fin.i], ['PV', eng.fin.PV], ['PMT', eng.fin.PMT], ['FV', eng.fin.FV]];
    for (let k = 0; k < 10; k++) parts.push(['R' + k, eng.regs[k]]);
    for (let k = 0; k < 10; k++) parts.push(['R.' + k, eng.regs[10 + k]]);
    parts.push(['CF0', eng.cf[0]]);
    for (let j = 1; j < eng.cf.length; j++) parts.push(['CF' + j, eng.cf[j] + (eng.nj[j] > 1 ? ' ×' + eng.nj[j] : '')]);
    el.innerHTML = parts.map(([k, v]) => '<span><b>' + k + '</b>' + (typeof v === 'number' ? f(v) : v) + '</span>').join('');
  }
  let saveT = null;
  function scheduleSave() {
    clearTimeout(saveT);
    saveT = setTimeout(save, 250);
  }
  function save() {
    try { const s = JSON.stringify(eng.serialize()); if (s !== lastSaved) { localStorage.setItem('hp12c.state', s); lastSaved = s; } } catch (e) { /* sem armazenamento */ }
  }
  function load() {
    try { const s = localStorage.getItem('hp12c.state'); if (s) { eng.restore(JSON.parse(s)); lastSaved = s; } } catch (e) { /* estado inválido: começa zerado */ }
  }
  function toast(msg) {
    const t = $('toast'); t.textContent = msg; t.classList.remove('hidden');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add('hidden'), 2200);
  }

  // ---------- entrada: mouse/toque ----------
  let activePtr = null;
  function bindPointer() {
    const calc = $('calc');
    calc.addEventListener('pointerdown', e => {
      const b = e.target.closest('.c12-k'); if (!b || e.button !== 0) return;
      e.preventDefault(); activePtr = { id: e.pointerId, btn: b };
      b.classList.add('down'); try { b.setPointerCapture(e.pointerId); } catch (_) { /* ok */ }
      eng.keyDown(b.dataset.k);
    });
    const up = e => {
      if (!activePtr || (e && e.pointerId !== activePtr.id)) return;
      activePtr.btn.classList.remove('down'); activePtr = null; eng.keyUp();
    };
    calc.addEventListener('pointerup', up); calc.addEventListener('pointercancel', up);
  }

  // ---------- entrada: teclado ----------
  // atalhos do teclado: cada tecla da calculadora tem uma lista de teclas do computador (personalizável)
  const DEFAULT_BIND = { n: ['n'], i: ['i'], PV: ['p'], PMT: ['m'], FV: ['v'], CHS: ['h'], 7: ['7'], 8: ['8'], 9: ['9'], div: ['/'],
    yx: ['y'], inv: ['q'], pT: ['t'], dP: ['d'], pc: ['%'], EEX: ['e'], 4: ['4'], 5: ['5'], 6: ['6'], mul: ['*'],
    RS: [' '], SST: ['ArrowRight'], Rd: ['ArrowDown'], xy: ['x'], CLx: ['Delete'], ENTER: ['Enter'], 1: ['1'], 2: ['2'], 3: ['3'], sub: ['-'],
    ON: ['o'], f: ['f'], g: ['g'], STO: ['s'], RCL: ['r'], 0: ['0'], '.': [',', '.'], sum: ['z'], add: ['+'] };
  // teclas que não podem ser atribuídas (têm função fixa no app ou são modificadoras)
  const RESERVED = new Set(['Escape', 'Backspace', 'ArrowLeft', 'F1', 'F2', '?', 'Tab', 'Shift', 'Control', 'Alt', 'Meta', 'AltGraph', 'CapsLock', 'NumLock', 'ScrollLock',
    'ContextMenu', 'Dead', 'Process', 'Unidentified', 'OS', 'PageUp', 'PageDown', 'Home', 'End', 'Insert']);
  let bindings = {}, KEYIDX = {};
  function rebuildIdx() { KEYIDX = {}; Object.keys(bindings).forEach(id => bindings[id].forEach(k => { KEYIDX[k] = id; })); }
  function loadBindings() {
    bindings = JSON.parse(JSON.stringify(DEFAULT_BIND));
    try {
      const o = JSON.parse(localStorage.getItem('hp12c.keymap') || '{}');
      Object.keys(o).forEach(id => { if (id in bindings && Array.isArray(o[id])) bindings[id] = o[id].filter(k => typeof k === 'string' && k.length > 0 && k.length <= 16 && !RESERVED.has(k)); });
    } catch (_) { /* usa os padrões */ }
    rebuildIdx();
  }
  function saveBindings() {
    const o = {};
    Object.keys(bindings).forEach(id => { if (JSON.stringify(bindings[id]) !== JSON.stringify(DEFAULT_BIND[id])) o[id] = bindings[id]; });
    try { if (Object.keys(o).length) localStorage.setItem('hp12c.keymap', JSON.stringify(o)); else localStorage.removeItem('hp12c.keymap'); } catch (_) { /* sem armazenamento */ }
  }
  const KEYNAME = { ' ': 'Espaço', Enter: 'Enter', Delete: 'Del', ArrowRight: '→', ArrowLeft: '←', ArrowDown: '↓', ArrowUp: '↑' };
  const HINTNAME = { ' ': '␣', Enter: '↵', Delete: 'Del', ArrowRight: '→', ArrowLeft: '←', ArrowDown: '↓', ArrowUp: '↑' };
  const keyName = k => KEYNAME[k] || k;
  const scText = id => (bindings[id] && bindings[id].length) ? keyName(bindings[id][0]) : '';
  function updateHints() {
    document.querySelectorAll('.c12-k').forEach(b => {
      const a = bindings[b.dataset.k]; const t = a && a.length ? (HINTNAME[a[0]] || a[0]) : '';
      if (t) b.setAttribute('data-sc', t); else b.removeAttribute('data-sc');
    });
  }
  const calcLabel = id => { const k = KEYS.find(x => x && x[0] === id); return k ? k[1].replace(/<[^>]+>/g, '') : id; };
  const heldKeys = new Map();
  /** ← (g ←): apaga o último dígito; com erro/prefixo pendente só limpa o estado */
  function backspace() {
    if (eng.err || eng.off || eng.running) { eng.press('CLx'); return; }
    if (eng.buf.length) { eng.buf = []; eng.emit(); return; }
    eng.press('g'); eng.press('sub');
  }
  function flash(id, on) {
    const b = document.querySelector('.c12-k[data-k="' + id + '"]'); if (b) b.classList.toggle('down', on);
  }
  function bindKeyboard() {
    window.addEventListener('keydown', e => {
      if (capId) { e.preventDefault(); handleCapture(e); return; }
      if (e.key === 'F2' || (e.key === '?' && !e.ctrlKey && !e.altKey && !e.metaKey)) {
        e.preventDefault(); if (sheetMode === 'shortcuts') hideHelp(); else showShortcuts(); return;
      }
      if (!$('help').classList.contains('hidden')) { if (e.key === 'Escape') hideHelp(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) {
        const k = e.key.toLowerCase();
        if (k === 'c') { e.preventDefault(); copyDisplay(); }
        else if (k === 'v') { e.preventDefault(); pasteNumber(); }
        return;
      }
      if (e.key === 'Escape') { eng.buf = []; eng.overlay = null; eng.emit(); return; }
      if (e.repeat) { e.preventDefault(); return; }
      if (e.key === 'Backspace') { e.preventDefault(); backspace(); flash('sub', true); setTimeout(() => flash('sub', false), 90); return; }
      if (e.key === 'ArrowLeft') {
        e.preventDefault(); if (eng.err || eng.off || eng.running) { eng.press('CLx'); return; }
        eng.buf = []; eng.press('g'); eng.keyDown('SST'); heldKeys.set('ArrowLeft', 'SST'); flash('SST', true); return;
      }
      const id = KEYIDX[e.key.length === 1 ? e.key.toLowerCase() : e.key];
      if (!id) return;
      e.preventDefault(); heldKeys.set(e.key, id); flash(id, true); eng.keyDown(id);
    });
    window.addEventListener('keyup', e => {
      const id = heldKeys.get(e.key); if (!id) return;
      heldKeys.delete(e.key); flash(id, false); eng.keyUp();
    });
    window.addEventListener('blur', () => { heldKeys.forEach((id) => flash(id, false)); heldKeys.clear(); eng.keyUp(); });
  }

  // ---------- copiar / colar ----------
  function copyDisplay() {
    const v = eng.x; const s = String(Number(v.toPrecision(12))).replace('.', eng.opts.comma ? ',' : '.');
    const done = () => toast('Copiado: ' + s);
    if (api && api.copyText) { api.copyText(s); done(); }
    else if (navigator.clipboard) navigator.clipboard.writeText(s).then(done, () => toast('Não foi possível copiar'));
  }
  async function pasteNumber() {
    let txt = '';
    try { txt = api && api.pasteText ? await api.pasteText() : await navigator.clipboard.readText(); } catch (_) { /* sem acesso */ }
    let s = String(txt).trim().replace(/[R$\s]/g, '');
    if (/,\d{1,2}$/.test(s) && /\./.test(s)) s = s.replace(/\./g, '').replace(',', '.');   // 1.234,56
    else if (/^\d+,\d+$/.test(s)) s = s.replace(',', '.');                                  // 1234,56
    else s = s.replace(/,/g, '');                                                          // 1,234.56
    const num = Number(s);
    if (!s || !isFinite(num)) { toast('A área de transferência não tem um número'); return; }
    const mant = Math.abs(num);
    const digits = (mant >= 1e10 || (mant !== 0 && mant < 1e-9)) ? null : String(Number(mant.toPrecision(10)));
    if (digits === null || /e/i.test(digits)) { toast('Número fora do alcance do visor'); return; }
    if (eng.off || eng.running) { toast('Ligue a calculadora (ON) e pare o programa antes de colar'); return; }
    for (const ch of digits) eng.press(ch);
    if (num < 0) eng.press('CHS');
    toast('Colado: ' + digits);
  }

  // ---------- guia ----------
  const HELP = `
<h1>Calculadora financeira 12C</h1>
<p>Réplica funcional da HP 12C: pilha RPN de 4 níveis, funções financeiras, datas, estatística e programação de até 99 linhas. Letras <span class="fl">laranja</span> = tecla <b>f</b> antes; letras <span class="gl">azuis</span> = tecla <b>g</b> antes.</p>
<h2>Teclado do computador (padrão)</h2>
<p>Esta tabela mostra os atalhos de fábrica. Para ver ou mudar os seus, abra a tela de atalhos (<kbd>F2</kbd>) e use <b>Personalizar atalhos</b>.</p>
<table><tr><th>Tecla</th><th>Função</th><th>Tecla</th><th>Função</th></tr>
<tr><td><kbd>0</kbd>–<kbd>9</kbd> <kbd>,</kbd> <kbd>.</kbd></td><td>dígitos e ponto decimal</td><td><kbd>Enter</kbd></td><td>ENTER</td></tr>
<tr><td><kbd>+</kbd> <kbd>-</kbd> <kbd>*</kbd> <kbd>/</kbd></td><td>operações</td><td><kbd>Backspace</kbd></td><td>← (apaga o último dígito)</td></tr>
<tr><td><kbd>n</kbd> <kbd>i</kbd> <kbd>p</kbd> <kbd>m</kbd> <kbd>v</kbd></td><td>n, i, PV, PMT, FV</td><td><kbd>Delete</kbd></td><td>CLX</td></tr>
<tr><td><kbd>h</kbd> <kbd>e</kbd></td><td>CHS, EEX</td><td><kbd>f</kbd> <kbd>g</kbd></td><td>teclas f e g</td></tr>
<tr><td><kbd>y</kbd> <kbd>q</kbd> <kbd>t</kbd> <kbd>d</kbd> <kbd>%</kbd></td><td>yˣ, 1/x, %T, Δ%, %</td><td><kbd>s</kbd> <kbd>r</kbd></td><td>STO, RCL</td></tr>
<tr><td><kbd>x</kbd> <kbd>↓</kbd></td><td>x≷y, R↓</td><td><kbd>z</kbd></td><td>Σ+</td></tr>
<tr><td><kbd>Espaço</kbd></td><td>R/S</td><td><kbd>→</kbd> / <kbd>←</kbd></td><td>SST / BST (segure para ver a linha)</td></tr>
<tr><td><kbd>o</kbd></td><td>ON (liga/desliga o visor)</td><td><kbd>Ctrl+C</kbd> / <kbd>Ctrl+V</kbd></td><td>copia o visor / cola um número</td></tr>
<tr><td><kbd>Esc</kbd></td><td>cancela f, g, STO, RCL pendentes</td><td colspan="2">Em <b>Exibir → Mostrar atalhos nas teclas</b> as letras aparecem em cada tecla.</td></tr></table>
<h2>Financeiro</h2>
<p>Digite o valor e pressione a tecla para <b>armazenar</b> (<code>12 n</code>, <code>1 i</code>, <code>1000 CHS PV</code>). Pressione a tecla <b>sem digitar um número</b> (logo após outra tecla financeira) para <b>calcular</b> (<code>PMT</code>). <code>g BEG</code>/<code>g END</code> alternam início/fim do período (BEGIN no visor). Com n fracionário a 12C usa juros simples na fração; <code>STO EEX</code> liga juros compostos (C no visor). <code>g 12×</code> e <code>g 12÷</code> convertem anos↔meses.</p>
<table><tr><th>Função</th><th>Como usar</th></tr>
<tr><td><b>NPV / IRR</b></td><td><code>g CFo</code> (fluxo inicial), <code>g CFj</code> (fluxos seguintes), <code>g Nj</code> (repetições do último fluxo), <code>f NPV</code> (usa i), <code>f IRR</code>. Até 20 fluxos (Nj até 99).</td></tr>
<tr><td><b>AMORT</b></td><td>com n, i, PV e PMT: digite o nº de parcelas e <code>f AMORT</code> → juros no visor; <code>x≷y</code> principal; <code>RCL PV</code> saldo. n avança e PV vira o saldo.</td></tr>
<tr><td><b>INT</b></td><td>n (dias), i (% a.a.), PV: <code>f INT</code> → juros simples (ano de 360 dias); <code>x≷y</code> → ano de 365.</td></tr>
<tr><td><b>SL / SOYD / DB</b></td><td>n (vida útil), PV (custo), FV (residual), i (% do saldo decrescente; 200 = dobrado). Digite o ano e <code>f SL</code> etc. → depreciação; <code>x≷y</code> valor depreciável restante.</td></tr>
<tr><td><b>PRICE / YTM</b></td><td>i = rendimento (PRICE) ou PV = preço (YTM), PMT = cupom % a.a.; digite liquidação <code>ENTER</code> vencimento. PRICE → preço limpo (x≷y: juros acumulados). Cupons semestrais, 30/360.</td></tr>
<tr><td><b>DATE / ΔDYS</b></td><td><code>g D.MY</code> ou <code>g M.DY</code> escolhem o formato (4.252015 = 25/04/2015 em M.DY). <code>DATE</code>: data <code>ENTER</code> dias <code>g DATE</code>. <code>ΔDYS</code>: data1 <code>ENTER</code> data2 → dias reais (e 30/360 em Y).</td></tr>
<tr><td><b>Estatística</b></td><td><code>y ENTER x Σ+</code> acumula; <code>g x̄</code>, <code>g s</code>, <code>g ŷ,r</code>, <code>g x̂,r</code> (regressão linear), <code>g x̄w</code> (média ponderada). <code>f Σ</code> limpa.</td></tr>
<tr><td><b>Limpar</b></td><td><code>f Σ</code> estatística · <code>f FIN</code> registradores financeiros e fluxos · <code>f REG</code> tudo · <code>f PRGM</code> (modo PRGM: apaga o programa; modo normal: volta à linha 000) · <code>f PREFIX</code> mostra a mantissa (segure).</td></tr>
<tr><td><b>Exibição</b></td><td><code>f 0</code>–<code>f 9</code> casas decimais · <code>f •</code> notação científica · <code>g MEM</code> memória livre (segure) · <code>g LSTx</code> último X.</td></tr></table>
<h2>Programação</h2>
<p><code>f P/R</code> entra e sai do modo PRGM (aparece PRGM no visor). Cada tecla gravada ocupa uma linha (STO 3, GTO 05 e f/g + tecla contam como uma). Os códigos aparecem como <code>003-  44 3</code>. As linhas novas <b>substituem</b> as existentes, como na HP 12C original. <code>SST</code>/<code>BST</code> andam pelas linhas e <code>g GTO • nnn</code> vai direto à linha nnn.</p>
<p>No modo normal: <code>R/S</code> executa a partir da linha atual (qualquer tecla interrompe); <code>SST</code> segurado mostra a próxima linha e, ao soltar, a executa; <code>g GTO nn</code> posiciona na linha nn; <code>f PRGM</code> volta à linha 000. Dentro do programa: <code>g GTO nn</code> desvia (nn = 00 encerra), <code>g x≤y</code> e <code>g x=0</code> executam a linha seguinte só se o teste for verdadeiro, <code>g PSE</code> pausa 1 s e <code>R/S</code> para.</p>
<p>A memória é compartilhada: começa com 8 linhas livres e 20 registradores (R0–R9 e R.0–R.9); a cada 7 linhas além das 8 primeiras, um registrador é consumido (até 99 linhas e 7 registradores). O programa e todos os registradores são guardados ao fechar o app (memória contínua).</p>
<p>Exemplo — fatorial de X: <code>f P/R  STO 0  1  STO 1  RCL 0  g x=0  g GTO 12  STO × 1  RCL 0  1  −  STO 0  g GTO 03  RCL 1  R/S  f P/R</code>. Depois: <code>g GTO 00</code>, digite 5 e pressione <code>R/S</code> → 120.</p>
<h2>Erros</h2>
<table><tr><td>Error 0</td><td>conta matemática inválida</td><td>Error 1</td><td>estouro de registrador</td></tr>
<tr><td>Error 2</td><td>estatística</td><td>Error 3</td><td>registrador inexistente / IRR sem troca de sinal</td></tr>
<tr><td>Error 4</td><td>memória de programa cheia</td><td>Error 5</td><td>juros compostos sem solução</td></tr>
<tr><td>Error 6</td><td>fluxos de caixa (limite/Nj)</td><td>Error 7</td><td>IRR sem solução</td></tr>
<tr><td>Error 8</td><td>data inválida (1582–4046)</td><td colspan="2">Qualquer tecla apaga a mensagem.</td></tr></table>
<p style="color:#9a9684;margin-top:14px">Aplicativo independente de estudo, sem vínculo com a Hewlett-Packard. Os resultados seguem as convenções documentadas da HP 12C, mas arredondamentos internos podem diferir na última casa.</p>`;
  // ---------- folha de atalhos do teclado ----------
  let sheetMode = null, hintsOn = false, editMode = false, capId = null;
  function shortcutsHtml() {
    let g = '<div class="kbmap">';
    KEYS.forEach((k, idx) => {
      if (!k) return;
      const r = Math.floor(idx / 10), c = idx % 10 + 1;
      const gr = k[0] === 'ENTER' ? (r + 1) + ' / span 2' : (r + 1);
      const cls = k[0] === 'f' ? ' kbf' : (k[0] === 'g' ? ' kbg' : '');
      const sel = capId === k[0] ? ' sel' : '';
      g += '<div class="kb' + cls + sel + '" data-id="' + k[0] + '" style="grid-row:' + gr + ';grid-column:' + c + '"><span class="kbl">' + k[1] + '</span><kbd>' + (scText(k[0]) ? keyName(bindings[k[0]][0]) : '—') + '</kbd></div>';
    });
    g += '</div>';
    const edit = editMode
      ? '<div class="capture">' + (capId
        ? 'Pressione a nova tecla do computador para <b>' + calcLabel(capId) + '</b>. <span class="muted">Esc cancela.</span> <button class="btn" data-act="unbind">Remover atalho</button> <button class="btn" data-act="cancel-cap">Cancelar</button>'
        : 'Clique numa tecla da calculadora abaixo e depois aperte a tecla do computador que você quer usar.') + '</div>'
      : '';
    return '<h1>Atalhos do teclado</h1>' +
      '<p>Cada tecla da calculadora (em cima) e a tecla do computador que a aciona (embaixo). Funciona com o teclado numérico também.</p>' + edit +
      '<div class="' + (editMode ? 'editing' : '') + '">' + g + '</div>' +
      '<h2>Funções em laranja e azul</h2>' +
      '<p>Pressione <kbd>f</kbd> ou <kbd>g</kbd> e depois a tecla. Exemplos: <kbd>f</kbd> <kbd>n</kbd> = AMORT, <kbd>g</kbd> <kbd>n</kbd> = 12×, <kbd>g</kbd> <kbd>7</kbd> = BEG, <kbd>f</kbd> <kbd>2</kbd> = duas casas decimais. <kbd>STO</kbd> e <kbd>RCL</kbd> (<kbd>s</kbd>, <kbd>r</kbd>) esperam o número do registrador.</p>' +
      '<h2>Outros atalhos</h2>' +
      '<table><tr><th>Tecla</th><th>Ação</th></tr>' +
      '<tr><td><kbd>Backspace</kbd></td><td>← apaga o último dígito digitado</td></tr>' +
      '<tr><td><kbd>→</kbd> / <kbd>←</kbd></td><td>SST / BST (segure para ver a linha do programa; ao soltar o SST a linha é executada)</td></tr>' +
      '<tr><td><kbd>Esc</kbd></td><td>cancela f, g, STO, RCL ou GTO pendentes</td></tr>' +
      '<tr><td><kbd>Ctrl</kbd>+<kbd>C</kbd> / <kbd>Ctrl</kbd>+<kbd>V</kbd></td><td>copia o número do visor / cola um número da área de transferência</td></tr>' +
      '<tr><td><kbd>Ctrl</kbd>+<kbd>S</kbd> / <kbd>Ctrl</kbd>+<kbd>O</kbd></td><td>exporta / importa um programa</td></tr>' +
      '<tr><td><kbd>F1</kbd></td><td>guia completo da calculadora</td></tr>' +
      '<tr><td><kbd>F2</kbd> ou <kbd>?</kbd></td><td>abre ou fecha esta tela</td></tr></table>' +
      (editMode
        ? '<p class="muted">Teclas reservadas, que não podem ser trocadas: <kbd>Esc</kbd>, <kbd>Backspace</kbd>, <kbd>←</kbd>, <kbd>F1</kbd>, <kbd>F2</kbd> e <kbd>?</kbd>. Se a tecla já estiver em uso, ela passa para a nova função e a antiga fica sem atalho. As escolhas ficam salvas neste computador.</p>' +
          '<p style="margin-top:14px"><button class="btn" data-act="done">Concluir</button><button class="btn" data-act="reset-keys">Restaurar padrão</button></p>'
        : '<p style="margin-top:14px"><button class="btn" data-act="edit">Personalizar atalhos</button>' +
          '<button class="btn" data-act="hints">' + (hintsOn ? 'Ocultar' : 'Mostrar') + ' as letras nas teclas da calculadora</button>' +
          '<button class="btn" data-act="guide">Guia completo (F1)</button></p>');
  }
  function openSheet(html, mode) {
    sheetMode = mode; $('helpBody').innerHTML = html; $('help').classList.remove('hidden'); $('helpBody').parentElement.scrollTop = 0;
  }
  function showHelp() {
    openSheet('<p><button class="btn" data-act="shortcuts">Ver só os atalhos do teclado (F2)</button></p>' + HELP, 'guide');
  }
  function showShortcuts() { openSheet(shortcutsHtml(), 'shortcuts'); }
  function hideHelp() { $('help').classList.add('hidden'); sheetMode = null; editMode = false; capId = null; }
  function handleCapture(e) {
    if (['Shift', 'Control', 'Alt', 'Meta', 'AltGraph'].includes(e.key)) return;
    if (e.key === 'Escape') { capId = null; showShortcuts(); return; }
    if (e.ctrlKey || e.altKey || e.metaKey) { toast('Use uma tecla sozinha (sem Ctrl, Alt ou Windows)'); return; }
    if (RESERVED.has(e.key)) { toast('A tecla ' + keyName(e.key) + ' é reservada. Escolha outra.'); return; }
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const owner = KEYIDX[k];
    if (owner && owner !== capId) {
      bindings[owner] = bindings[owner].filter(x => x !== k);
      toast('A tecla ' + keyName(k) + ' estava em ' + calcLabel(owner) + ', que ficou sem atalho.');
    }
    bindings[capId] = [k]; rebuildIdx(); saveBindings(); updateHints();
    capId = null; showShortcuts();
  }
  function sheetAction(act) {
    if (act === 'edit') { editMode = true; capId = null; showShortcuts(); }
    else if (act === 'done') { editMode = false; capId = null; showShortcuts(); }
    else if (act === 'cancel-cap') { capId = null; showShortcuts(); }
    else if (act === 'unbind') { if (capId) { bindings[capId] = []; rebuildIdx(); saveBindings(); updateHints(); } capId = null; showShortcuts(); toast('Atalho removido'); }
    else if (act === 'reset-keys') { bindings = JSON.parse(JSON.stringify(DEFAULT_BIND)); rebuildIdx(); saveBindings(); updateHints(); capId = null; showShortcuts(); toast('Atalhos restaurados para o padrão'); }
    else if (act === 'shortcuts') showShortcuts();
    else if (act === 'guide') showHelp();
    else if (act === 'hints') {
      if (api && api.setSetting) api.setSetting('hints', !hintsOn);
      else applySettings({ hints: !hintsOn, showRegs: !$('regs').classList.contains('hidden') });
    }
  }

  // ---------- ajuste ao tamanho da janela ----------
  function fit() {
    const stage = $('stage'), calc = $('calc'), regs = $('regs');
    const availW = stage.clientWidth - 20;
    const extra = regs.classList.contains('hidden') ? 0 : regs.offsetHeight + 8;
    const availH = stage.clientHeight - 20 - extra;
    calc.style.width = Math.max(300, availW) + 'px';
    const h = calc.offsetHeight;
    if (h > availH && availH > 100) calc.style.width = Math.max(300, Math.floor(availW * availH / h)) + 'px';
  }

  // ---------- programa: exportar / importar ----------
  function exportProgram() {
    const lines = {}; for (let i = 1; i <= 99; i++) if (eng.prog[i]) lines[i] = eng.prog[i];
    const data = { formato: 'hp12c-programa', versao: 1, linhas: lines };
    if (api && api.saveFile) api.saveFile('programa-12c.json', JSON.stringify(data, null, 2)).then(r => r && toast('Programa salvo'));
  }
  function importProgram(text) {
    try {
      const d = JSON.parse(text); if (d.formato !== 'hp12c-programa') throw new Error('formato');
      const prog = new Array(100).fill(null);
      for (const [k, t] of Object.entries(d.linhas)) {
        const n = Number(k); if (!(n >= 1 && n <= 99) || !Array.isArray(t) || HP12C.classify(t) !== 'c') throw new Error('linha ' + k);
        prog[n] = t;
      }
      eng.prog = prog; eng.pc = 0; eng.emit(); toast('Programa carregado (' + eng.usedLines() + ' linhas)');
    } catch (e) { toast('Arquivo de programa inválido'); }
  }

  // ---------- configurações vindas do menu (Electron) ----------
  function applySettings(s) {
    if (!s) return;
    if (typeof s.comma === 'boolean') eng.opts.comma = s.comma;
    hintsOn = !!s.hints; document.body.classList.toggle('hints', hintsOn);
    if (sheetMode === 'shortcuts') showShortcuts();
    $('regs').classList.toggle('hidden', !s.showRegs);
    render(); fit();
  }

  function init() {
    build(); loadBindings(); updateHints(); load(); bindPointer(); bindKeyboard();
    eng.on(render);
    $('helpClose').addEventListener('click', hideHelp);
    $('helpBody').addEventListener('click', e => {
      const b = e.target.closest('[data-act]'); if (b) { sheetAction(b.dataset.act); return; }
      const cell = e.target.closest('.kb[data-id]');
      if (cell && editMode) { capId = cell.dataset.id; showShortcuts(); }
    });
    $('kbdBtn').addEventListener('click', showShortcuts);
    $('help').addEventListener('pointerdown', e => { if (e.target === $('help')) hideHelp(); });
    window.addEventListener('resize', fit);
    window.addEventListener('beforeunload', save);
    document.addEventListener('contextmenu', e => e.preventDefault());
    if (api) {
      api.onSettings(applySettings);
      api.onMenu((cmd, arg) => {
        if (cmd === 'reset') { eng.hardReset(); eng.emit(); toast('Memória zerada'); }
        else if (cmd === 'help') showHelp();
        else if (cmd === 'shortcuts') showShortcuts();
        else if (cmd === 'copy') copyDisplay();
        else if (cmd === 'paste') pasteNumber();
        else if (cmd === 'export-program') exportProgram();
        else if (cmd === 'import-program') importProgram(arg);
      });
      api.ready();
    } else {
      const q = new URLSearchParams(location.search);
      applySettings({ comma: q.get('dot') ? false : true, hints: q.get('hints') === '1', showRegs: q.get('regs') === '1' });
      if (q.get('help')) showHelp();
      if (q.get('shortcuts')) showShortcuts();
    }
    render(); fit(); requestAnimationFrame(fit);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
    window.__hp = eng; // depuração
  }
  init();
})();
