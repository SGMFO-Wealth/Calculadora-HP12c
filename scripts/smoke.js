'use strict';
// Teste de fumaça: abre o app de verdade, aperta teclas, salva capturas de tela e fecha.
// Uso: npx electron scripts/smoke.js <pasta-de-saida>
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const out = process.argv[2] || path.join(__dirname, '..', 'smoke-out');
fs.mkdirSync(out, { recursive: true });
app.setPath('userData', path.join(out, 'userdata'));

const results = [];
app.on('browser-window-created', (_e, win) => {
  win.webContents.once('did-finish-load', async () => {
    const js = code => win.webContents.executeJavaScript(code);
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const shot = async name => { await wait(250); const img = await win.webContents.capturePage(); fs.writeFileSync(path.join(out, name + '.png'), img.toPNG()); };
    try {
      win.setSize(780, 600); await wait(500);
      results.push(['api', await js('typeof window.hp12c + "/" + typeof window.__hp')]);
      await js(`(() => { const e = window.__hp; e.hardReset(); ['1','0','0','0','ENTER','1','2','add'].forEach(k => e.press(k)); })()`);
      results.push(['1000 ENTER 12 +', await js('window.__hp.view().text')]);
      await shot('01-soma');
      await js(`(() => { const e = window.__hp; e.hardReset(); const P=(...k)=>k.forEach(x=>e.press(x));
        P('1','2','n','1','i','1','0','0','0','CHS','PV','PMT'); })()`);
      results.push(['PMT 12 n 1 i -1000 PV', await js('window.__hp.view().text')]);
      await shot('02-pmt');
      await js(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'5'}))`);
      await js(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'5',bubbles:true})); window.dispatchEvent(new KeyboardEvent('keyup',{key:'5',bubbles:true}))`);
      results.push(['teclado 5', await js('window.__hp.view().text')]);
      win.webContents.send('hp:menu', 'shortcuts'); await wait(400); await shot('05-atalhos');
      results.push(['atalhos: teclas no mini-teclado', await js(`document.querySelectorAll('.kbmap .kb').length`)]);
      await js(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);
      win.webContents.send('hp:menu', 'help'); await wait(400); await shot('03-guia');
      win.webContents.send('hp:menu', 'help'); await js(`document.getElementById('helpClose').click()`);
      win.webContents.send('hp:settings', { comma: false, hints: true, showRegs: true }); await wait(300);
      await shot('04-opcoes');
    } catch (err) { results.push(['ERRO', String(err)]); }
    fs.writeFileSync(path.join(out, 'resultado.json'), JSON.stringify(results, null, 2));
    app.exit(0);
  });
});
require('../main.js');
