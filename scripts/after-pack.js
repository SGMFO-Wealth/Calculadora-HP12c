'use strict';
// Remove o "CompanyName" padrão do Electron ("GitHub, Inc.") do executável principal.
const path = require('path');
const { rcedit } = require('rcedit');
module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;
  const exe = path.join(context.appOutDir, context.packager.appInfo.productFilename + '.exe');
  await rcedit(exe, { 'version-string': { CompanyName: ' ' } });
};
