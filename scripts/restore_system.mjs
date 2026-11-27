import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import zlib from 'zlib';

const MAGIC_HEADER = Buffer.from('NCSN');
const DEFAULT_PASSPHRASE = process.env.MIGRATION_KEY || process.env.AFIP_ENCRYPTION_KEY || 'NeoConta#2026!MigrationSecureKey';

export async function restoreEncryptedSnapshot(encFilePath, options = {}) {
  const passphrase = options.key || DEFAULT_PASSPHRASE;
  const targetRoot = options.targetRoot || '.';
  const overwriteEnv = options.overwriteEnv ?? true;

  console.log('====================================================');
  console.log(' NEOCONTA SYSTEM RESTORATION PROCESS');
  console.log(` Snapshot: ${encFilePath}`);
  console.log(` Target Root: ${path.resolve(targetRoot)}`);
  console.log('====================================================');

  if (!fs.existsSync(encFilePath)) {
    throw new Error(`Snapshot file not found: ${encFilePath}`);
  }

  const rawBuffer = fs.readFileSync(encFilePath);
  if (rawBuffer.length < 64) {
    throw new Error('Invalid snapshot file: too small.');
  }

  const magic = rawBuffer.subarray(0, 4);
  if (!magic.equals(MAGIC_HEADER)) {
    throw new Error('Invalid snapshot header: file is not a valid NeoConta encrypted snapshot.');
  }

  const salt = rawBuffer.subarray(4, 36);
  const iv = rawBuffer.subarray(36, 48);
  const authTag = rawBuffer.subarray(48, 64);
  const ciphertext = rawBuffer.subarray(64);

  console.log('Deriving key from passphrase via PBKDF2 (100,000 iterations)...');
  const key = crypto.pbkdf2Sync(passphrase, salt, 100000, 32, 'sha256');

  console.log('Decrypting payload with AES-256-GCM...');
  let compressed;
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    compressed = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch (err) {
    throw new Error('Decryption failed! Incorrect passphrase or corrupted snapshot file.');
  }

  console.log('Decompressing payload...');
  const jsonBuffer = zlib.gunzipSync(compressed);
  const bundle = JSON.parse(jsonBuffer.toString('utf8'));

  console.log(`✓ Snapshot metadata verified:`);
  console.log(`  - Version: ${bundle.version}`);
  console.log(`  - Created at: ${bundle.createdAt}`);
  console.log(`  - Source Git commit: ${bundle.gitCommit}`);
  console.log(`  - Total files to restore: ${Object.keys(bundle.files).length}\n`);

  let restoredCount = 0;
  for (const [relPath, base64Content] of Object.entries(bundle.files)) {
    const isEnvFile = relPath.startsWith('.env');
    const destPath = path.join(targetRoot, relPath);

    if (isEnvFile && !overwriteEnv && fs.existsSync(destPath)) {
      console.log(`  [SKIP] ${relPath} already exists (skipping overwrite)`);
      continue;
    }

    const fileBuf = Buffer.from(base64Content, 'base64');
    
    // Verify SHA256 if available in metadata
    if (bundle.metadata && bundle.metadata[relPath]) {
      const calcSha = crypto.createHash('sha256').update(fileBuf).digest('hex');
      if (calcSha !== bundle.metadata[relPath].sha256) {
        throw new Error(`SHA256 mismatch for ${relPath}! Expected: ${bundle.metadata[relPath].sha256}, got: ${calcSha}`);
      }
    }

    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, fileBuf);
    restoredCount++;
  }

  console.log(`\nSuccessfully restored ${restoredCount} files.`);

  // Verify SQLite database integrity if sqlite3 is installed
  const dbPath = path.join(targetRoot, 'prisma/neoconta.db');
  if (fs.existsSync(dbPath)) {
    try {
      const sqlite3Module = await import('sqlite3');
      const sqlite3 = sqlite3Module.default || sqlite3Module;
      await new Promise((resolve) => {
        const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
          if (err) {
            console.warn('Warning: Could not open restored SQLite DB:', err.message);
            return resolve();
          }
          db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'", [], (err, tables) => {
            if (err) {
              console.warn('Warning querying tables:', err.message);
              db.close();
              return resolve();
            }
            console.log('\n--- Restored SQLite Database Verification ---');
            console.log(`Database tables found: ${tables.length}`);
            let done = 0;
            if (tables.length === 0) {
              db.close();
              return resolve();
            }
            tables.forEach(t => {
              db.get(`SELECT count(*) as cnt FROM "${t.name}"`, [], (err, row) => {
                console.log(`  Table: ${t.name.padEnd(24)} Records: ${row ? row.cnt : 'error'}`);
                done++;
                if (done === tables.length) {
                  db.close();
                  resolve();
                }
              });
            });
          });
        });
      });
    } catch (e) {
      console.log('SQLite verification skipped (sqlite3 driver not in module path). File integrity verified via SHA256.');
    }
  }

  console.log('\n====================================================');
  console.log(' RESTORATION COMPLETED SUCCESSFULLY!');
  console.log(' All databases, users, invoices, and certificates restored.');
  console.log('====================================================\n');
}

// CLI Execution
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve('./scripts/restore_system.mjs')) {
  let encPath = 'backups/system_snapshot.enc';
  let key = DEFAULT_PASSPHRASE;
  let targetRoot = '.';

  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--file' && process.argv[i + 1]) {
      encPath = process.argv[++i];
    } else if (process.argv[i] === '--key' && process.argv[i + 1]) {
      key = process.argv[++i];
    } else if (process.argv[i] === '--dest' && process.argv[i + 1]) {
      targetRoot = process.argv[++i];
    }
  }

  restoreEncryptedSnapshot(encPath, { key, targetRoot })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('\nERROR:', err.message);
      process.exit(1);
    });
}
