import fs from 'fs';
import path from 'path';
import { Client } from 'ssh2';

const vpsConfig = {
  host: '187.41.106.124',
  port: 22,
  username: 'root',
  password: 'NeoConta#2026'
};

const targetDir = path.resolve('./backups/vps_live_production_snapshot');
fs.mkdirSync(targetDir, { recursive: true });

function execCmd(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      let errOut = '';
      stream.on('data', d => out += d);
      stream.stderr.on('data', d => errOut += d);
      stream.on('close', code => resolve({ code, out: out.trim(), err: errOut.trim() }));
    });
  });
}

function downloadFile(sftp, remotePath, localPath) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    sftp.fastGet(remotePath, localPath, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

async function listRemoteFilesRecursive(sftp, remoteDir) {
  const filesList = [];
  async function scan(dir) {
    const list = await new Promise((res, rej) => {
      sftp.readdir(dir, (err, l) => {
        if (err) return rej(err);
        res(l);
      });
    });

    for (const item of list) {
      if (item.filename === '.' || item.filename === '..') continue;
      const fullPath = `${dir}/${item.filename}`;
      if (item.attrs.isDirectory()) {
        await scan(fullPath);
      } else {
        filesList.push({ path: fullPath, size: item.attrs.size, mtime: item.attrs.mtime });
      }
    }
  }
  await scan(remoteDir);
  return filesList;
}

const conn = new Client();
conn.on('ready', async () => {
  console.log('Connected to VPS 187.41.106.124...');
  try {
    // 1. Online consistent atomic SQLite backup on VPS
    console.log('Creating consistent online SQLite backup on VPS...');
    const dbBackupCmd = `python3 -c "
import sqlite3, os
src_db = '/var/www/neoconta/prisma/neoconta.db'
if not os.path.exists(src_db):
    src_db = '/var/www/neoconta/dev.db'
dst_db = '/tmp/neoconta_atomic_vps_backup.db'
if os.path.exists(dst_db):
    os.remove(dst_db)
s = sqlite3.connect(src_db)
d = sqlite3.connect(dst_db)
s.backup(d)
d.close()
s.close()
print('SQLITE_BACKUP_CREATED')
"`;
    const resBackup = await execCmd(conn, dbBackupCmd);
    console.log(resBackup.out);

    // 2. Open SFTP
    const sftp = await new Promise((res, rej) => {
      conn.sftp((err, s) => err ? rej(err) : res(s));
    });

    // Download SQLite DB
    console.log('Downloading atomic SQLite DB from VPS...');
    await downloadFile(sftp, '/tmp/neoconta_atomic_vps_backup.db', path.join(targetDir, 'prisma/neoconta.db'));

    // Download env files
    console.log('Downloading env files from VPS...');
    for (const envFile of ['.env', '.env.local', '.env.production']) {
      try {
        await downloadFile(sftp, `/var/www/neoconta/${envFile}`, path.join(targetDir, `env/${envFile}`));
        console.log(`Downloaded ${envFile}`);
      } catch (e) {
        // file might not exist
      }
    }

    // Download data/ directory files (excluding the 1.85GB dictionary to save network bandwidth if identical)
    console.log('Scanning remote /var/www/neoconta/data/ ...');
    const remoteDataFiles = await listRemoteFilesRecursive(sftp, '/var/www/neoconta/data');
    console.log(`Found ${remoteDataFiles.length} files in /var/www/neoconta/data`);

    for (const file of remoteDataFiles) {
      const relPath = file.path.replace('/var/www/neoconta/data/', '');
      if (relPath === 'glosario_medico_bilingue.sqlite') {
        console.log(`Skipping 1.85GB static dictionary over SSH (already present locally)`);
        continue;
      }
      const localDest = path.join(targetDir, 'data', relPath);
      await downloadFile(sftp, file.path, localDest);
      console.log(`  Downloaded: ${relPath} (${file.size} bytes)`);
    }

    // Download PM2 ecosystem if exists
    try {
      await downloadFile(sftp, '/var/www/neoconta/ecosystem.config.js', path.join(targetDir, 'server_config/ecosystem.config.js'));
    } catch (e) {}

    // Check Nginx configuration
    console.log('Fetching Nginx configuration for neoconta...');
    const nginxRes = await execCmd(conn, 'cat /etc/nginx/sites-enabled/*neoconta* 2>/dev/null || cat /etc/nginx/conf.d/*neoconta* 2>/dev/null || echo "NGINX_NOT_FOUND"');
    if (nginxRes.out && nginxRes.out !== 'NGINX_NOT_FOUND') {
      fs.mkdirSync(path.join(targetDir, 'server_config'), { recursive: true });
      fs.writeFileSync(path.join(targetDir, 'server_config/nginx_neoconta.conf'), nginxRes.out, 'utf8');
      console.log('Saved Nginx config to server_config/nginx_neoconta.conf');
    }

    // Clean up temporary DB on VPS
    await execCmd(conn, 'rm -f /tmp/neoconta_atomic_vps_backup.db');

    console.log('\nVPS Production snapshot downloaded successfully to:', targetDir);
  } catch (err) {
    console.error('Error during VPS snapshot download:', err);
  } finally {
    conn.end();
  }
});

conn.connect(vpsConfig);
