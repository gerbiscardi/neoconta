const { Client } = require('ssh2');

const conn = new Client();
const config = {
  host: '200.58.98.237',
  port: 22,
  username: 'root',
  password: '3/TJwP1VTp5Okv'
};

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

conn.on('ready', async () => {
  console.log('SSH connection established.');
  try {
    console.log('Starting remote build in background with nohup...');
    await executeCommand(conn, 'cd /var/www/neoconta && rm -f build.log && nohup npm run build > build.log 2>&1 &');
    
    console.log('Polling build.log status...');
    let finished = false;
    let attempts = 0;
    while (!finished && attempts < 60) {
      await new Promise(r => setTimeout(r, 10000)); // wait 10s
      const logContent = await executeCommand(conn, 'tail -n 20 /var/www/neoconta/build.log || echo "No log yet"');
      console.log(`\n--- [Attempt ${attempts+1}] Log Tail ---`);
      console.log(logContent);
      
      if (logContent.includes('Compiled successfully') && logContent.includes('Collecting build traces')) {
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

    console.log('Restarting Next.js frontend under PM2...');
    await executeCommand(conn, 'pm2 delete neoconta || true');
    await executeCommand(conn, 'cd /var/www/neoconta && pm2 start npm --name "neoconta" -- start');
    await executeCommand(conn, 'pm2 save');
    
    console.log('Restarting Nginx...');
    await executeCommand(conn, 'systemctl restart nginx');
    console.log('Deployment completed successfully!');
  } catch (err) {
    console.error('Error during deploy:', err);
  } finally {
    conn.end();
  }
}).connect(config);
