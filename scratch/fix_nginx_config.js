const { Client } = require('ssh2');

const conn = new Client();
const config = {
  host: '200.58.98.237',
  port: 22,
  username: 'root',
  password: '3/TJwP1VTp5Okv'
};

const nginxConfigContent = `server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name neoconta.com.ar www.neoconta.com.ar;
    client_max_body_size 100M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api-ds/ {
        proxy_pass http://localhost:8000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
`;

conn.on('ready', () => {
  console.log('SSH connection established. Writing Nginx config...');
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const stream = sftp.createWriteStream('/etc/nginx/sites-available/neoconta');
    stream.on('close', () => {
      console.log('Nginx config file written. Testing and restarting...');
      conn.exec('nginx -t && systemctl restart nginx', (err2, cmdStream) => {
        if (err2) throw err2;
        cmdStream.on('close', (code) => {
          console.log(`Nginx restart exited with code ${code}`);
          conn.end();
        }).on('data', (data) => {
          process.stdout.write(data.toString());
        }).stderr.on('data', (data) => {
          process.stderr.write(data.toString());
        });
      });
    });
    stream.write(nginxConfigContent);
    stream.end();
  });
}).connect(config);
