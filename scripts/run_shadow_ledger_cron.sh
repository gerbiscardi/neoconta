#!/usr/bin/env bash
# ==============================================================================
# NeoConta - Shadow Forecast Ledger Automated Cron Runner
# ==============================================================================
# Este script se ejecuta mediante cron del sistema (programado a las 06:00 UTC = 03:00 ART)
# Realiza la llamada autenticada al endpoint interno del ledger con fail-closed,
# control de reintentos, registro de auditoría y guardado de última ejecución exitosa.
# ==============================================================================

set -euo pipefail

ENV_FILE="/var/www/neoconta/.env"
LOG_DIR="/var/log/neoconta"
LOG_FILE="${LOG_DIR}/cron_ledger.log"
SUCCESS_RECORD="/var/www/neoconta/data/cron_ledger_last_success.json"
MAX_RETRIES=3
RETRY_DELAY=5

mkdir -p "${LOG_DIR}"
mkdir -p "/var/www/neoconta/data"

log_msg() {
    local timestamp
    timestamp=$(TZ="America/Argentina/Buenos_Aires" date '+%Y-%m-%d %H:%M:%S %Z')
    echo "[${timestamp}] $1" >> "${LOG_FILE}"
}

if [ ! -f "${ENV_FILE}" ]; then
    log_msg "ERROR CRÍTICO: Archivo de entorno ${ENV_FILE} no encontrado. Ejecución cancelada."
    exit 1
fi

# Extraer CRON_SECRET de manera segura sin exponerlo
CRON_SECRET=$(grep '^CRON_SECRET=' "${ENV_FILE}" | cut -d '=' -f2- | tr -d ' "\r\n')

if [ -z "${CRON_SECRET}" ] || [ ${#CRON_SECRET} -lt 32 ]; then
    log_msg "ERROR CRÍTICO: CRON_SECRET no está configurado o tiene entropía insuficiente (< 32 caracteres)."
    exit 1
fi

log_msg "Iniciando ejecución programada de Shadow Forecast Ledger..."

attempt=1
success=0

while [ $attempt -le $MAX_RETRIES ]; do
    log_msg "Intento $attempt de $MAX_RETRIES: invocando endpoint interno..."
    
    # Realizar petición HTTP local con timeout de 30 segundos
    HTTP_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET \
        -H "Authorization: Bearer ${CRON_SECRET}" \
        -H "User-Agent: NeoConta-Internal-Cron/1.0" \
        --max-time 30 \
        "http://127.0.0.1:3000/api/cron/forecasting-ledger" || echo -e "\n000")
    
    HTTP_BODY=$(echo "${HTTP_RESPONSE}" | sed '$d')
    HTTP_STATUS=$(echo "${HTTP_RESPONSE}" | tail -n1)
    
    if [ "${HTTP_STATUS}" -eq 200 ]; then
        log_msg "Ejecución exitosa (HTTP 200). Respuesta: ${HTTP_BODY}"
        
        # Registrar metadatos de última ejecución exitosa
        EXEC_TIME=$(TZ="America/Argentina/Buenos_Aires" date -Iseconds)
        cat <<EOF > "${SUCCESS_RECORD}"
{
  "lastSuccessfulExecution": "${EXEC_TIME}",
  "httpStatus": 200,
  "timezone": "America/Argentina/Buenos_Aires",
  "status": "success",
  "responseSummary": ${HTTP_BODY}
}
EOF
        chmod 600 "${SUCCESS_RECORD}" 2>/dev/null || true
        success=1
        break
    else
        log_msg "Fallo en intento $attempt (HTTP Status: ${HTTP_STATUS}). Respuesta: ${HTTP_BODY}"
        attempt=$((attempt + 1))
        if [ $attempt -le $MAX_RETRIES ]; then
            log_msg "Esperando ${RETRY_DELAY} segundos antes de reintentar..."
            sleep ${RETRY_DELAY}
        fi
    fi
done

if [ $success -eq 1 ]; then
    log_msg "Tarea programada de Shadow Forecast Ledger completada satisfactoriamente."
    exit 0
else
    log_msg "ERROR CRÍTICO: La tarea de Shadow Forecast Ledger falló tras $MAX_RETRIES intentos."
    exit 1
fi
