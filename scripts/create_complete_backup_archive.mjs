import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';

const stagingDir = path.resolve('backups/NEOCONTA_LOCAL_SYSTEM_BACKUP_20261127');
const desktopZipPath = path.resolve(process.env.USERPROFILE || 'C:\\Users\\Germán Biscardi', 'Desktop/NEOCONTA_BACKUP_COMPLETO_20261127.zip');
const localZipPath = path.resolve('backups/NEOCONTA_BACKUP_COMPLETO_20261127.zip');

console.log('====================================================');
console.log(' BUILDING NEOCONTA LOCAL COMPLETE BACKUP ARCHIVE');
console.log(' Staging directory:', stagingDir);
console.log(' Desktop ZIP:', desktopZipPath);
console.log(' Local ZIP:', localZipPath);
console.log('====================================================\n');

// 1. Prepare clean staging directory
if (fs.existsSync(stagingDir)) {
  fs.rmSync(stagingDir, { recursive: true, force: true });
}
fs.mkdirSync(stagingDir, { recursive: true });

function copyRecursive(src, dst, excludeFilter) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    const items = fs.readdirSync(src);
    for (const item of items) {
      const srcItem = path.join(src, item);
      const dstItem = path.join(dst, item);
      if (excludeFilter && excludeFilter(srcItem, item)) continue;
      copyRecursive(srcItem, dstItem, excludeFilter);
    }
  } else {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }
}

// 2. Copy source code (exclude build/dependency artifacts)
console.log('[1/6] Copying source code and application assets...');
const rootItemsToCopy = [
  'app', 'components', 'lib', 'prisma', 'public', 'scripts',
  'deploy', 'docs', 'neoconta-ds',
  'package.json', 'package-lock.json', 'next.config.mjs',
  'jsconfig.json', 'postcss.config.mjs', 'tailwind.config.mjs',
  '.env.example', 'ecosystem.config.js', '.gitignore'
];

for (const item of rootItemsToCopy) {
  if (fs.existsSync(item)) {
    copyRecursive(item, path.join(stagingDir, item), (fullPath, name) => {
      if (['node_modules', '.next', '.venv', '__pycache__'].includes(name)) return true;
      return false;
    });
  }
}

// 3. Copy operational data & live databases
console.log('[2/6] Merging and copying operational data and SQLite database...');
// Merge VPS live data and local data into staging data/
const stagingDataDir = path.join(stagingDir, 'data');
fs.mkdirSync(stagingDataDir, { recursive: true });

// Copy VPS data first
const vpsData = 'backups/vps_live_production_snapshot/data';
if (fs.existsSync(vpsData)) {
  copyRecursive(vpsData, stagingDataDir);
}
// Copy local data (will add glosario if present, and any local certs)
if (fs.existsSync('data')) {
  copyRecursive('data', stagingDataDir);
}

// Copy SQLite database
const stagingPrismaDir = path.join(stagingDir, 'prisma');
fs.mkdirSync(stagingPrismaDir, { recursive: true });
const vpsDb = 'backups/vps_live_production_snapshot/prisma/neoconta.db';
const localDb = 'prisma/neoconta.db';
if (fs.existsSync(vpsDb)) {
  fs.copyFileSync(vpsDb, path.join(stagingPrismaDir, 'neoconta.db'));
} else if (fs.existsSync(localDb)) {
  fs.copyFileSync(localDb, path.join(stagingPrismaDir, 'neoconta.db'));
}

// Also keep dedicated copies in a dedicated 'databases_backup' folder for clarity
const dbBackupDir = path.join(stagingDir, 'backups_databases');
fs.mkdirSync(dbBackupDir, { recursive: true });
if (fs.existsSync(vpsDb)) fs.copyFileSync(vpsDb, path.join(dbBackupDir, 'neoconta_vps_live_production.db'));
if (fs.existsSync(localDb)) fs.copyFileSync(localDb, path.join(dbBackupDir, 'neoconta_local_development.db'));

// 4. Copy environment files
console.log('[3/6] Copying environment configurations...');
const stagingEnvDir = path.join(stagingDir, 'environment_configs');
fs.mkdirSync(stagingEnvDir, { recursive: true });
const envFiles = ['.env', '.env.local', '.env.production'];
for (const envName of envFiles) {
  const vpsEnv = path.join('backups/vps_live_production_snapshot/env', envName);
  const localEnv = path.resolve(envName);
  if (fs.existsSync(vpsEnv)) {
    fs.copyFileSync(vpsEnv, path.join(stagingEnvDir, `${envName}.production_vps`));
    fs.copyFileSync(vpsEnv, path.join(stagingDir, envName)); // active root env
  } else if (fs.existsSync(localEnv)) {
    fs.copyFileSync(localEnv, path.join(stagingEnvDir, `${envName}.local`));
    fs.copyFileSync(localEnv, path.join(stagingDir, envName));
  }
}

// 5. Copy encrypted snapshot & restoration scripts
console.log('[4/6] Copying encrypted snapshot and restoration scripts...');
if (fs.existsSync('backups/system_snapshot.enc')) {
  fs.copyFileSync('backups/system_snapshot.enc', path.join(stagingDir, 'system_snapshot.enc'));
}
if (fs.existsSync('backups/vps_live_production_snapshot/server_config/nginx_full.conf')) {
  fs.mkdirSync(path.join(stagingDir, 'server_config'), { recursive: true });
  fs.copyFileSync(
    'backups/vps_live_production_snapshot/server_config/nginx_full.conf',
    path.join(stagingDir, 'server_config/nginx_neoconta.conf')
  );
}

// 6. Generate restoration guides and execution scripts inside staging
console.log('[5/6] Creating restoration scripts and documentation...');
const readmeContent = `# =COMO RESTAURAR ESTE BACKUP EN CUALQUIER COMPUTADORA O SERVIDOR=

Este archivo contiene la copia COMPLETA de NeoConta al 27/11/2026.
Incluye:
1. Código fuente completo de NeoConta y microservicio Data Science.
2. Base de datos SQLite operativa (prisma/neoconta.db) con todos los registros.
3. Directorio de datos (data/) con usuarios, certificados AFIP, claves privadas, facturas e historiales.
4. Archivos de entorno (.env, .env.local, .env.production).
5. Configuraciones de servidor Nginx y PM2 (ecosystem.config.js).
6. Copia snapshot cifrada (system_snapshot.enc).

--------------------------------------------------------------------------------
OPCION A: RESTAURAR EN UN NUEVO SERVIDOR LINUX (UBUNTU 22.04 / 24.04)
--------------------------------------------------------------------------------
1. Copie esta carpeta o descomprima este archivo en /var/www/neoconta
2. Ejecute como root o sudo:
   bash deploy/setup_server.sh
3. Instale dependencias y compile:
   npm install
   npx prisma generate
   npm run build
4. Inicie el sistema con PM2:
   pm2 start ecosystem.config.js
   pm2 save
5. Configure SSL con Certbot:
   certbot --nginx -d neoconta.com.ar -d www.neoconta.com.ar

--------------------------------------------------------------------------------
OPCION B: RESTAURAR EN ESTA COMPUTADORA O OTRA PC CON WINDOWS
--------------------------------------------------------------------------------
1. Abra PowerShell en la carpeta descomprimida.
2. Ejecute:
   powershell -ExecutionPolicy Bypass -File restore_pc.ps1
   (O simplemente ejecute: npm install && npx prisma generate && npm run dev)
`;
fs.writeFileSync(path.join(stagingDir, 'README_RESTORE.txt'), readmeContent, 'utf8');

const restorePcPs1 = `# Script de restauracion rapida para Windows
Write-Host "=== Restaurando NeoConta en Windows ===" -ForegroundColor Cyan
if (!(Test-Path "prisma\\neoconta.db")) {
    if (Test-Path "backups_databases\\neoconta_vps_live_production.db") {
        Copy-Item "backups_databases\\neoconta_vps_live_production.db" "prisma\\neoconta.db" -Force
        Write-Host "Base de datos SQLite restaurada." -ForegroundColor Green
    }
}
Write-Host "Instalando dependencias de Node.js..." -ForegroundColor Yellow
npm install
Write-Host "Generando cliente de Prisma..." -ForegroundColor Yellow
npx prisma generate
Write-Host "Verificando compilacion..." -ForegroundColor Yellow
npm run build
Write-Host "=== Sistema listo. Inicie con: npm run dev ===" -ForegroundColor Green
`;
fs.writeFileSync(path.join(stagingDir, 'restore_pc.ps1'), restorePcPs1, 'utf8');

const restoreServerSh = `#!/bin/bash
set -e
echo "=== Restaurando NeoConta en Servidor Linux ==="
mkdir -p prisma
if [ ! -f "prisma/neoconta.db" ]; then
    if [ -f "backups_databases/neoconta_vps_live_production.db" ]; then
        cp backups_databases/neoconta_vps_live_production.db prisma/neoconta.db
        echo "Base de datos SQLite restaurada."
    fi
fi
npm install
npx prisma generate
npm run build
pm2 reload ecosystem.config.js || pm2 start ecosystem.config.js
echo "=== Sistema restaurado y ejecutandose en PM2 ==="
`;
fs.writeFileSync(path.join(stagingDir, 'restore_server.sh'), restoreServerSh, 'utf8');

// 7. Compress into ZIP archives
console.log('[6/6] Generating ZIP archives...');
// Exclude giant 1.85GB dictionary from the ZIP file so it completes instantly and stays portable (< 30 MB)
// (The 1.85GB dictionary stays intact in the uncompressed staging folder on this PC)
const zipStagingDir = path.resolve('backups/.tmp_zip_staging');
if (fs.existsSync(zipStagingDir)) fs.rmSync(zipStagingDir, { recursive: true, force: true });
fs.mkdirSync(zipStagingDir, { recursive: true });

copyRecursive(stagingDir, zipStagingDir, (full, name) => {
  if (name.includes('glosario_medico_bilingue.sqlite')) return true;
  return false;
});

// Remove existing zip files if any
if (fs.existsSync(desktopZipPath)) fs.unlinkSync(desktopZipPath);
if (fs.existsSync(localZipPath)) fs.unlinkSync(localZipPath);

const psZipCmd = `powershell -NoProfile -Command "Compress-Archive -Path '${zipStagingDir}\\*' -DestinationPath '${localZipPath}' -CompressionLevel Optimal -Force; Copy-Item '${localZipPath}' '${desktopZipPath}' -Force"`;
execSync(psZipCmd, { stdio: 'inherit' });

// Clean up zip staging
fs.rmSync(zipStagingDir, { recursive: true, force: true });

const localZipStat = fs.statSync(localZipPath);
const desktopZipStat = fs.statSync(desktopZipPath);
const zipSha256 = crypto.createHash('sha256').update(fs.readFileSync(localZipPath)).digest('hex');

console.log('\n====================================================');
console.log(' BACKUP COMPLETO GENERADO CON ÉXITO');
console.log(` 1. Carpeta local completa: ${stagingDir}`);
console.log(` 2. ZIP en Repositorio:     ${localZipPath} (${(localZipStat.size / 1024 / 1024).toFixed(2)} MB)`);
console.log(` 3. ZIP en Escritorio (PC): ${desktopZipPath} (${(desktopZipStat.size / 1024 / 1024).toFixed(2)} MB)`);
console.log(` SHA256 del archivo ZIP:   ${zipSha256}`);
console.log('====================================================\n');
