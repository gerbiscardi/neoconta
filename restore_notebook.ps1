# restore_notebook.ps1
# Script para ejecutar en la notebook para desempaquetar el proyecto y el historial.

$userProfile = $env:USERPROFILE
$targetProject = Join-Path $userProfile ".gemini\antigravity\scratch\neoconta"
$targetBrain = Join-Path $userProfile ".gemini\antigravity\brain"

Write-Host "Restaurando entorno en tu Notebook..."

# 1. Asegurar que existan los directorios de destino
if (-not (Test-Path $targetProject)) {
    New-Item -ItemType Directory -Path $targetProject -Force | Out-Null
    Write-Host "Creado directorio del proyecto: $targetProject"
}
if (-not (Test-Path $targetBrain)) {
    New-Item -ItemType Directory -Path $targetBrain -Force | Out-Null
    Write-Host "Creado directorio de Antigravity (brain): $targetBrain"
}

# 2. Rutas locales de origen (dentro del zip extraído)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$sourceProject = Join-Path $scriptDir "neoconta"
$sourceBrain = Join-Path $scriptDir "antigravity_brain"

# Copiar el Proyecto
if (Test-Path $sourceProject) {
    Write-Host "Copiando archivos del proyecto NeoConta..."
    # Robocopy para mayor robustez
    robocopy "$sourceProject" "$targetProject" /E /XD "node_modules" ".next" "tmp" ".swc" /R:1 /W:1
    if ($LASTEXITCODE -lt 8) { $global:LASTEXITCODE = 0 }
} else {
    Write-Error "No se encontro la carpeta de origen 'neoconta' en el directorio del script: $sourceProject"
    Read-Host "Presiona Enter para salir..."
    exit 1
}

# Copiar el Brain
if (Test-Path $sourceBrain) {
    Write-Host "Restaurando historial de Antigravity (brain)..."
    robocopy "$sourceBrain" "$targetBrain" /E /R:1 /W:1
    if ($LASTEXITCODE -lt 8) { $global:LASTEXITCODE = 0 }
} else {
    Write-Error "No se encontro la carpeta de origen 'antigravity_brain' en el directorio del script: $sourceBrain"
    Read-Host "Presiona Enter para salir..."
    exit 1
}

# Copiar scripts adicionales al proyecto para que el usuario pueda usarlos directamente
Copy-Item -Path (Join-Path $scriptDir "backup_notebook.ps1") -Destination $targetProject -Force -ErrorAction SilentlyContinue
Copy-Item -Path (Join-Path $scriptDir "restore_pc.ps1") -Destination $targetProject -Force -ErrorAction SilentlyContinue

Write-Host "`n========================================================" -ForegroundColor Green
Write-Host "¡Entorno restaurado exitosamente en tu notebook!" -ForegroundColor Green
Write-Host "Proyecto en: $targetProject" -ForegroundColor Green
Write-Host "Historial en: $targetBrain" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Read-Host "Presiona Enter para finalizar..."
