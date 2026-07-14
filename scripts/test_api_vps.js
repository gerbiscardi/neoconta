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
        process.stdout.write(data.toString());
      }).stderr.on('data', (data) => {
        process.stderr.write(data.toString());
      });
    });
  });
}

conn.on('ready', async () => {
  console.log('Connected to VPS...');
  try {
    console.log('\n--- Testing API /api/arca/consultar-cuit via localhost:3000 (MercadoLibre) ---');
    await executeCommand(conn, `curl -s -X POST -H "Content-Type: application/json" -d '{"cuit":"30703088534","userId":"rmanuelguerrero_kk8e"}' http://localhost:3000/api/arca/consultar-cuit`);
    
    console.log('\n--- Testing API /api/arca/consultar-cuit via localhost:3000 (YPF) ---');
    await executeCommand(conn, `curl -s -X POST -H "Content-Type: application/json" -d '{"cuit":"30546689979","userId":"rmanuelguerrero_kk8e"}' http://localhost:3000/api/arca/consultar-cuit`);

    console.log('\n--- Testing API /api/arca/consultar-cuit via localhost:3000 (Manuel Guerrero - themselves) ---');
    await executeCommand(conn, `curl -s -X POST -H "Content-Type: application/json" -d '{"cuit":"20347467228","userId":"rmanuelguerrero_kk8e"}' http://localhost:3000/api/arca/consultar-cuit`);

    console.log('\n--- Testing API /api/arca/consultar-cuit via localhost:3000 (Non-existent CUIT) ---');
    await executeCommand(conn, `curl -s -X POST -H "Content-Type: application/json" -d '{"cuit":"30714207865","userId":"rmanuelguerrero_kk8e"}' http://localhost:3000/api/arca/consultar-cuit`);

    console.log('\n');
    conn.end();
  } catch (error) {
    console.error('Error:', error);
    conn.end();
  }
}).connect(config);
