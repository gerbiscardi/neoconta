# backup_notebook.ps1
# Script para ejecutar en la notebook al finalizar el fin de semana para empaquetar los cambios.

$userProfile = $env:USERPROFILE
$sourceProject = Join-Path $userProfile ".gemini\antigravity\scratch\neoconta"
$sourceBrain = Join-Path $userProfile ".gemini\antigravity\brain"
$desktopPath = [Environment]::GetFolderPath("Desktop")
$stagingDir = Join-Path $desktopPath "Retorno_NeoConta_Staging"
$zipPath = Join-Path $desktopPath "NeoConta_Retorno.zip"

Write-Host "Generando paquete de retorno desde la Notebook..."

# 1. Limpiar y crear directorio temporal de staging
if (Test-Path $stagingDir) { Remove-Item $stagingDir -Recurse -Force }
New-Item -ItemType Directory -Path $stagingDir | Out-Null

# 2. Copiar archivos del proyecto
$projectDest = Join-Path $stagingDir "neoconta"
New-Item -ItemType Directory -Path $projectDest | Out-Null
Write-Host "Copiando archivos del proyecto (excluyendo node_modules, cache)..."
robocopy "$sourceProject" "$projectDest" /E /XD "node_modules" ".next" "tmp" ".swc" /R:1 /W:1
if ($LASTEXITCODE -lt 8) { $global:LASTEXITCODE = 0 }

# 3. Copiar archivos de Antigravity (brain)
$brainDest = Join-Path $stagingDir "antigravity_brain"
New-Item -ItemType Directory -Path $brainDest | Out-Null
Write-Host "Copiando historial de Antigravity (brain)..."
robocopy "$sourceBrain" "$brainDest" /E /R:1 /W:1
if ($LASTEXITCODE -lt 8) { $global:LASTEXITCODE = 0 }

# 4. Copiar scripts y documentación al root del staging para fácil acceso en la PC
Copy-Item -Path "$sourceProject\restore_pc.ps1" -Destination $stagingDir -ErrorAction SilentlyContinue
Copy-Item -Path "$sourceProject\INSTRUCCIONES_MIGRACION.txt" -Destination $stagingDir -ErrorAction SilentlyContinue

# 5. Comprimir el staging a ZIP
Write-Host "Comprimiendo todo a ZIP..."
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path "$stagingDir\*" -DestinationPath $zipPath -Force

# 6. Limpiar directorio staging
Remove-Item $stagingDir -Recurse -Force

Write-Host "`n========================================================" -ForegroundColor Green
Write-Host "¡Respaldo para retorno completado con éxito!" -ForegroundColor Green
Write-Host "El archivo se guardó en: $zipPath" -ForegroundColor Green
Write-Host "Llevá este archivo a tu PC de escritorio la semana próxima." -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Read-Host "Presiona Enter para finalizar..."
