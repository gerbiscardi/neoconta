const { Client } = require('ssh2');
const path = require('path');
const fs = require('fs');

const conn = new Client();
const config = {
  host: '200.58.98.237',
  port: 22,
  username: 'root',
  password: '3/TJwP1VTp5Okv'
};

const localBase = 'c:/Users/Germán Biscardi/.gemini/antigravity/scratch/neoconta';

const filesToUpload = [
  {
    local: path.join(localBase, 'data/glosario_medico_bilingue.sqlite'),
    remote: '/var/www/neoconta/data/glosario_medico_bilingue.sqlite',
    isLarge: true
  },
  {
    local: path.join(localBase, 'app/api/vitacore/medical-terms/route.js'),
    remote: '/var/www/neoconta/app/api/vitacore/medical-terms/route.js'
  },
  {
    local: path.join(localBase, 'app/dashboard/vitacore/[id]/page.js'),
    remote: '/var/www/neoconta/app/dashboard/vitacore/[id]/page.js'
  }
];

function executeCommand(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      stream.on('close', (code) => {
        resolve(out);
      }).on('data', (data) => {
        out += data.toString();
      }).stderr.on('data', (data) => {
        out += data.toString();
      });
    });
  });
}

function uploadFile(sftp, localPath, remotePath, isLarge) {
  return new Promise((resolve, reject) => {
    console.log(`Uploading ${localPath} to ${remotePath}...`);
    const dir = path.dirname(remotePath).replace(/\\/g, '/');
    
    sftp.mkdir(dir, { recursive: true }, (err) => {
      const stats = fs.statSync(localPath);
      const totalBytes = stats.size;
      let lastPrintedMb = 0;

      sftp.fastPut(localPath, remotePath, {
        step: function(transferred, chunk, total) {
          const transferredMb = Math.floor(transferred / (1024 * 1024));
          if (transferredMb - lastPrintedMb >= 50 || transferred === total) {
            console.log(`Progress: ${transferredMb} MB / ${Math.floor(total / (1024 * 1024))} MB (${((transferred / total) * 100).toFixed(1)}%)`);
            lastPrintedMb = transferredMb;
          }
        }
      }, (err2) => {
        if (err2) return reject(err2);
        console.log(`Finished uploading ${path.basename(remotePath)}`);
        resolve();
      });
    });
  });
}

conn.on('ready', () => {
  console.log('SSH Connection ready.');
  conn.sftp(async (err, sftp) => {
    if (err) {
      console.error('SFTP Error:', err);
      conn.end();
      return;
    }
    
    try {
      for (const file of filesToUpload) {
        await uploadFile(sftp, file.local, file.remote, file.isLarge);
      }
      console.log('All files uploaded successfully.');
      
      console.log('Stopping PM2 service...');
      await executeCommand(conn, 'pm2 stop neoconta || true');
      
      console.log('Clearing Next.js cache...');
      await executeCommand(conn, 'rm -rf /var/www/neoconta/.next');
      
      console.log('Starting remote build in background with nohup...');
      await executeCommand(conn, 'cd /var/www/neoconta && rm -f build.log && nohup npm run build > build.log 2>&1 &');
      
      console.log('Polling build.log status...');
      let finished = false;
      let attempts = 0;
      while (!finished && attempts < 90) {
        await new Promise(r => setTimeout(r, 10000));
        const logContent = await executeCommand(conn, 'tail -n 40 /var/www/neoconta/build.log || echo "No log yet"');
        console.log(`\n--- [Attempt ${attempts+1}] Log Tail ---`);
        console.log(logContent);
        
        if (logContent.includes('Compiled successfully') || logContent.includes('/sitemap.xml') || logContent.includes('Collecting build traces')) {
          finished = true;
          console.log('Build completed successfully!');
        } else if (logContent.includes('Error:') || logContent.includes('Failed to compile')) {
          console.error('Build failed!');
          conn.end();
          process.exit(1);
        }
        attempts++;
      }

      if (!finished) {
        console.error('Timeout waiting for build.');
        conn.end();
        process.exit(1);
      }

      console.log('Starting Next.js frontend under PM2...');
      await executeCommand(conn, 'pm2 delete neoconta || true');
      await executeCommand(conn, 'cd /var/www/neoconta && pm2 start npm --name "neoconta" -- start');
      await executeCommand(conn, 'pm2 save');
      
      console.log('Restarting Nginx...');
      await executeCommand(conn, 'systemctl restart nginx');
      
      console.log('Deployment completed successfully!');
    } catch (err) {
      console.error('Error during deployment:', err);
    } finally {
      conn.end();
    }
  });
}).connect(config);
