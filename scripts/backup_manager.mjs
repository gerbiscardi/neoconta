import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import zlib from 'zlib';
import { execSync } from 'child_process';

const MAGIC_HEADER = Buffer.from('NCSN'); // NeoConta Snapshot
const DEFAULT_PASSPHRASE = process.env.MIGRATION_KEY || process.env.AFIP_ENCRYPTION_KEY || 'NeoConta#2026!MigrationSecureKey';

function getAllFiles(dir, baseDir = dir) {
  let files = [];
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(getAllFiles(fullPath, baseDir));
    } else {
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      // Exclude giant static 1.85GB dictionary from Git snapshot
      if (relPath.includes('glosario_medico_bilingue.sqlite')) continue;
      files.push({
        relPath,
        fullPath,
        size: entry.size || fs.statSync(fullPath).size
      });
    }
  }
  return files;
}

export function createEncryptedSnapshot(outputEncPath, passphrase = DEFAULT_PASSPHRASE) {
  console.log('====================================================');
  console.log(' GENERATING ENCRYPTED OPERATIONAL SNAPSHOT');
  console.log('====================================================');

  const bundle = {
    version: '2.0.0',
    createdAt: new Date().toISOString(),
    gitCommit: '',
    files: {},
    metadata: {}
  };

  try {
    bundle.gitCommit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch (e) {
    bundle.gitCommit = 'unknown';
  }

  // 1. Pack SQLite Database (prefer live production VPS DB if available, fallback to local)
  let dbSourcePath = 'backups/vps_live_production_snapshot/prisma/neoconta.db';
  if (!fs.existsSync(dbSourcePath)) {
    dbSourcePath = 'prisma/neoconta.db';
  }

  if (fs.existsSync(dbSourcePath)) {
    const dbBuf = fs.readFileSync(dbSourcePath);
    bundle.files['prisma/neoconta.db'] = dbBuf.toString('base64');
    bundle.metadata['prisma/neoconta.db'] = {
      size: dbBuf.length,
      sha256: crypto.createHash('sha256').update(dbBuf).digest('hex')
    };
    console.log(`✓ Packed SQLite Database: ${dbSourcePath} (${(dbBuf.length / 1024).toFixed(1)} KB)`);
  }

  // 2. Pack data/ files (merge VPS live data and local data)
  const vpsDataDir = 'backups/vps_live_production_snapshot/data';
  const localDataDir = 'data';

  const collectedDataPaths = new Set();
  
  // First collect from VPS live snapshot
  if (fs.existsSync(vpsDataDir)) {
    const vpsFiles = getAllFiles(vpsDataDir);
    for (const file of vpsFiles) {
      const buf = fs.readFileSync(file.fullPath);
      const targetRel = `data/${file.relPath}`;
      bundle.files[targetRel] = buf.toString('base64');
      bundle.metadata[targetRel] = {
        size: buf.length,
        sha256: crypto.createHash('sha256').update(buf).digest('hex')
      };
      collectedDataPaths.add(targetRel);
    }
  }

  // Next collect any missing local data files
  if (fs.existsSync(localDataDir)) {
    const localFiles = getAllFiles(localDataDir);
    for (const file of localFiles) {
      const targetRel = `data/${file.relPath}`;
      if (!collectedDataPaths.has(targetRel)) {
        const buf = fs.readFileSync(file.fullPath);
        bundle.files[targetRel] = buf.toString('base64');
        bundle.metadata[targetRel] = {
          size: buf.length,
          sha256: crypto.createHash('sha256').update(buf).digest('hex')
        };
        collectedDataPaths.add(targetRel);
      }
    }
  }
  console.log(`✓ Packed Data Files: ${collectedDataPaths.size} operational files`);

  // 3. Pack environment configuration templates
  const envSources = ['backups/vps_live_production_snapshot/env', '.'];
  const envFiles = ['.env', '.env.local', '.env.production'];
  for (const envName of envFiles) {
    for (const src of envSources) {
      const p = path.join(src, envName);
      if (fs.existsSync(p)) {
        const buf = fs.readFileSync(p);
        bundle.files[envName] = buf.toString('base64');
        bundle.metadata[envName] = {
          size: buf.length,
          sha256: crypto.createHash('sha256').update(buf).digest('hex')
        };
        console.log(`✓ Packed Environment: ${envName} (from ${p})`);
        break;
      }
    }
  }

  // 4. Compress bundle
  const jsonString = JSON.stringify(bundle);
  const jsonBuffer = Buffer.from(jsonString, 'utf8');
  console.log(`Uncompressed bundle size: ${(jsonBuffer.length / 1024).toFixed(1)} KB`);
  const compressed = zlib.gzipSync(jsonBuffer, { level: 9 });
  console.log(`Gzip compressed bundle size: ${(compressed.length / 1024).toFixed(1)} KB`);

  // 5. Encrypt with AES-256-GCM + PBKDF2
  const salt = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const key = crypto.pbkdf2Sync(passphrase, salt, 100000, 32, 'sha256');

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(compressed), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // File structure: [MAGIC 4b][SALT 32b][IV 12b][AUTH_TAG 16b][ENCRYPTED DATA]
  const finalFileBuffer = Buffer.concat([MAGIC_HEADER, salt, iv, authTag, encrypted]);

  fs.mkdirSync(path.dirname(outputEncPath), { recursive: true });
  fs.writeFileSync(outputEncPath, finalFileBuffer);

  const snapshotSha256 = crypto.createHash('sha256').update(finalFileBuffer).digest('hex');

  console.log(`\nEncrypted snapshot written to: ${outputEncPath}`);
  console.log(`Final encrypted size: ${(finalFileBuffer.length / 1024).toFixed(1)} KB`);
  console.log(`SHA256 Checksum: ${snapshotSha256}`);
  console.log('====================================================\n');

  return {
    outputEncPath,
    size: finalFileBuffer.length,
    sha256: snapshotSha256,
    fileCount: Object.keys(bundle.files).length
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve('./scripts/backup_manager.mjs')) {
  const targetPath = process.argv[2] || 'backups/system_snapshot.enc';
  const customKey = process.argv[3] || DEFAULT_PASSPHRASE;
  createEncryptedSnapshot(targetPath, customKey);
}
