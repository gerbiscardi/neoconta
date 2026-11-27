module.exports = {
  apps: [
    {
      name: 'neoconta',
      cwd: '/var/www/neoconta',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      restart_delay: 3000,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/var/log/neoconta/app-error.log',
      out_file: '/var/log/neoconta/app-out.log',
      merge_logs: true
    },
    {
      name: 'neoconta-ds',
      cwd: '/var/www/neoconta/neoconta-ds',
      script: '/bin/bash',
      args: '-c "./prod_env/bin/python3 -m uvicorn main:app --host 127.0.0.1 --port 8000 || python3 -m uvicorn main:app --host 127.0.0.1 --port 8000"',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      restart_delay: 3000,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/var/log/neoconta/ds-error.log',
      out_file: '/var/log/neoconta/ds-out.log',
      merge_logs: true
    }
  ]
};
