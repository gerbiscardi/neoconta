# restore_pc.ps1
# Script para ejecutar en esta PC cuando regreses el lunes para restaurar los cambios de la notebook.

$userProfile = $env:USERPROFILE
$targetProject = Join-Path $userProfile ".gemini\antigravity\scratch\neoconta"
$targetBrain = Join-Path $userProfile ".gemini\antigravity\brain"
$desktopPath = [Environment]::GetFolderPath("Desktop")
$zipPath = Join-Path $desktopPath "NeoConta_Retorno.zip"

Write-Host "Restaurando cambios de la Notebook en esta PC..."

# 1. Verificar si existe el archivo de retorno en el Escritorio
if (-not (Test-Path $zipPath)) {
    Write-Error "No se encontro el archivo ZIP de retorno en el Escritorio: $zipPath"
    Write-Warning "Por favor, copia el archivo 'NeoConta_Retorno.zip' al Escritorio de esta PC e intenta de nuevo."
    Read-Host "Presiona Enter para salir..."
    exit 1
}

# 2. Crear un directorio temporal de extracción
$tempDir = Join-Path $env:TEMP "Neoconta_Restore_PC_$(Get-Random)"
New-Item -ItemType Directory -Path $tempDir | Out-Null

try {
    # 3. Descomprimir el ZIP
    Write-Host "Descomprimiendo el archivo de retorno..."
    Expand-Archive -Path $zipPath -DestinationPath $tempDir -Force

    # 4. Copiar los archivos del proyecto
    $extractedProject = Join-Path $tempDir "neoconta"
    if (Test-Path $extractedProject) {
        Write-Host "Actualizando archivos del proyecto NeoConta..."
        # Usamos robocopy para sincronizar de forma robusta, excluyendo directorios pesados
        # Esto conservara 'node_modules' y '.next' intactos en esta PC sin borrarlos ni tocarlos
        robocopy "$extractedProject" "$targetProject" /E /XD "node_modules" ".next" "tmp" ".swc" /R:1 /W:1
        if ($LASTEXITCODE -lt 8) { $global:LASTEXITCODE = 0 }
    } else {
        Write-Warning "No se encontro la carpeta 'neoconta' en el ZIP extraido."
    }

    # 5. Copiar los archivos de Antigravity (brain)
    $extractedBrain = Join-Path $tempDir "antigravity_brain"
    if (Test-Path $extractedBrain) {
        Write-Host "Actualizando historial de Antigravity (brain)..."
        robocopy "$extractedBrain" "$targetBrain" /E /R:1 /W:1
        if ($LASTEXITCODE -lt 8) { $global:LASTEXITCODE = 0 }
    } else {
        Write-Warning "No se encontro la carpeta 'antigravity_brain' en el ZIP extraido."
    }

    Write-Host "`n========================================================" -ForegroundColor Green
    Write-Host "¡Cambios de la notebook restaurados exitosamente en tu PC!" -ForegroundColor Green
    Write-Host "Código del proyecto e historial de conversaciones actualizados." -ForegroundColor Green
    Write-Host "========================================================" -ForegroundColor Green

} catch {
    Write-Error "Ocurrio un error al restaurar los archivos: $_"
} finally {
    # Limpiar archivos temporales
    if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue }
}

Read-Host "Presiona Enter para finalizar..."
