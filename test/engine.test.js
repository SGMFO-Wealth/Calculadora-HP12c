'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const HP12C = require('../src/engine.js');

const NAMES = { enter: 'ENTER', chs: 'CHS', eex: 'EEX', '+': 'add', '-': 'sub', '*': 'mul', '/': 'div', pv: 'PV', pmt: 'PMT', fv: 'FV',
  n: 'n', i: 'i', f: 'f', g: 'g', sto: 'STO', rcl: 'RCL', rs: 'RS', sst: 'SST', rd: 'Rd', xy: 'xy', clx: 'clx', yx: 'yx', inv: 'inv',
  '%': 'pc', 'd%': 'dP', '%t': 'pT', pt: 'pT', dp: 'dP', pc: 'pc', sum: 'sum', gto: 'Rd', on: 'ON', clx: 'CLx' };
/** "1000 enter 12 +" -> teclas */
function run(c, src) {
  for (const w of src.trim().split(/\s+/)) {
    if (NAMES[w] !== undefined) c.press(NAMES[w]);
    else if (/^-?[\d.,]+$/.test(w)) { for (const ch of w) c.press(ch === ',' ? '.' : ch); }
    else throw new Error('token desconhecido: ' + w);
  }
  return c;
}
const calc = () => new HP12C({ comma: false });
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b} (±${tol})`);
const X = c => c.x;
const S = c => { const s = c.st.slice(); s[0] = c.x; return s; };

test('aritmética e pilha RPN', () => {
  const c = run(calc(), '1000 enter 12 +');
  assert.equal(X(c), 1012); assert.equal(c.view().text, '1,012.00');
  run(c, 'clx 2 enter 3 enter 4'); assert.deepEqual(S(c).slice(0, 3), [4, 3, 2]);
  run(c, '* +'); assert.equal(X(c), 14);                       // 2 + 3*4
  run(c, 'clx 10 enter 4 -'); assert.equal(X(c), 6);
  run(c, 'enter 3 xy /'); assert.equal(X(c), 0.5);             // 3 xy → X=6? (6 / 3 => 2) verificado abaixo
});
test('x≷y, R↓, LSTx, CHS, 1/x, yˣ', () => {
  const c = run(calc(), '1 enter 2 enter 3 enter 4 rd'); assert.deepEqual(c.st, [3, 2, 1, 4]);
  run(c, 'clx 5 enter 7 xy'); assert.deepEqual(c.st.slice(0, 2), [5, 7]);
  run(c, 'clx 4 inv'); assert.equal(X(c), 0.25);
  run(c, 'clx 2 enter 10 yx'); assert.equal(X(c), 1024);
  run(c, 'clx 8 chs'); assert.equal(X(c), -8);
  run(c, 'clx 6 enter 3 /  g enter'); assert.equal(X(c), 3); // LSTx = 3
});
test('percentuais', () => {
  assert.equal(X(run(calc(), '200 enter 15 %')), 30);
  assert.equal(X(run(calc(), '80 enter 100 d%')), 25);
  assert.equal(X(run(calc(), '50 enter 200 %t')), 400);
});
test('funções g: √x, eˣ, LN, FRAC, INTG, n!', () => {
  assert.equal(X(run(calc(), '144 g yx')), 12);
  near(X(run(calc(), '1 g inv')), Math.E, 1e-9);
  near(X(run(calc(), '10 g pt')), Math.log(10), 1e-9);
  near(X(run(calc(), '3.75 g dp')), 0.75); assert.equal(X(run(calc(), '3.75 g pc')), 3);
  assert.equal(X(run(calc(), '5 g 3')), 120);
});
test('erros', () => {
  const c = run(calc(), '1 enter 0 /'); assert.equal(c.view().text, 'Error 0');
  c.press('CLx'); assert.equal(c.view().text, '0.00');
  assert.equal(run(calc(), '4 chs g yx').view().text, 'Error 0');
});
test('formato FIX / SCI / entrada', () => {
  const c = run(calc(), '3.14159 f 4'); assert.equal(c.view().text, '3.1416');
  run(c, 'f 0'); assert.equal(c.view().text, '3');
  run(c, 'f 9'); assert.equal(c.view().text, '3.141590000');
  const d = run(calc(), '1234.5'); assert.equal(d.view().text, '1,234.5');
  const e = run(calc(), '1.005 f 2'); assert.equal(e.view().text, '1.01'); // arredondamento decimal, não binário
  const f = run(calc(), '12345 f .'); assert.equal(f.view().text, '1.234500  04');
  const h = run(calc(), '1.5 eex 3'); assert.equal(h.x, 1500);
  const j = run(calc(), '123456789012'); assert.equal(j.entry.ip.length, 10);
});
test('TVM: FV, PMT, n, i, PV (modo END)', () => {
  const c = run(calc(), '12 n 1 i 1000 chs pv fv');
  near(X(c), 1126.8250301, 1e-6); near(c.fin.FV, 1126.8250301, 1e-6);
  const l = run(calc(), '10000 pv 12 n 1 i pmt'); near(X(l), -888.4878867, 1e-6);
  const n = run(calc(), '10000 pv 1 i 888.49 chs pmt n'); assert.equal(X(n), 12);
  const i = run(calc(), '12 n 10000 pv 888.4878867 chs pmt i'); near(X(i), 1, 1e-6);
  const p = run(calc(), '12 n 1 i 888.4878867 chs pmt pv'); near(X(p), 10000, 1e-4);
});
test('TVM: modo BEGIN e juros zero', () => {
  const c = run(calc(), '12 n 1 i 100 chs pmt g 7 pv');
  near(X(c), 100 * (1 - Math.pow(1.01, -12)) / 0.01 * 1.01, 1e-6); assert.ok(c.view().begin);
  const z = run(calc(), '10 n 0 i 100 chs pmt fv'); near(X(z), 1000);
});
test('TVM: n fracionário usa juros simples na fração (convenção da 12C)', () => {
  const c = run(calc(), '2.5 n 10 i 1000 chs pv fv');
  near(X(c), 1000 * (1 + 0.1 * 0.5) * 1.1 * 1.1, 1e-6);
  run(c, 'clx sto eex'); assert.equal(c.compound, true);
  const d = run(calc(), 'sto eex 2.5 n 10 i 1000 chs pv fv'); near(X(d), 1000 * Math.pow(1.1, 2.5), 1e-6);
});
test('taxa em modo a prazo: 12× e 12÷', () => {
  const c = run(calc(), '2 g n'); assert.equal(c.fin.n, 24);
  const d = run(calc(), '12 g i'); assert.equal(d.fin.i, 1);
});
test('fluxos de caixa: NPV e IRR (com Nj)', () => {
  const c = run(calc(), '1000 chs g pv 400 g pmt 3 g fv 10 i f pv');
  near(X(c), -1000 + 400 / 1.1 + 400 / 1.21 + 400 / 1.331, 1e-6);
  run(c, 'f fv'); // IRR
  const r = X(c); const npv = -1000 + [1, 2, 3].reduce((s, t) => s + 400 / Math.pow(1 + r / 100, t), 0); near(npv, 0, 1e-6);
  near(r, 9.7005, 1e-3);
  const d = run(calc(), '1000 chs g pv 400 g pmt 400 g pmt 400 g pmt f fv'); near(X(d), r, 1e-6);
  assert.equal(run(calc(), '100 g pv 50 g pmt f fv').view().text, 'Error 3'); // sem troca de sinal
});
test('AMORT', () => {
  const c = run(calc(), '12 n 1 i 10000 pv pmt'); c.fin.n = 0;
  run(c, '1 f n');
  near(c.st[0], -100, 1e-9); near(c.st[1], -788.4878867, 1e-6); near(c.fin.PV, 9211.5121133, 1e-6); assert.equal(c.fin.n, 1);
  const d = run(calc(), '12 n 1 i 10000 pv pmt'); d.fin.n = 0; run(d, '12 f n');
  near(d.fin.PV, 0, 0.12); near(d.st[0] + d.st[1], -888.4878867 * 12, 0.02);
});
test('juros simples (INT)', () => {
  const c = run(calc(), '60 n 9 i 450 chs pv f i'); near(X(c), 6.75);
  run(c, 'rcl pv +'); near(X(c), -443.25);
  const d = run(calc(), '60 n 9 i 450 chs pv f i xy'); near(X(d), 450 * 0.09 * 60 / 365, 1e-6);
});
test('depreciação SL, SOYD e DB', () => {
  const sl = run(calc(), '5 n 10000 pv 1000 fv 1 f pt'); near(X(sl), 1800); near(sl.st[1], 7200);
  const so = run(calc(), '5 n 10000 pv 1000 fv 1 f dp'); near(X(so), 3000); near(so.st[1], 6000);
  const db = run(calc(), '5 n 200 i 10000 pv 0 fv 2 f %'); near(X(db), 2400); near(db.st[1], 3600);
});
test('datas: ΔDYS e DATE (M.DY e D.MY)', () => {
  const c = run(calc(), 'g 5 1.012024 enter 12.312024 g eex'); assert.equal(X(c), 365); assert.equal(c.st[1], 360);
  const d = run(calc(), 'g 5 1.012024 enter 30 g chs'); near(X(d), 1.312024, 1e-9); assert.equal(d.view().text, '1-31-2024  3');
  const e = run(calc(), 'g 4 25.122024 enter 10 g chs'); near(X(e), 4.012025, 1e-9); // 25/12/2024 + 10 dias
  assert.equal(run(calc(), 'g 5 13.012024 enter 1 g chs').view().text, 'Error 8');
  assert.equal(run(calc(), 'g 5 2.292023 enter 1 g chs').view().text, 'Error 8'); // 29/02/2023 não existe
});
test('títulos: PRICE e YTM', () => {
  const c = run(calc(), 'g 5 6 i 6 pmt 6.152024 enter 12.152028 f yx'); near(X(c), 100, 1e-9); near(c.st[1], 0, 1e-9);
  const d = run(calc(), 'g 5 8 i 6 pmt 3.012024 enter 12.152028 f yx'); const price = X(d);
  assert.ok(price < 100 && price > 90);
  const e = run(calc(), 'g 5 6 pmt'); e.fin.PV = price; run(e, '3.012024 enter 12.152028 f inv'); near(X(e), 8, 1e-6);
});
test('estatística: Σ+, x̄, s, regressão, média ponderada', () => {
  const c = calc(); // pares (x,y): (1,2) (2,4) (3,6)
  run(c, '2 enter 1 sum 4 enter 2 sum 6 enter 3 sum'); assert.equal(X(c), 3);
  run(c, 'g 0'); assert.equal(c.st[0], 2); assert.equal(c.st[1], 4);
  run(c, 'clx g .'); near(c.st[0], 1); near(c.st[1], 2);
  run(c, 'clx 4 g 2'); near(c.st[0], 8); near(c.st[1], 1);           // ŷ,r para x=4
  run(c, 'clx 10 g 1'); near(c.st[0], 5);                             // x̂,r para y=10
  run(c, 'clx g 6'); near(c.st[0], (1 * 2 + 2 * 4 + 3 * 6) / 6);      // Σxy/Σx
  run(c, 'f sst'); assert.equal(c.regs[1], 0); assert.equal(run(calc(), 'g 0').view().text, 'Error 2');
});
test('registradores: STO/RCL, aritmética, R.n, memória', () => {
  const c = run(calc(), '5 sto 3 clx rcl 3'); assert.equal(X(c), 5);
  run(c, '2 sto + 3 rcl 3'); assert.equal(X(c), 7);
  run(c, '3 sto * 3 rcl 3'); assert.equal(X(c), 21);
  run(c, '9 sto . 4 clx rcl . 4'); assert.equal(X(c), 9);
  run(c, '123 sto n clx rcl n'); assert.equal(X(c), 123);
  assert.deepEqual(c.memInfo(), { lines: 8, regs: 20, used: 0 });
  run(c, 'f clx'); assert.equal(c.regs[3], 0); assert.equal(c.fin.n, 0);
});
test('classificação de sequências', () => {
  const k = HP12C.classify;
  assert.equal(k(['STO']), 'p'); assert.equal(k(['STO', '.']), 'p'); assert.equal(k(['STO', '.', '3']), 'c');
  assert.equal(k(['STO', 'add', '4']), 'c'); assert.equal(k(['STO', 'EEX']), 'c'); assert.equal(k(['RCL', 'g', 'PMT']), 'c');
  assert.equal(k(['g', 'Rd', '0']), 'p'); assert.equal(k(['g', 'Rd', '0', '5']), 'c'); assert.equal(k(['g', 'Rd', '.', '0', '1', '2']), 'c');
  assert.equal(k(['f', 'ON']), 'x'); assert.equal(k(['f', '3']), 'c'); assert.equal(k(['g', 'CHS']), 'c');
});

// ---------- programação ----------
function key(c, ...ts) { ts.forEach(t => c.press(t)); }
test('programação: gravar, exibir códigos e executar (fatorial com laço)', () => {
  const c = calc();
  key(c, 'f', 'RS');                                      // P/R
  assert.ok(c.prgm); assert.equal(c.view().text, '000-');
  const L = [['STO', '0'], ['1'], ['STO', '1'], ['RCL', '0'], ['g', 'CLx'], ['g', 'Rd', '1', '2'], ['STO', 'mul', '1'], ['RCL', '0'], ['1'], ['sub'],
    ['STO', '0'], ['g', 'Rd', '0', '3'], ['RCL', '1'], ['RS']];
  L.forEach(t => key(c, ...t));
  assert.equal(c.usedLines(), 14);
  assert.equal(c.prog[6].join(), 'g,Rd,1,2'); assert.equal(c.lineText(6), '006-  43 33 12'); assert.equal(c.lineText(1), '001-  44 0');
  key(c, 'f', 'RS'); assert.ok(!c.prgm);
  assert.deepEqual(c.memInfo(), { lines: 1, regs: 19, used: 14 });
  for (const [n, f] of [[5, 120], [0, 1], [7, 5040]]) {
    c.entry = null; c.st = [n, 0, 0, 0]; c.lift = true; c.pc = 0; c.runSync(); near(X(c), f);
  }
});
test('programação: GTO, SST/BST, CLEAR PRGM e erro de memória', () => {
  const c = calc();
  key(c, 'f', 'RS', '1', '2', '3');
  key(c, 'f', 'RS'); key(c, 'g', 'Rd', '0', '0'); assert.equal(c.pc, 0);
  c.keyDown('SST'); assert.equal(c.view().text, '001-  1'); c.keyUp(); assert.equal(c.pc, 1); // solta o SST: executa a linha 1
  assert.equal(c.view().text, '1');
  key(c, 'g', 'SST'); assert.equal(c.pc, 0); c.keyUp();
  key(c, 'f', 'RS', 'f', 'Rd'); assert.equal(c.usedLines(), 0); key(c, 'f', 'RS');
  key(c, 'f', 'RS'); for (let k = 0; k < 99; k++) key(c, '1'); assert.equal(c.usedLines(), 99);
  key(c, '1'); assert.equal(c.view().text, 'Error 4');
  assert.deepEqual(c.memInfo(), { lines: 0, regs: 7, used: 99 });
});
test('programação: PSE/IRR/finanças dentro de programa e persistência', () => {
  const c = calc();
  key(c, 'f', 'RS', '1', '0', '0', 'ENTER', '1', '0', 'add', 'RS', 'f', 'RS');
  c.pc = 0; c.runSync(); assert.equal(X(c), 110);
  const saved = JSON.parse(JSON.stringify(c.serialize())); const d = calc(); d.restore(saved);
  assert.equal(d.prog[1].join(), '1'); assert.equal(d.st[0], 110); assert.equal(d.usedLines(), 8);
});
test('MEM, PREFIX e ON', () => {
  const c = calc(); c.keyDown('g'); c.keyDown('9'); assert.equal(c.view().text, 'P-08 r-20'); c.keyUp(); assert.notEqual(c.view().text, 'P-08 r-20');
  run(c, '3.14159265358979'); c.press('f'); c.keyDown('ENTER'); assert.equal(c.view().text.trim().startsWith('3141592653'), true); c.keyUp();
  c.press('ON'); assert.equal(c.view().text, ''); c.press('ON'); assert.notEqual(c.view().text, '');
});
