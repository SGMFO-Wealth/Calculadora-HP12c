'use strict';
// Gera build/icon.png (512x512) desenhando a calculadora em SVG e capturando com o Electron.
// Uso: npx electron scripts/make-icon.js
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

function svg() {
  const keys = [];
  const cols = 4, rows = 3, x0 = 76, y0 = 232, kw = 66, kh = 44, gx = 16, gy = 20;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = x0 + c * (kw + gx), y = y0 + r * (kh + gy);
    let fill = '#2b2b2f';
    if (r === 2 && c === 1) fill = '#e8a12a'; if (r === 2 && c === 2) fill = '#2aa6b6';
    keys.push(`<rect x="${x}" y="${y}" width="${kw}" height="${kh}" rx="8" fill="${fill}" stroke="#050506" stroke-width="3"/>` +
      `<rect x="${x + 4}" y="${y + 3}" width="${kw - 8}" height="6" rx="3" fill="#ffffff" opacity=".13"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#efebde"/><stop offset=".5" stop-color="#e4dfcc"/><stop offset="1" stop-color="#d8d2bc"/></linearGradient>
    <linearGradient id="lcd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b8c0b4"/><stop offset="1" stop-color="#c5ccc0"/></linearGradient>
    <linearGradient id="body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#34343a"/><stop offset="1" stop-color="#121214"/></linearGradient>
  </defs>
  <rect x="16" y="64" width="480" height="384" rx="40" fill="url(#body)" stroke="#000" stroke-width="4"/>
  <rect x="40" y="86" width="432" height="112" rx="10" fill="url(#gold)"/>
  <rect x="72" y="104" width="250" height="74" rx="8" fill="#dc9a52"/>
  <rect x="78" y="110" width="238" height="62" rx="5" fill="url(#lcd)"/>
  <text x="304" y="162" text-anchor="end" font-family="Consolas, monospace" font-weight="700" font-size="52" font-style="italic" fill="#2a2a2a">12,00</text>
  <rect x="396" y="108" width="56" height="64" rx="6" fill="#1b1912" stroke="#7a6c42" stroke-width="3"/>
  <rect x="402" y="114" width="44" height="34" rx="5" fill="#cdbd7a"/>
  <text x="424" y="140" text-anchor="middle" font-family="Georgia, serif" font-weight="900" font-style="italic" font-size="26" fill="#2b2410">hp</text>
  <rect x="58" y="214" width="396" height="214" rx="12" fill="#0d0d0d" stroke="#8f8668" stroke-width="3"/>
  ${keys.join('\n  ')}
  <rect x="396" y="232" width="52" height="172" rx="8" fill="#2b2b2f" stroke="#050506" stroke-width="3"/>
  <rect x="400" y="236" width="44" height="6" rx="3" fill="#ffffff" opacity=".13"/>
</svg>`;
}

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 512, height: 512, show: false, transparent: true, frame: false, webPreferences: { offscreen: false } });
  const html = `<html><body style="margin:0;background:transparent">${svg()}</body></html>`;
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  await new Promise(r => setTimeout(r, 400));
  const img = await win.webContents.capturePage({ x: 0, y: 0, width: 512, height: 512 });
  const out = path.join(__dirname, '..', 'build', 'icon.png');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, img.toPNG());
  console.log('icone gerado:', out, img.getSize());
  app.exit(0);
});
