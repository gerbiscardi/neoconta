const { Client } = require('ssh2');

const conn = new Client();
const config = {
  host: '200.58.98.237',
  port: 22,
  username: 'root',
  password: '3/TJwP1VTp5Okv'
};

conn.on('ready', () => {
  console.log('SSH connection established. Finishing deployment...');
  
  const cmds = [
    'pm2 delete neoconta || true',
    'cd /var/www/neoconta && pm2 start npm --name "neoconta" -- start',
    'pm2 save',
    'systemctl restart nginx'
  ];

  let currentCmdIndex = 0;

  function runNext() {
    if (currentCmdIndex >= cmds.length) {
      console.log('All steps completed successfully.');
      conn.end();
      return;
    }
    const cmd = cmds[currentCmdIndex];
    console.log(`Executing: ${cmd}...`);
    conn.exec(cmd, (err, stream) => {
      if (err) throw err;
      stream.on('close', (code, signal) => {
        currentCmdIndex++;
        runNext();
      }).on('data', (data) => {
        process.stdout.write(data.toString());
      }).stderr.on('data', (data) => {
        process.stderr.write(data.toString());
      });
    });
  }

  runNext();
}).connect(config);
