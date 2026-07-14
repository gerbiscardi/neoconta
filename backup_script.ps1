# backup_script.ps1
# Script para empaquetar el proyecto NeoConta y el historial de Antigravity (brain) para el fin de semana.

$userProfile = $env:USERPROFILE
$sourceProject = Join-Path $userProfile ".gemini\antigravity\scratch\neoconta"
$sourceBrain = Join-Path $userProfile ".gemini\antigravity\brain"
$desktopPath = [Environment]::GetFolderPath("Desktop")
$stagingDir = Join-Path $desktopPath "NeoConta_Respaldo_Staging"
$zipPath = Join-Path $desktopPath "NeoConta_Respaldo_Finde.zip"

# 1. Crear directorio temporal de staging
if (Test-Path $stagingDir) { Remove-Item $stagingDir -Recurse -Force }
New-Item -ItemType Directory -Path $stagingDir | Out-Null
Write-Host "Creado directorio temporal de staging: $stagingDir"

# 2. Copiar archivos del proyecto
$projectDest = Join-Path $stagingDir "neoconta"
New-Item -ItemType Directory -Path $projectDest | Out-Null
Write-Host "Copiando archivos del proyecto (excluyendo node_modules y cache)..."
robocopy "$sourceProject" "$projectDest" /E /XD "node_modules" ".next" "tmp" ".swc" /R:1 /W:1
if ($LASTEXITCODE -lt 8) { $global:LASTEXITCODE = 0 }

# 3. Copiar historial de Antigravity (brain)
$brainDest = Join-Path $stagingDir "antigravity_brain"
New-Item -ItemType Directory -Path $brainDest | Out-Null
Write-Host "Copiando historial de Antigravity (brain)..."
robocopy "$sourceBrain" "$brainDest" /E /R:1 /W:1
if ($LASTEXITCODE -lt 8) { $global:LASTEXITCODE = 0 }

# 4. Copiar scripts y documentacion al root del staging para facil ejecucion
Write-Host "Copiando scripts de migracion e instrucciones al root del staging..."
Copy-Item -Path "$sourceProject\restore_notebook.ps1" -Destination $stagingDir -Force -ErrorAction SilentlyContinue
Copy-Item -Path "$sourceProject\backup_notebook.ps1" -Destination $stagingDir -Force -ErrorAction SilentlyContinue
Copy-Item -Path "$sourceProject\restore_pc.ps1" -Destination $stagingDir -Force -ErrorAction SilentlyContinue
Copy-Item -Path "$sourceProject\INSTRUCCIONES_MIGRACION.txt" -Destination $stagingDir -Force -ErrorAction SilentlyContinue

# 5. Comprimir a ZIP
Write-Host "Comprimiendo todo a ZIP..."
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path "$stagingDir\*" -DestinationPath $zipPath -Force

# 6. Limpieza
Remove-Item $stagingDir -Recurse -Force
Write-Host "`n========================================================" -ForegroundColor Green
Write-Host "¡Empaquetado completado con éxito para el fin de semana!" -ForegroundColor Green
Write-Host "El archivo se guardo en: $zipPath" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
