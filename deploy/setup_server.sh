#!/bin/bash
# ==============================================================================
# NEOCONTA — AUTOMATED SERVER PROVISIONING & SETUP SCRIPT
# Target OS: Ubuntu 22.04 LTS / 24.04 LTS
# ==============================================================================
set -e

echo "=========================================================="
echo " Starting NeoConta Server Provisioning"
echo "=========================================================="

# 1. Actualizar repositorios del sistema
echo "[1/7] Actualizando paquetes del sistema..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y && apt-get upgrade -y
apt-get install -y curl wget git build-essential sqlite3 python3 python3-pip python3-venv nginx certbot python3-certbot-nginx ufw rsync

# 2. Instalar Node.js 22 LTS
echo "[2/7] Instalando Node.js 22 LTS y PM2..."
if ! command -v node &> /dev/null || [[ $(node -v | cut -d'.' -f1) != "v22" ]]; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
fi
echo "Node version: $(node -v)"
echo "NPM version: $(npm -v)"

npm install -g pm2
pm2 install pm2-logrotate || true
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 10

# 3. Crear directorios de la aplicación y logs
echo "[3/7] Creando estructura de directorios..."
mkdir -p /var/www/neoconta
mkdir -p /var/log/neoconta
mkdir -p /var/www/html/.well-known/acme-challenge
chmod -R 755 /var/www/html

# 4. Configurar cortafuegos UFW
echo "[4/7] Configurando cortafuegos UFW..."
ufw allow 22/tcp || true
ufw allow 80/tcp || true
ufw allow 443/tcp || true
ufw --force enable || true

# 5. Configurar Nginx
echo "[5/7] Configurando Nginx para NeoConta..."
if [ -f "/var/www/neoconta/deploy/nginx/neoconta.conf" ]; then
    cp /var/www/neoconta/deploy/nginx/neoconta.conf /etc/nginx/sites-available/neoconta.conf
    ln -sf /etc/nginx/sites-available/neoconta.conf /etc/nginx/sites-enabled/neoconta.conf
    rm -f /etc/nginx/sites-enabled/default
    nginx -t && systemctl reload nginx || echo "Advertencia: Nginx recarga pendiente de certificados SSL."
fi

# 6. Preparar entorno Python para neoconta-ds
echo "[6/7] Configurando microservicio neoconta-ds..."
if [ -d "/var/www/neoconta/neoconta-ds" ]; then
    cd /var/www/neoconta/neoconta-ds
    python3 -m venv prod_env
    ./prod_env/bin/pip install --upgrade pip
    if [ -f "pyproject.toml" ]; then
        ./prod_env/bin/pip install fastapi uvicorn pydantic scikit-learn numpy pandas
    fi
    cd /var/www/neoconta
fi

# 7. Configurar servicio de inicio automático PM2
echo "[7/7] Configurando persistencia PM2..."
env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root || true

echo "=========================================================="
echo " Aprovisionamiento base completado con éxito."
echo " Siguientes pasos:"
echo " 1. Clonar el repositorio en /var/www/neoconta (si aún no lo hizo)"
echo " 2. Restaurar datos y base de datos con: node scripts/restore_system.mjs"
echo " 3. Ejecutar: npm install && npx prisma generate && npm run build"
echo " 4. Iniciar servicios: pm2 start ecosystem.config.js && pm2 save"
echo " 5. Emitir SSL: certbot --nginx -d neoconta.com.ar -d www.neoconta.com.ar"
echo "=========================================================="
