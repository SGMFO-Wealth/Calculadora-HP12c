'use strict';
/*
 * Motor da HP 12C — pilha RPN de 4 níveis, funções financeiras, datas, estatística
 * e programação (99 linhas). Sem dependência de DOM: roda no navegador e no Node.
 *
 * Cada tecla tem um id: n i PV PMT FV CHS 7 8 9 div | yx inv pT dP pc EEX 4 5 6 mul |
 * RS SST Rd xy CLx ENTER 1 2 3 sub | ON f g STO RCL 0 . sum add
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HP12C = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  const FIN = ['n', 'i', 'PV', 'PMT', 'FV'];
  const OPS = ['add', 'sub', 'mul', 'div'];
  const isDigit = k => typeof k === 'string' && k.length === 1 && k >= '0' && k <= '9';

  // código de tecla (linha/coluna) mostrado no modo PRGM
  const CODE = { n: '11', i: '12', PV: '13', PMT: '14', FV: '15', CHS: '16', 7: '7', 8: '8', 9: '9', div: '10',
    yx: '21', inv: '22', pT: '23', dP: '24', pc: '25', EEX: '26', 4: '4', 5: '5', 6: '6', mul: '20',
    RS: '31', SST: '32', Rd: '33', xy: '34', CLx: '35', ENTER: '36', 1: '1', 2: '2', 3: '3', sub: '30',
    ON: '41', f: '42', g: '43', STO: '44', RCL: '45', 0: '0', '.': '48', sum: '49', add: '40' };

  const F_OK = new Set(['n', 'i', 'PV', 'PMT', 'FV', 'yx', 'inv', 'pT', 'dP', 'pc', 'RS', 'SST', 'Rd', 'xy', 'CLx', 'ENTER', '.',
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
  const G_OK = new Set(['n', 'i', 'PV', 'PMT', 'FV', 'CHS', '7', '8', '9', 'yx', 'inv', 'pT', 'dP', 'pc', 'EEX', '4', '5', '6',
    'RS', 'SST', 'xy', 'CLx', 'ENTER', '1', '2', '3', 'sub', '0', '.', 'sum']);

  /** Classifica uma sequência de teclas: 'c' completa, 'p' pendente, 'x' inválida. */
  function classify(t) {
    const a = t[0], n = t.length;
    if (n === 1) return (a === 'f' || a === 'g' || a === 'STO' || a === 'RCL') ? 'p' : 'c';
    if (a === 'f') return (n === 2 && F_OK.has(t[1])) ? 'c' : 'x';
    if (a === 'g') {
      if (t[1] === 'Rd') { // GTO
        const r = t.slice(2);
        if (r.length === 0) return 'p';
        if (r[0] === '.') {
          if (!r.slice(1).every(isDigit)) return 'x';
          return r.length < 4 ? 'p' : (r.length === 4 ? 'c' : 'x');
        }
        if (!r.every(isDigit)) return 'x';
        return r.length === 1 ? 'p' : (r.length === 2 ? 'c' : 'x');
      }
      return (n === 2 && G_OK.has(t[1])) ? 'c' : 'x';
    }
    const r = t.slice(1);
    if (a === 'STO') {
      let i = 0; if (OPS.includes(r[0])) i = 1;
      const rem = r.slice(i);
      if (rem.length === 0) return 'p';
      if (rem[0] === 'EEX') return (i === 0 && rem.length === 1) ? 'c' : 'x';
      if (FIN.includes(rem[0]) || isDigit(rem[0])) return rem.length === 1 ? 'c' : 'x';
      if (rem[0] === '.') return rem.length === 1 ? 'p' : (rem.length === 2 && isDigit(rem[1]) ? 'c' : 'x');
      return 'x';
    }
    if (a === 'RCL') {
      if (r[0] === 'g') {
        if (r.length === 1) return 'p';
        return (r.length === 2 && ['PV', 'PMT', 'FV'].includes(r[1])) ? 'c' : 'x';
      }
      if (FIN.includes(r[0]) || isDigit(r[0])) return r.length === 1 ? 'c' : 'x';
      if (r[0] === '.') return r.length === 1 ? 'p' : (r.length === 2 && isDigit(r[1]) ? 'c' : 'x');
      return 'x';
    }
    return 'x';
  }

  // ---------- números ----------
  const r12 = v => (!isFinite(v) || v === 0) ? v : Number(v.toPrecision(12));

  /** dígitos significativos (15) e expoente do primeiro dígito, para |v| > 0 */
  function digitsOf(v, sig) {
    if (v === 0) return { d: '0'.repeat(sig), e: 0 };
    const m = /^(\d)\.?(\d*)e([+-]\d+)$/.exec(v.toExponential(sig - 1));
    return { d: m[1] + m[2], e: parseInt(m[3], 10) };
  }
  /** arredondamento decimal "meio para cima" estilo calculadora; devolve {neg,int,frac} */
  function fixParts(v, dec) {
    const neg = v < 0; const a = Math.abs(v);
    const { d, e } = digitsOf(a, 15);
    let ip, fp;
    if (a === 0) { ip = '0'; fp = ''; }
    else if (e >= 0) { const all = d.padEnd(e + 1, '0'); ip = all.slice(0, e + 1); fp = all.slice(e + 1); }
    else { ip = '0'; fp = '0'.repeat(-e - 1) + d; }
    if (fp.length > dec) {
      const up = fp[dec] >= '5';
      fp = fp.slice(0, dec);
      if (up) {
        const total = (BigInt(ip + fp) + 1n).toString().padStart(ip.length + fp.length, '0');
        ip = total.slice(0, total.length - fp.length) || '0'; fp = total.slice(total.length - fp.length);
      }
    } else fp = fp.padEnd(dec, '0');
    ip = ip.replace(/^0+(?=\d)/, '');
    const zero = /^0*$/.test(ip + fp);
    return { neg: neg && !zero, ip, fp };
  }
  const roundDec = (v, dec) => { if (!isFinite(v)) return v; const p = fixParts(v, dec); return Number((p.neg ? '-' : '') + p.ip + (dec ? '.' + p.fp : '')); };
  const group = (ip, sep) => ip.replace(/\B(?=(\d{3})+(?!\d))/g, sep);

  // ---------- datas ----------
  const MIN_DN = Date.UTC(1582, 9, 15) / 864e5, MAX_DN = Date.UTC(4046, 11, 15) / 864e5;
  const dnOf = (y, m, d) => Math.round(Date.UTC(y, m - 1, d) / 864e5);
  const ymdOf = dn => { const t = new Date(dn * 864e5); return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }; };
  const days360 = (a, b) => { // método 30/360 (americano) usado pela 12C
    let d1 = a.d, d2 = b.d;
    if (d1 === 31) d1 = 30;
    if (d2 === 31 && d1 >= 30) d2 = 30;
    return 360 * (b.y - a.y) + 30 * (b.m - a.m) + (d2 - d1);
  };
  const monthsAdd = (p, k, day) => { // soma k meses mantendo o dia (ou o último dia do mês)
    const idx = p.y * 12 + (p.m - 1) + k; const y = Math.floor(idx / 12), m = idx % 12 + 1;
    const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return { y, m, d: Math.min(day, dim) };
  };
  const cmpYmd = (a, b) => (a.y - b.y) || (a.m - b.m) || (a.d - b.d);

  // ---------- a calculadora ----------
  class HP12C {
    constructor(opts) {
      this.opts = Object.assign({ comma: true }, opts || {});
      this.listeners = new Set();
      this.hardReset();
    }
    on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
    emit() { this.listeners.forEach(f => f(this)); }

    hardReset() {
      this.st = [0, 0, 0, 0]; this.lastX = 0;
      this.regs = new Array(20).fill(0);                 // R0–R9 e R.0–R.9
      this.fin = { n: 0, i: 0, PV: 0, PMT: 0, FV: 0 };
      this.cf = [0]; this.nj = [1];                      // CF0.. e Nj
      this.dec = 2; this.sci = false; this.begin = false; this.compound = false; this.dmy = false;
      this.prog = new Array(100).fill(null);            // linhas 1..99
      this.pc = 0; this.prgm = false;
      this.lift = true; this.entry = null; this.buf = []; this.err = null; this.lastFin = false;
      this.off = false; this.running = false; this.dateShow = null; this.overlay = null; this.held = null;
      this.skipHold = false;
    }

    serialize() {
      const o = {}; ['st', 'lastX', 'regs', 'fin', 'cf', 'nj', 'dec', 'sci', 'begin', 'compound', 'dmy', 'prog', 'pc', 'lift', 'off']
        .forEach(k => { o[k] = this[k]; });
      return JSON.parse(JSON.stringify(o));
    }
    restore(o) {
      this.hardReset();
      if (!o) return;
      ['st', 'lastX', 'regs', 'fin', 'cf', 'nj', 'dec', 'sci', 'begin', 'compound', 'dmy', 'prog', 'pc', 'lift', 'off']
        .forEach(k => { if (o[k] !== undefined) this[k] = o[k]; });
      this.prgm = false;
    }

    // ----- memória (programas ocupam registradores: cada 7 linhas = 1 registrador) -----
    usedLines() { let u = 0; for (let i = 99; i >= 1; i--) if (this.prog[i]) { u = i; break; } return u; }
    memInfo() {
      const u = this.usedLines(); const conv = u > 8 ? Math.ceil((u - 8) / 7) : 0;
      return { lines: 8 + 7 * conv - u, regs: 20 - conv, used: u };
    }

    // ----- entrada de números -----
    get x() { return this.entry ? this.entryValue() : this.st[0]; }
    entryValue() {
      const e = this.entry;
      const s = (e.neg ? '-' : '') + (e.ip || '0') + '.' + (e.fp || '0') + 'e' + (e.exp !== null ? (e.eneg ? '-' : '') + e.exp : '0');
      return parseFloat(s);
    }
    commit() { if (this.entry) { this.st[0] = this.entryValue(); this.entry = null; } }
    push() { this.st = [this.st[0], this.st[0], this.st[1], this.st[2]]; }
    loadX(v) { this.commit(); if (this.lift) this.st = [v, this.st[0], this.st[1], this.st[2]]; else this.st[0] = v; this.lift = true; }
    startEntry() {
      this.commit();
      if (this.lift) this.push();
      this.entry = { neg: false, ip: '', fp: null, exp: null, eneg: false };
    }
    digit(d) {
      if (!this.entry) this.startEntry();
      const e = this.entry;
      if (e.exp !== null) { e.exp = (e.exp + d).slice(-2); return; }
      if (e.fp === null && e.ip === '0') e.ip = '';
      const total = (e.fp !== null && e.ip === '0' ? 0 : e.ip.length) + (e.fp ? e.fp.length : 0);
      if (total >= 10) return;
      if (e.fp === null) e.ip += d; else e.fp += d;
    }
    dot() {
      if (!this.entry) this.startEntry();
      const e = this.entry; if (e.exp !== null || e.fp !== null) return;
      if (!e.ip) e.ip = '0'; e.fp = '';
    }
    eex() {
      if (!this.entry) { this.startEntry(); this.entry.ip = '1'; }
      if (this.entry.exp === null) this.entry.exp = '00';
    }
    backspace() {
      const e = this.entry;
      if (!e) { this.st[0] = 0; this.lift = false; return; }
      if (e.exp !== null) e.exp = null;
      else if (e.fp !== null) { if (e.fp.length) e.fp = e.fp.slice(0, -1); else e.fp = null; }
      else e.ip = e.ip.slice(0, -1);
      if (!e.ip && e.fp === null && e.exp === null) { this.entry = null; this.st[0] = 0; this.lift = false; }
    }

    // ----- erros -----
    error(n) { this.err = 'Error ' + n; this.entry = null; this.buf = []; this.running = false; this.dateShow = null; return false; }
    chk(v, code) { if (typeof v !== 'number' || !isFinite(v) || Math.abs(v) >= 1e100) return this.error(code === undefined ? 0 : code); return true; }

    // ----- operações de pilha -----
    unary(f) {
      this.commit(); const x = this.st[0]; const v = f(x);
      if (v === false || !this.chk(v)) return false;
      this.lastX = x; this.st[0] = r12(v); this.lift = true; return true;
    }
    binary(f) {
      this.commit(); const x = this.st[0], y = this.st[1]; const v = f(y, x);
      if (!this.chk(v)) return false;
      this.lastX = x; this.st = [r12(v), this.st[2], this.st[3], this.st[3]]; this.lift = true; return true;
    }
    pct(f) {
      this.commit(); const x = this.st[0], y = this.st[1]; const v = f(y, x);
      if (!this.chk(v)) return false;
      this.lastX = x; this.st[0] = r12(v); this.lift = true; return true;
    }

    // ----- financeiro: equação TVM -----
    /** devolve {A,B} tal que  A·PV + B·PMT + FV = 0  (A, B dependem de n, i e do modo) */
    tvmCoef(n, i) {
      const r = i / 100, b = this.begin ? 1 : 0;
      const frac = n - Math.floor(n);
      let m = n, accr = 1;
      if (!this.compound && Math.abs(frac) > 1e-12) { m = Math.floor(n); accr = 1 + r * frac; } // juros simples na fração (padrão da 12C)
      if (Math.abs(r) < 1e-14) return { A: accr, B: m };
      const g = Math.pow(1 + r, m);
      return { A: g * accr, B: (1 + r * b) * (g - 1) / r };
    }
    solveFin(key) {
      const F = this.fin;
      if (F.i <= -100 && key !== 'i') return this.error(5);
      const { A, B } = this.tvmCoef(F.n, F.i);
      if (key === 'PV') { if (A === 0) return this.error(5); return -(B * F.PMT + F.FV) / A; }
      if (key === 'FV') return -(A * F.PV + B * F.PMT);
      if (key === 'PMT') { if (B === 0) return this.error(5); return -(A * F.PV + F.FV) / B; }
      if (key === 'n') {
        const r = F.i / 100, b = this.begin ? 1 : 0;
        if (Math.abs(r) < 1e-14) { if (F.PMT === 0) return this.error(5); const v = -(F.PV + F.FV) / F.PMT; if (v < 0) return this.error(5); return Math.ceil(v - 1e-9); }
        const k = F.PMT * (1 + r * b) / r; const num = k - F.FV, den = F.PV + k;
        if (den === 0 || num / den <= 0) return this.error(5);
        const n = Math.log(num / den) / Math.log(1 + r);
        if (!isFinite(n) || n < 0) return this.error(5);
        return Math.ceil(n - 1e-9);
      }
      if (key === 'i') {
        const f = x => { const c = this.tvmCoef(F.n, x); return c.A * F.PV + c.B * F.PMT + F.FV; };
        if (F.n === 0) return this.error(5);
        const scale = Math.abs(F.PV) + Math.abs(F.PMT) + Math.abs(F.FV) + 1;
        if (Math.abs(f(0.5)) + Math.abs(f(5)) + Math.abs(f(50)) < 1e-9 * scale) return this.error(5);
        const root = this.findRoot(f, -99.99, 1e6);
        if (root === null) return this.error(5);
        return root;
      }
    }
    /** procura a raiz de f(x) mais próxima de 0 (preferindo positivas), x em %. */
    findRoot(f, lo, hi) {
      const pos = [], neg = [];
      for (let s = 1e-9; s <= hi; s *= 1.15) pos.push(s);
      for (let s = 1e-9; s <= -lo; s *= 1.2) neg.push(-s);
      const tryList = list => {
        let prev = 0, fp = f(0);
        if (fp === 0) return 0;
        for (const x of list) {
          const fx = f(x);
          if (isFinite(fx) && isFinite(fp) && fp * fx <= 0) {
            let a = prev, b = x, fa = fp;
            for (let k = 0; k < 200; k++) { const m = (a + b) / 2, fm = f(m); if (fa * fm <= 0) b = m; else { a = m; fa = fm; } if (Math.abs(b - a) < 1e-13 * Math.max(1, Math.abs(m))) break; }
            return (a + b) / 2;
          }
          prev = x; fp = fx;
        }
        return null;
      };
      const rp = tryList(pos); if (rp !== null) return rp;
      return tryList(neg);
    }
    finKey(key, was) {
      if (was && !this.entry) {
        const v = this.solveFin(key); if (v === false || v === undefined) return;
        if (!this.chk(v, 5)) return;
        this.fin[key] = r12(v); this.loadX(r12(v));
        this.lastFin = true;
      } else {
        this.commit(); this.fin[key] = this.st[0]; this.lift = true; this.lastFin = true;
      }
    }

    // ----- fluxos de caixa -----
    npvAt(rate) {
      const r = rate / 100; let v = this.cf[0], t = 1;
      for (let j = 1; j < this.cf.length; j++) for (let k = 0; k < this.nj[j]; k++) { v += this.cf[j] / Math.pow(1 + r, t); t++; }
      return v;
    }
    irr() {
      const m = this.cf.length - 1;
      if (m < 1) return this.error(3);
      const all = [this.cf[0], ...this.cf.slice(1)];
      if (!(all.some(v => v > 0) && all.some(v => v < 0))) return this.error(3);
      const root = this.findRoot(x => this.npvAt(x), -99.99, 1e6);
      if (root === null) return this.error(7);
      return root;
    }

    // ----- amortização, juros simples, depreciação, títulos -----
    amort(x) {
      this.commit();
      const k = Math.round(x);
      if (!(k >= 0) || k > 1e4) return this.error(5);
      const F = this.fin, i = F.i / 100; let bal = F.PV, totI = 0, totP = 0;
      for (let j = 0; j < k; j++) {
        const first = this.begin && (F.n + j) === 0;
        const I = first ? 0 : roundDec(-bal * i, this.dec);
        const P = F.PMT - I;
        totI += I; totP += P; bal += P;
      }
      this.lastX = k; F.PV = r12(bal); F.n += k;
      this.st = [r12(totI), r12(totP), k, this.st[2]]; this.lift = true;
    }
    interest() {
      this.commit(); const F = this.fin;
      const i360 = r12(-F.PV * F.i * F.n / 36000), i365 = r12(-F.PV * F.i * F.n / 36500);
      this.st = [i360, i365, this.st[0], this.st[1]]; this.lift = true;
    }
    deprec(kind) {
      this.commit(); const F = this.fin, j = this.st[0];
      if (!(j >= 1) || j !== Math.floor(j) || !(F.n >= 1) || j > F.n) return this.error(5);
      const base = F.PV - F.FV; let D;
      if (kind === 'SL') D = base / F.n;
      else if (kind === 'SOYD') D = base * (F.n - j + 1) * 2 / (F.n * (F.n + 1));
      else {
        let B = F.PV, last = 0;
        for (let k = 1; k <= j; k++) { last = Math.max(0, Math.min(B * (F.i / 100) / F.n, B - F.FV)); B -= last; }
        D = last; this.lastX = j; this.st = [r12(D), r12(B - F.FV), this.st[1], this.st[2]]; this.lift = true; return;
      }
      let rdv;
      if (kind === 'SL') rdv = base - D * j;
      else { let s = 0; for (let k = 1; k <= j; k++) s += base * (F.n - k + 1) * 2 / (F.n * (F.n + 1)); rdv = base - s; }
      this.lastX = j; this.st = [r12(D), r12(rdv), this.st[1], this.st[2]]; this.lift = true;
    }

    parseDate(v) {
      if (!(v > 0)) { this.error(8); return null; }
      const s = v.toFixed(6), [a, f] = s.split('.');
      const dd = parseInt(f.slice(0, 2), 10), yy = parseInt(f.slice(2), 10), aa = parseInt(a, 10);
      const m = this.dmy ? dd : aa, d = this.dmy ? aa : dd;
      if (m < 1 || m > 12 || d < 1 || d > 31 || yy < 1582 || yy > 4046) { this.error(8); return null; }
      const dn = dnOf(yy, m, d); const back = ymdOf(dn);
      if (back.d !== d || back.m !== m || dn < MIN_DN || dn > MAX_DN) { this.error(8); return null; }
      return { y: yy, m, d, dn };
    }
    dateNum(dn) {
      const { y, m, d } = ymdOf(dn);
      return this.dmy ? d + m / 100 + y / 1e6 : m + d / 100 + y / 1e6;
    }
    dateText(dn) {
      const { y, m, d } = ymdOf(dn); const wd = (new Date(dn * 864e5).getUTCDay() + 6) % 7 + 1;
      return (this.dmy ? `${d}-${m}-${y}` : `${m}-${d}-${y}`) + '  ' + wd;
    }
    fnDate() {
      this.commit(); const days = this.st[0], dt = this.parseDate(this.st[1]); if (!dt) return;
      if (days !== Math.trunc(days)) return this.error(8);
      const dn = dt.dn + days; if (dn < MIN_DN || dn > MAX_DN) return this.error(8);
      this.lastX = days; this.st = [this.dateNum(dn), this.st[2], this.st[3], this.st[3]]; this.lift = true; this.dateShow = this.dateText(dn);
    }
    fnDys() {
      this.commit(); const d2 = this.parseDate(this.st[0]); if (!d2) return;
      const d1 = this.parseDate(this.st[1]); if (!d1) return;
      this.lastX = this.st[0];
      this.st = [d2.dn - d1.dn, days360(d1, d2), this.st[2], this.st[3]]; this.lift = true;
    }
    bondInfo(S, M) {
      // datas de cupom (semestrais) retroagindo a partir do vencimento
      let k = 0, pcd = { y: M.y, m: M.m, d: M.d };
      let next = pcd; let cur = pcd;
      while (cmpYmd(cur, S) > 0) { next = cur; k++; cur = monthsAdd(M, -6 * k, M.d); }
      const N = k; const A = days360(cur, S); const E = 180;
      return { N, A, DSC: E - A, E };
    }
    bondPrice(S, M, cpn, yld) {
      const { N, A, DSC, E } = this.bondInfo(S, M); const c = cpn / 2, y = 1 + yld / 200;
      let p = 0;
      for (let k = 1; k <= N; k++) p += c / Math.pow(y, k - 1 + DSC / E);
      p += 100 / Math.pow(y, N - 1 + DSC / E);
      const acc = c * A / E;
      return { price: p - acc, acc };
    }
    fnPrice() {
      this.commit(); const M = this.parseDate(this.st[0]); if (!M) return; const S = this.parseDate(this.st[1]); if (!S) return;
      if (S.dn >= M.dn) return this.error(8);
      const r = this.bondPrice(S, M, this.fin.PMT, this.fin.i);
      if (!this.chk(r.price, 5)) return;
      this.lastX = this.st[0]; this.st = [r12(r.price), r12(r.acc), this.st[2], this.st[3]]; this.lift = true;
    }
    fnYtm() {
      this.commit(); const M = this.parseDate(this.st[0]); if (!M) return; const S = this.parseDate(this.st[1]); if (!S) return;
      if (S.dn >= M.dn) return this.error(8);
      const target = this.fin.PV, cpn = this.fin.PMT;
      const f = y => this.bondPrice(S, M, cpn, y).price - target;
      let lo = -99, hi = 1000, flo = f(lo), fhi = f(hi);
      if (!(flo * fhi <= 0)) return this.error(5);
      for (let k = 0; k < 300; k++) { const m = (lo + hi) / 2, fm = f(m); if (flo * fm <= 0) { hi = m; fhi = fm; } else { lo = m; flo = fm; } if (hi - lo < 1e-12) break; }
      const y = (lo + hi) / 2;
      this.lastX = this.st[0]; this.st = [r12(y), this.st[1], this.st[2], this.st[3]]; this.lift = true;
    }

    // ----- estatística (R1=n R2=Σx R3=Σx² R4=Σy R5=Σy² R6=Σxy) -----
    sigma(sign) {
      this.commit(); const x = this.st[0], y = this.st[1], R = this.regs;
      R[1] += sign; R[2] += sign * x; R[3] += sign * x * x; R[4] += sign * y; R[5] += sign * y * y; R[6] += sign * x * y;
      this.lastX = x; this.st[0] = R[1]; this.lift = false;
    }
    stat2(a, b) { this.commit(); this.lift = true; this.st = [a, b, this.st[0], this.st[1]]; }
    fnMean() { const R = this.regs; if (R[1] < 1) return this.error(2); this.commit(); this.lastX = this.st[0]; this.stat2(r12(R[2] / R[1]), r12(R[4] / R[1])); }
    fnStd() {
      const R = this.regs; if (R[1] < 2) return this.error(2);
      const n = R[1], vx = (R[3] - R[2] * R[2] / n) / (n - 1), vy = (R[5] - R[4] * R[4] / n) / (n - 1);
      this.commit(); this.lastX = this.st[0]; this.stat2(r12(Math.sqrt(Math.max(0, vx))), r12(Math.sqrt(Math.max(0, vy))));
    }
    fnWMean() { const R = this.regs; if (R[1] < 1 || R[2] === 0) return this.error(2); this.commit(); this.lastX = this.st[0]; this.lift = true; this.st[0] = r12(R[6] / R[2]); }
    fnLinEst(wantY) {
      const R = this.regs, n = R[1]; if (n < 2) return this.error(2);
      const sxx = n * R[3] - R[2] * R[2], syy = n * R[5] - R[4] * R[4], sxy = n * R[6] - R[2] * R[4];
      if (sxx === 0 || syy === 0 && wantY === false) return this.error(2);
      const b = sxy / sxx, a = (R[4] - b * R[2]) / n; const rr = sxy / Math.sqrt(sxx * syy);
      this.commit(); const v = this.st[0];
      let est; if (wantY) est = a + b * v; else { if (b === 0) return this.error(2); est = (v - a) / b; }
      if (!isFinite(rr) || !isFinite(est)) return this.error(2);
      this.lastX = v; this.st = [r12(est), r12(rr), this.st[1], this.st[2]]; this.lift = true;
    }

    // ----- registradores de armazenamento -----
    regIndex(tokens) { // ['3'] ou ['.', '3']
      const idx = tokens[0] === '.' ? 10 + Number(tokens[1]) : Number(tokens[0]);
      if (idx >= this.memInfo().regs) { this.error(3); return null; }
      return idx;
    }
    stoTokens(r) {
      let op = null; if (OPS.includes(r[0])) op = r.shift();
      this.commit();
      if (r[0] === 'EEX') { this.compound = !this.compound; return; }
      const x = this.st[0];
      if (op === 'div' && x === 0) return this.error(0);
      const apply = (cur) => op === 'add' ? cur + x : op === 'sub' ? cur - x : op === 'mul' ? cur * x : op === 'div' ? cur / x : x;
      if (FIN.includes(r[0])) { const v = apply(this.fin[r[0]]); if (!this.chk(v)) return; this.fin[r[0]] = op ? r12(v) : v; return; }
      const idx = this.regIndex(r); if (idx === null) return;
      const v = apply(this.regs[idx]); if (!this.chk(v, 1)) return; this.regs[idx] = op ? r12(v) : v;
    }
    rclTokens(r) {
      if (r[0] === 'g') {
        const j = this.fin.n;
        if (r[1] === 'PV') return this.loadX(this.cf[0]);
        if (!(j >= 1 && j < this.cf.length)) return this.error(6);
        if (r[1] === 'PMT') return this.loadX(this.cf[j]);
        this.loadX(this.nj[j]); this.fin.n = j - 1; return;
      }
      if (FIN.includes(r[0])) return this.loadX(this.fin[r[0]]);
      const idx = this.regIndex(r); if (idx === null) return;
      this.loadX(this.regs[idx]);
    }

    // ----- exibição -----
    fmtNum(v) {
      if (!isFinite(v)) return 'Error 0';
      const sep = this.opts.comma ? ['.', ','] : [',', '.'];
      const sciStr = (digits) => {
        const a = Math.abs(v); if (a === 0) return '0' + (digits ? sep[1] + '0'.repeat(digits) : '') + '  00';
        let { d, e } = digitsOf(a, 15); let keep = digits + 1;
        let mant = BigInt(d.slice(0, keep)); if (d[keep] >= '5') mant += 1n;
        let ms = mant.toString(); if (ms.length > keep) { ms = ms.slice(0, keep); e += 1; }
        const ex = (e < 0 ? '-' : ' ') + String(Math.abs(e)).padStart(2, '0');
        return (v < 0 ? '-' : '') + ms[0] + (digits ? sep[1] + ms.slice(1) : '') + ' ' + ex;
      };
      if (this.sci) return sciStr(6);
      const a = Math.abs(v);
      if (a >= 1e10) return sciStr(6);
      let dec = this.dec; const intDigits = a < 1 ? 1 : Math.floor(Math.log10(a)) + 1;
      if (intDigits + dec > 10) dec = Math.max(0, 10 - intDigits);
      const p = fixParts(v, dec);
      if (p.ip.length > 10) return sciStr(6);
      return (p.neg ? '-' : '') + group(p.ip, sep[0]) + (dec ? sep[1] + p.fp : '');
    }
    entryText() {
      const e = this.entry, sep = this.opts.comma ? ['.', ','] : [',', '.'];
      let s = (e.neg ? '-' : '') + group(e.ip || '0', sep[0]);
      if (e.fp !== null) s += sep[1] + e.fp;
      if (e.exp !== null) s += ' ' + (e.eneg ? '-' : ' ') + e.exp;
      return s;
    }
    lineText(n) {
      const label = String(n).padStart(3, '0') + '-';
      if (n === 0) return label;
      const t = this.prog[n];
      if (!t) return label + '  43 33 00';
      const parts = t.map(k => CODE[k] !== undefined ? CODE[k] : k);
      if (t[0] === 'g' && t[1] === 'Rd') return label + '  43 33 ' + t.slice(2).join('').padStart(2, '0');
      return label + '  ' + parts.join(' ');
    }
    mantissaText() {
      const v = this.x; if (v === 0) return '0000000000';
      const { d, e } = digitsOf(Math.abs(v), 15); let m = BigInt(d.slice(0, 10)); if (d[10] >= '5') m += 1n;
      const s = m.toString().slice(0, 10);
      return (v < 0 ? '-' : '') + s + '  ' + (e < 0 ? '-' : ' ') + String(Math.abs(e)).padStart(2, '0');
    }
    view() {
      const f = this.buf[0] === 'f', g = this.buf[0] === 'g' || (this.buf[0] === 'RCL' && this.buf[1] === 'g');
      const base = { f, g, begin: this.begin, dmy: this.dmy, c: this.compound, prgm: this.prgm, running: this.running, off: this.off };
      if (this.off) return Object.assign(base, { text: '', f: false, g: false, begin: false, dmy: false, c: false, prgm: false });
      let text;
      if (this.overlay) text = this.overlay;
      else if (this.err) text = this.err;
      else if (this.running) text = 'running';
      else if (this.prgm) text = this.lineText(this.pc);
      else if (this.dateShow) text = this.dateShow;
      else if (this.entry) text = this.entryText();
      else text = this.fmtNum(this.st[0]);
      return Object.assign(base, { text });
    }

    // ----- teclas -----
    /** pressionar e soltar */
    press(key) { this.keyDown(key); this.keyUp(); }

    keyDown(key) {
      if (this.running) { this.running = false; this.emit(); return; }
      if (this.off) { if (key === 'ON') { this.off = false; this.emit(); } return; }
      if (key === 'ON') { if (!this.buf.length) { this.off = true; this.buf = []; this.emit(); } else { this.buf = []; this.emit(); } return; }
      if (this.err) { this.err = null; this.buf = []; this.emit(); return; }
      this.overlay = null;
      if (this.dateShow && !(key === 'f' || key === 'g')) this.dateShow = null;

      // f/g repetidas cancelam ou trocam o prefixo
      if (this.buf.length === 1 && (this.buf[0] === 'f' || this.buf[0] === 'g') && (key === 'f' || key === 'g')) {
        this.buf = this.buf[0] === key ? [] : [key]; this.emit(); return;
      }
      const t = [...this.buf, key]; const c = classify(t);
      if (c === 'p') { this.buf = t; this.emit(); return; }
      this.buf = [];
      if (c === 'x') { this.emit(); return; }

      // teclas que mantêm uma exibição enquanto pressionadas
      const s = t.join(',');
      if (!this.prgm && s === 'SST') { this.held = { kind: 'sst' }; this.overlay = this.lineText(Math.min(99, this.pc + 1)); this.emit(); return; }
      if (!this.prgm && s === 'g,SST') { this.pc = Math.max(0, this.pc - 1); this.held = { kind: 'bst' }; this.overlay = this.lineText(this.pc); this.emit(); return; }
      if (s === 'g,9') { const m = this.memInfo(); this.overlay = 'P-' + String(m.lines).padStart(2, '0') + ' r-' + String(m.regs).padStart(2, '0'); this.held = { kind: 'ovl' }; this.emit(); return; }
      if (s === 'f,ENTER') { this.overlay = this.mantissaText(); this.held = { kind: 'ovl' }; this.emit(); return; }
      this.dispatch(t); this.emit();
    }
    keyUp() {
      const h = this.held; this.held = null;
      if (!h) return;
      this.overlay = null;
      if (h.kind === 'sst') {
        if (this.pc >= 99) { this.pc = 0; this.emit(); return; }
        this.pc++; const t = this.prog[this.pc];
        if (!t) { this.pc = 0; this.emit(); return; }
        const was = this.running; this.execProg(t); this.running = was; // execução de um passo
      }
      this.emit();
    }

    dispatch(t) {
      const s = t.join(',');
      if (this.prgm) {
        // modo PRGM: teclas de controle atuam; as demais são gravadas
        if (s === 'f,RS') { this.prgm = false; return; }
        if (s === 'f,Rd') { this.prog.fill(null); this.pc = 0; return; }
        if (s === 'SST') { this.pc = Math.min(99, this.pc + 1); return; }
        if (s === 'g,SST') { this.pc = Math.max(0, this.pc - 1); return; }
        if (t[0] === 'g' && t[1] === 'Rd' && t[2] === '.') { const n = Number(t.slice(3).join('')); if (n > 99) return this.error(4); this.pc = n; return; }
        if (s === 'ON') return;
        if (this.pc >= 99) return this.error(4);
        const copy = t.slice();
        this.pc++; this.prog[this.pc] = copy;
        if (this.usedLines() > 99) return this.error(4);
        return;
      }
      if (s === 'f,RS') { this.commit(); this.prgm = true; return; }
      if (s === 'RS') { this.startRun(); return; }
      if (t[0] === 'g' && t[1] === 'Rd') { // GTO
        const n = t[2] === '.' ? Number(t.slice(3).join('')) : Number(t.slice(2).join(''));
        if (n > 99) return this.error(4);
        this.pc = n; return;
      }
      this.exec(t);
    }

    /** executa uma instrução completa (modo normal ou dentro de programa) */
    exec(t) {
      const a = t[0];
      const was = this.lastFin;
      // CHS, BEG/END, D.MY/M.DY e FIX/SCI não interrompem uma sequência de teclas financeiras
      const keep = (t.length === 1 && a === 'CHS') || (a === 'g' && ['7', '8', '4', '5'].includes(t[1])) || (a === 'f' && (isDigit(t[1]) || t[1] === '.'));
      this.lastFin = keep ? was : false;
      if (t.length === 1) return this.key1(a, was);
      if (a === 'f') return this.keyF(t[1]);
      if (a === 'g') return this.keyG(t[1], t);
      if (a === 'STO') { this.lastFin = was; return this.stoTokens(t.slice(1)); }
      if (a === 'RCL') { this.lastFin = was; return this.rclTokens(t.slice(1)); }
    }

    key1(k, was) {
      if (isDigit(k)) return this.digit(k);
      switch (k) {
        case '.': return this.dot();
        case 'EEX': return this.eex();
        case 'CHS':
          if (this.entry) { if (this.entry.exp !== null) this.entry.eneg = !this.entry.eneg; else this.entry.neg = !this.entry.neg; }
          else this.st[0] = -this.st[0];
          return;
        case 'ENTER': this.commit(); this.push(); this.lift = false; return;
        case 'CLx': this.entry = null; this.st[0] = 0; this.lift = false; return;
        case 'xy': this.commit(); this.st = [this.st[1], this.st[0], this.st[2], this.st[3]]; this.lift = true; return;
        case 'Rd': this.commit(); this.st = [this.st[1], this.st[2], this.st[3], this.st[0]]; this.lift = true; return;
        case 'add': return this.binary((y, x) => y + x);
        case 'sub': return this.binary((y, x) => y - x);
        case 'mul': return this.binary((y, x) => y * x);
        case 'div': return this.binary((y, x) => x === 0 ? NaN : y / x);
        case 'yx': return this.binary((y, x) => (y === 0 && x <= 0) ? NaN : (y < 0 && x !== Math.floor(x)) ? NaN : Math.pow(y, x));
        case 'inv': return this.unary(x => x === 0 ? NaN : 1 / x);
        case 'pc': return this.pct((y, x) => y * x / 100);
        case 'dP': return this.pct((y, x) => y === 0 ? NaN : (x - y) / y * 100);
        case 'pT': return this.pct((y, x) => y === 0 ? NaN : x / y * 100);
        case 'sum': return this.sigma(1);
        case 'RS': case 'SST': return;
        case 'n': case 'i': case 'PV': case 'PMT': case 'FV': return this.finKey(k, was);
      }
    }
    keyF(k) {
      if (isDigit(k)) { this.commit(); this.dec = Number(k); this.sci = false; return; }
      switch (k) {
        case '.': this.commit(); this.sci = true; return;
        case 'n': return this.amort(this.x);
        case 'i': return this.interest();
        case 'PV': { this.commit(); const v = this.npvAt(this.fin.i); if (!this.chk(v)) return; this.lastX = this.st[0]; this.st[0] = r12(v); this.lift = true; return; }
        case 'PMT': this.commit(); this.lastX = this.st[0]; this.st[0] = roundDec(this.st[0], this.dec); this.lift = true; return;
        case 'FV': { this.commit(); const v = this.irr(); if (v === false) return; this.commit(); this.lastX = this.st[0]; this.loadX(r12(v)); return; }
        case 'yx': return this.fnPrice();
        case 'inv': return this.fnYtm();
        case 'pT': return this.deprec('SL');
        case 'dP': return this.deprec('SOYD');
        case 'pc': return this.deprec('DB');
        case 'SST': for (let i = 1; i <= 6; i++) this.regs[i] = 0; this.st = [0, 0, 0, 0]; this.entry = null; this.lift = true; return;
        case 'Rd': this.pc = 0; return;
        case 'xy': this.fin = { n: 0, i: 0, PV: 0, PMT: 0, FV: 0 }; this.cf = [0]; this.nj = [1]; return;
        case 'CLx': this.regs.fill(0); this.fin = { n: 0, i: 0, PV: 0, PMT: 0, FV: 0 }; this.cf = [0]; this.nj = [1];
          this.st = [0, 0, 0, 0]; this.lastX = 0; this.entry = null; this.lift = true; return;
        case 'ENTER': this.overlay = this.mantissaText(); this.heldTimer(); return;
        default: return;
      }
    }
    keyG(k, t) {
      switch (k) {
        case 'n': this.commit(); { const v = r12(this.st[0] * 12); if (!this.chk(v, 5)) return; this.fin.n = v; this.st[0] = v; this.lift = true; this.lastFin = true; } return;
        case 'i': this.commit(); { const v = r12(this.st[0] / 12); this.fin.i = v; this.st[0] = v; this.lift = true; this.lastFin = true; } return;
        case 'PV': this.commit(); this.cf = [this.st[0]]; this.nj = [1]; this.fin.n = 0; this.lift = true; return;
        case 'PMT': this.commit(); if (this.cf.length > 20) return this.error(6);
          this.cf.push(this.st[0]); this.nj.push(1); this.fin.n = this.cf.length - 1; this.lift = true; return;
        case 'FV': this.commit(); { const v = this.st[0]; if (this.cf.length < 2 || v !== Math.floor(v) || v < 1 || v > 99) return this.error(6);
          this.nj[this.nj.length - 1] = v; this.lift = true; } return;
        case 'CHS': return this.fnDate();
        case '7': this.begin = true; return;
        case '8': this.begin = false; return;
        case '9': { const m = this.memInfo(); this.overlay = 'P-' + String(m.lines).padStart(2, '0') + ' r-' + String(m.regs).padStart(2, '0'); this.heldTimer(); return; }
        case 'yx': return this.unary(x => x < 0 ? NaN : Math.sqrt(x));
        case 'inv': return this.unary(x => Math.exp(x));
        case 'pT': return this.unary(x => x <= 0 ? NaN : Math.log(x));
        case 'dP': return this.unary(x => (x < 0 ? -1 : 1) * (Math.abs(x) - Math.floor(Math.abs(x))));
        case 'pc': return this.unary(x => Math.trunc(x));
        case 'EEX': return this.fnDys();
        case '4': this.dmy = true; return;
        case '5': this.dmy = false; return;
        case '6': return this.fnWMean();
        case 'RS': this.commit(); return; // PSE: tratada na execução do programa
        case 'SST': this.pc = Math.max(0, this.pc - 1); return;
        case 'xy': case 'CLx': this.commit(); return; // testes só têm efeito dentro de programa
        case 'ENTER': this.loadX(this.lastX); return;
        case '1': return this.fnLinEst(false);
        case '2': return this.fnLinEst(true);
        case '3': return this.unary(x => (x < 0 || x !== Math.floor(x) || x > 69) ? NaN : (() => { let r = 1; for (let k2 = 2; k2 <= x; k2++) r *= k2; return r; })());
        case 'sub': this.backspace(); return;
        case '0': return this.fnMean();
        case '.': return this.fnStd();
        case 'sum': return this.sigma(-1);
        default: return;
      }
    }
    heldTimer() { clearTimeout(this._ot); this._ot = setTimeout(() => { this.overlay = null; this.emit(); }, 1400); }

    // ----- programa -----
    startRun() {
      if (this.running) return;
      this.commit(); this.running = true; this.emit();
      this.runLoop();
    }
    /** execução assíncrona em lotes (permite parar com qualquer tecla) */
    runLoop() {
      const batch = () => {
        let n = 0; this.pause = false;
        while (this.running && n++ < 400) {
          if (!this.stepLine()) { this.running = false; break; }
          if (this.pause) break;
        }
        if (this.running) {
          if (this.pause) { this.overlay = this.err ? null : this.fmtNum(this.st[0]); this.emit(); setTimeout(() => { this.overlay = null; batch(); }, 1000); }
          else setTimeout(batch, 0);
        } else { this.emit(); }
      };
      batch();
    }
    /** versão síncrona (testes) */
    runSync(max) {
      this.commit(); this.running = true; let n = 0; max = max || 1e6;
      while (this.running && n++ < max) { if (!this.stepLine()) break; }
      this.running = false;
    }
    stepLine() {
      this.pc++;
      if (this.pc > 99) { this.pc = 0; return false; }
      const t = this.prog[this.pc];
      if (!t) { this.pc = 0; return false; }
      return this.execProg(t);
    }
    execProg(t) {
      const s = t.join(',');
      if (s === 'RS') return false;
      if (t[0] === 'g' && t[1] === 'Rd') {
        const n = Number(t.slice(2).join(''));
        if (n === 0) { this.pc = 0; return false; }
        this.pc = n; return true;
      }
      if (s === 'g,xy') { this.commit(); if (!(this.st[0] <= this.st[1])) this.pc++; return true; }
      if (s === 'g,CLx') { this.commit(); if (!(this.st[0] === 0)) this.pc++; return true; }
      if (s === 'g,RS') { this.commit(); this.pause = true; return true; }
      if (s === 'f,RS') return true;
      if (s === 'SST' || s === 'g,SST' || s === 'f,Rd') return true;
      this.exec(t);
      return !this.err;
    }
  }

  HP12C.classify = classify;
  HP12C.roundDec = roundDec;
  HP12C.CODE = CODE;
  return HP12C;
});
