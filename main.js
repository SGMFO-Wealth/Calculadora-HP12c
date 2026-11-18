'use strict';
const { app, BrowserWindow, Menu, ipcMain, dialog, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');

if (!app.requestSingleInstanceLock()) { app.quit(); }

const DEFAULTS = { comma: true, hints: false, showRegs: false, alwaysOnTop: false, bounds: { width: 780, height: 600 } };
let settings = Object.assign({}, DEFAULTS);
let win = null;
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');

function loadSettings() {
  try { settings = Object.assign({}, DEFAULTS, JSON.parse(fs.readFileSync(settingsFile(), 'utf8'))); } catch (_) { settings = Object.assign({}, DEFAULTS); }
}
let saveTimer = null;
function saveSettings() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { fs.mkdirSync(path.dirname(settingsFile()), { recursive: true }); fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2)); } catch (_) { /* ignora */ }
  }, 200);
}
const send = (ch, ...a) => { if (win && !win.isDestroyed()) win.webContents.send(ch, ...a); };
const pushSettings = () => send('hp:settings', { comma: settings.comma, hints: settings.hints, showRegs: settings.showRegs });

function buildMenu() {
  const t = [
    { label: '&Arquivo', submenu: [
      { label: 'Exportar programa…', accelerator: 'CmdOrCtrl+S', click: () => send('hp:menu', 'export-program') },
      { label: 'Importar programa…', accelerator: 'CmdOrCtrl+O', click: async () => {
        const r = await dialog.showOpenDialog(win, { title: 'Importar programa', filters: [{ name: 'Programa da 12C', extensions: ['json'] }], properties: ['openFile'] });
        if (r.canceled || !r.filePaths[0]) return;
        try { send('hp:menu', 'import-program', fs.readFileSync(r.filePaths[0], 'utf8')); } catch (_) { send('hp:menu', 'import-program', ''); }
      } },
      { type: 'separator' },
      { label: 'Zerar memória contínua…', click: async () => {
        const r = await dialog.showMessageBox(win, { type: 'warning', buttons: ['Zerar', 'Cancelar'], defaultId: 1, cancelId: 1, title: 'Zerar memória',
          message: 'Zerar registradores, programa e configurações da calculadora?', detail: 'Isso apaga tudo o que está guardado na calculadora.' });
        if (r.response === 0) send('hp:menu', 'reset');
      } },
      { type: 'separator' },
      { role: 'quit', label: 'Sair' }
    ] },
    { label: '&Editar', submenu: [
      { label: 'Copiar visor', accelerator: 'CmdOrCtrl+C', click: () => send('hp:menu', 'copy') },
      { label: 'Colar número', accelerator: 'CmdOrCtrl+V', click: () => send('hp:menu', 'paste') }
    ] },
    { label: '&Exibir', submenu: [
      { label: 'Sempre no topo', type: 'checkbox', checked: settings.alwaysOnTop, click: i => { settings.alwaysOnTop = i.checked; if (win) win.setAlwaysOnTop(i.checked); saveSettings(); } },
      { label: 'Mostrar pilha e registradores', type: 'checkbox', checked: settings.showRegs, click: i => { settings.showRegs = i.checked; saveSettings(); pushSettings(); } },
      { label: 'Mostrar atalhos nas teclas', type: 'checkbox', checked: settings.hints, click: i => { settings.hints = i.checked; saveSettings(); pushSettings(); } },
      { type: 'separator' },
      { role: 'togglefullscreen', label: 'Tela cheia' },
      ...(app.isPackaged ? [] : [{ role: 'toggleDevTools', label: 'Ferramentas de desenvolvedor' }])
    ] },
    { label: '&Opções', submenu: [
      { label: 'Separador decimal', enabled: false },
      { label: 'Vírgula  (1.234,56)', type: 'radio', checked: settings.comma, click: () => { settings.comma = true; saveSettings(); pushSettings(); } },
      { label: 'Ponto  (1,234.56)', type: 'radio', checked: !settings.comma, click: () => { settings.comma = false; saveSettings(); pushSettings(); } }
    ] },
    { label: 'A&juda', submenu: [
      { label: 'Guia da calculadora e atalhos', accelerator: 'F1', click: () => send('hp:menu', 'help') },
      { type: 'separator' },
      { label: 'Sobre', click: () => dialog.showMessageBox(win, { type: 'info', title: 'Sobre', message: 'Calculadora financeira 12C',
        detail: 'Versão ' + app.getVersion() + '\nRéplica de estudo da calculadora financeira HP 12C, com programação.\nSem vínculo com a Hewlett-Packard.\nFonte do visor: DSEG7 (SIL OFL 1.1).' }) }
    ] }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(t));
}

function createWindow() {
  const b = settings.bounds || DEFAULTS.bounds;
  win = new BrowserWindow({
    width: b.width, height: b.height, x: b.x, y: b.y, minWidth: 420, minHeight: 340,
    backgroundColor: '#1b1d21', title: 'Calculadora Financeira 12C', autoHideMenuBar: true, show: false,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false }
  });
  win.setAlwaysOnTop(!!settings.alwaysOnTop);
  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', e => e.preventDefault());
  const keepBounds = () => { if (!win.isMaximized() && !win.isFullScreen() && !win.isMinimized()) { settings.bounds = win.getBounds(); saveSettings(); } };
  win.on('resize', keepBounds); win.on('move', keepBounds);
  win.on('closed', () => { win = null; });
}

ipcMain.on('hp:ready', () => pushSettings());
ipcMain.handle('hp:copy-text', (_e, text) => { clipboard.writeText(String(text)); return true; });
ipcMain.handle('hp:paste-text', () => clipboard.readText());
ipcMain.handle('hp:save-file', async (_e, name, content) => {
  const r = await dialog.showSaveDialog(win, { title: 'Exportar programa', defaultPath: String(name || 'programa-12c.json'), filters: [{ name: 'Programa da 12C', extensions: ['json'] }] });
  if (r.canceled || !r.filePath) return false;
  fs.writeFileSync(r.filePath, String(content), 'utf8'); return true;
});

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(() => { loadSettings(); buildMenu(); createWindow(); });
app.on('window-all-closed', () => app.quit());
