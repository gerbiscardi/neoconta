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
  console.log('SSH connection established to fix production build.');
  try {
    // 1. Stop PM2 process
    console.log('Stopping PM2 neoconta process...');
    await executeCommand(conn, 'pm2 stop neoconta || true');

    // 2. Remove .next build folder entirely to clear cache and manifest bugs
    console.log('Removing old .next build directory...');
    await executeCommand(conn, 'rm -rf /var/www/neoconta/.next');

    // 3. Run a clean build
    console.log('Running clean remote build...');
    await executeCommand(conn, 'cd /var/www/neoconta && rm -f build.log && nohup npm run build > build.log 2>&1 &');

    console.log('Polling remote build.log status...');
    let finished = false;
    let attempts = 0;
    while (!finished && attempts < 90) {
      await new Promise(r => setTimeout(r, 10000)); // wait 10s
      const logContent = await executeCommand(conn, 'tail -n 25 /var/www/neoconta/build.log || echo "No log yet"');
      console.log(`\n--- [Attempt ${attempts+1}] Log Tail ---`);
      console.log(logContent);
      
      if (logContent.includes('Route (app)') || logContent.includes('prerendered as static content') || (logContent.includes('Compiled successfully') && logContent.includes('Collecting build traces'))) {
        finished = true;
        console.log('Clean build completed successfully!');
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

    // 4. Start Next.js under PM2
    console.log('Starting PM2 neoconta web process...');
    await executeCommand(conn, 'pm2 delete neoconta || true');
    await executeCommand(conn, 'cd /var/www/neoconta && pm2 start npm --name "neoconta" -- start');
    await executeCommand(conn, 'pm2 save');

    // 5. Restart Nginx
    console.log('Restarting Nginx...');
    await executeCommand(conn, 'systemctl restart nginx');
    console.log('Fix completed successfully! The page should load styles correctly now.');

  } catch (err) {
    console.error('Error during fixing build:', err);
  } finally {
    conn.end();
  }
}).on('error', (err) => {
  console.error('SSH Connection Error:', err);
}).connect(config);
