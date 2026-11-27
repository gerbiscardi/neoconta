# GUÍA MAESTRA DE MIGRACIÓN Y RESTAURACIÓN DE SERVIDOR — NEOCONTA

Esta guía detalla el procedimiento paso a paso para migrar, restaurar y poner en producción **NeoConta** en cualquier nuevo servidor Linux (Ubuntu 22.04 LTS o Ubuntu 24.04 LTS) o máquina de desarrollo, garantizando continuidad operativa total, aislamiento multiempresa y preservación de todas las bases de datos, usuarios, certificados fiscales AFIP/ARCA e historiales.

---

## 1. ARQUITECTURA DEL SISTEMA

| Componente | Tecnología | Puerto Interno | Función |
| :--- | :--- | :--- | :--- |
| **Frontend & API Core** | Next.js 14 (Node.js 22 LTS) | `3000` | Interfaz, APIs de negocio, Commander BI, Commentor, Facturación y Vitacore |
| **Motor Data Science** | FastAPI / Python 3 (uvicorn) | `8000` | Microservicio de modelos predictivos y pronósticos financieros (`neoconta-ds`) |
| **Base de Datos** | SQLite 3 vía Prisma ORM | Archivo local | Persistencia ACID (`prisma/neoconta.db`) y archivos JSON por empresa en `data/` |
| **Gestor de Procesos** | PM2 | Daemon | Monitorización, autorreinicio y rotación de logs |
| **Reverse Proxy & SSL** | Nginx + Certbot | `80` / `443` | Terminación TLS 1.2/1.3, compresión gzip, WebSocket y enrutamiento seguro |

---

## 2. REQUISITOS DEL NUEVO SERVIDOR

- **Sistema Operativo:** Ubuntu 22.04 LTS o 24.04 LTS (64-bit).
- **Recursos recomendados:** 2 vCPU, 2 GB RAM (mínimo 1 GB con swap de 2 GB), 20 GB SSD.
- **Acceso:** Acceso root o usuario con privilegios `sudo`.
- **Puertos de Red:** `22` (SSH), `80` (HTTP), `443` (HTTPS) habilitados en el firewall del proveedor cloud (Hetzner, AWS, DigitalOcean, DonWeb, etc.).

---

## 3. MÉTODO 1: MIGRACIÓN AUTOMATIZADA DESDE GITHUB (RECOMENDADO)

Este método permite levantar el servidor completo clonando directamente desde GitHub y restaurando los datos operativos mediante el snapshot cifrado de grado militar (`backups/system_snapshot.enc`).

### Paso 1: Aprovisionamiento del Sistema Operativo
En el nuevo servidor, inicie sesión como `root` y ejecute:
```bash
# 1. Instalar git
apt-get update -y && apt-get install -y git

# 2. Clonar el repositorio
mkdir -p /var/www
cd /var/www
git clone https://github.com/tu-usuario/neoconta.git
cd neoconta

# 3. Ejecutar el script automatizado de aprovisionamiento
chmod +x deploy/setup_server.sh
./deploy/setup_server.sh
```
*El script instala Node.js 22 LTS, PM2, Python 3, venv, Nginx, Certbot y configura el cortafuegos UFW.*

### Paso 2: Desencriptar y Restaurar Datos Operativos
El repositorio incluye el snapshot cifrado (`backups/system_snapshot.enc`) que contiene la base de datos SQLite, todos los usuarios, certificados y facturas:
```bash
# Ejecutar restauración
node scripts/restore_system.mjs
```
*(Si utiliza una clave personalizada, puede pasarla con `--key "TU_CLAVE"` o configurar `MIGRATION_KEY` en el entorno).*

Al finalizar, el script verificará:
- La creación de `prisma/neoconta.db` con sus 11 tablas y registros verificados.
- La restauración del directorio `data/` con todos los certificados fiscales AFIP, tokens y usuarios.
- La restauración de `.env.production` con las variables maestras.

### Paso 3: Instalación de Dependencias y Compilación
```bash
# Instalar dependencias de producción
npm install

# Generar cliente de base de datos Prisma
npx prisma generate

# Compilar la aplicación Next.js para producción
npm run build
```

### Paso 4: Iniciar los Servicios con PM2
```bash
# Iniciar frontend y microservicio Data Science
pm2 start ecosystem.config.js

# Guardar la lista de procesos para reinicio automático tras reboot
pm2 save
```

### Paso 5: Apuntar el Dominio y Emitir Certificados SSL
1. En su panel de DNS (ej. Cloudflare, DonWeb, NIC.ar), actualice el registro tipo **A**:
   - `neoconta.com.ar` -> `IP_DEL_NUEVO_SERVIDOR`
   - `www.neoconta.com.ar` -> `IP_DEL_NUEVO_SERVIDOR`
2. Una vez propagado el DNS, ejecute Certbot:
```bash
certbot --nginx -d neoconta.com.ar -d www.neoconta.com.ar
```
3. Reinicie Nginx:
```bash
systemctl reload nginx
```

---

## 4. MÉTODO 2: MIGRACIÓN MEDIANTE EL ARCHIVO ZIP COMPLETO

Si prefiere transferir el backup completo generado en su computadora (`NEOCONTA_BACKUP_COMPLETO_20261127.zip` ubicado en el Escritorio):

### Paso 1: Subir el archivo al nuevo servidor
Desde PowerShell en su computadora local:
```powershell
scp "C:\Users\Germán Biscardi\Desktop\NEOCONTA_BACKUP_COMPLETO_20261127.zip" root@IP_DEL_NUEVO_SERVIDOR:/var/www/
```

### Paso 2: Descomprimir y Ejecutar Restauración
En el nuevo servidor:
```bash
cd /var/www
apt-get install -y unzip
unzip NEOCONTA_BACKUP_COMPLETO_20261127.zip -d neoconta
cd neoconta

# Dar permisos y ejecutar script de aprovisionamiento
chmod +x deploy/setup_server.sh
./deploy/setup_server.sh

# Restaurar datos y compilar
chmod +x restore_server.sh
./restore_server.sh

# Configurar SSL
certbot --nginx -d neoconta.com.ar -d www.neoconta.com.ar
```

---

## 5. DICCIONARIO MÉDICO PESADO (VITACORE)

El archivo `data/glosario_medico_bilingue.sqlite` (1.85 GB) es un catálogo estático de terminología médica.
- Se encuentra 100% preservado en la carpeta de backup local en su computadora:
  `backups/NEOCONTA_LOCAL_SYSTEM_BACKUP_20261127/data/glosario_medico_bilingue.sqlite`
- Para transferirlo al nuevo servidor:
```powershell
scp "C:\Users\Germán Biscardi\.gemini\antigravity\scratch\neoconta\backups\NEOCONTA_LOCAL_SYSTEM_BACKUP_20261127\data\glosario_medico_bilingue.sqlite" root@IP_DEL_NUEVO_SERVIDOR:/var/www/neoconta/data/
```

---

## 6. COMANDOS ÚTILES DE MANTENIMIENTO EN EL SERVIDOR

| Acción | Comando |
| :--- | :--- |
| **Ver estado de los servicios** | `pm2 status` |
| **Ver logs en tiempo real** | `pm2 logs neoconta` o `pm2 logs neoconta-ds` |
| **Reiniciar la aplicación** | `pm2 reload neoconta` (cero downtime) |
| **Ver estado de Nginx** | `systemctl status nginx` |
| **Probar configuración Nginx** | `nginx -t` |
| **Verificar base de datos SQLite** | `sqlite3 prisma/neoconta.db "SELECT count(*) FROM User;"` |
| **Crear nuevo snapshot cifrado** | `node scripts/backup_manager.mjs` |

---

## 7. CHECKLIST DE VERIFICACIÓN POST-MIGRACIÓN

Una vez finalizada la restauración, verificar en el navegador:
- [ ] Acceso seguro HTTPS a `https://neoconta.com.ar` (candado verde TLS válido).
- [ ] Redirección automática de HTTP a HTTPS.
- [ ] Endpoint de salud del microservicio: `https://neoconta.com.ar/api-ds/health` responde `{"status":"ok"}`.
- [ ] Inicio de sesión correcto con credenciales de usuario y Owner.
- [ ] Dashboard de Commander BI cargando KPIs y gráficos financieros.
- [ ] Módulo Commentor cargando auditorías de reputación sin errores.
- [ ] Certificados fiscales AFIP cargados en la configuración de la empresa.
