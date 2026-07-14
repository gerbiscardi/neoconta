param(
    [Parameter(Mandatory = $true)]
    [string]$ZipFilePath
)

$userProfile = $env:USERPROFILE
$targetProject = Join-Path $userProfile ".gemini\antigravity\scratch\neoconta"
$targetBrain = Join-Path $userProfile ".gemini\antigravity\brain"

# Validate ZIP
if (-not (Test-Path $ZipFilePath)) {
    Write-Error "El archivo ZIP no existe: $ZipFilePath"
    exit 1
}

Write-Host "ADVERTENCIA: Esto sobrescribirá el proyecto actual en:"
Write-Host "  $targetProject"
Write-Host "  (El brain NO se sobrescribirá automáticamente para evitar pérdidas de historial local, se extraerá a una carpeta temporal)"
$confirmation = Read-Host "¿Estás seguro de continuar? (S/N)"

if ($confirmation -ne 'S') {
    Write-Host "Operación cancelada."
    exit
}

# Add utils for zip
Add-Type -AssemblyName System.IO.Compression.FileSystem

# Create Temp Extract Dir
$tempDir = Join-Path $env:TEMP "Neoconta_Restore_$(Get-Random)"
New-Item -ItemType Directory -Path $tempDir | Out-Null

try {
    Write-Host "Extrayendo ZIP..."
    [System.IO.Compression.ZipFile]::ExtractToDirectory($ZipFilePath, $tempDir)

    # Restore Project
    $extractedProject = Join-Path $tempDir "neoconta"
    if (Test-Path $extractedProject) {
        Write-Host "Restaurando proyecto NeoConta..."
        # We need to be careful not to delete .next or node_modules if they work, but usually a clean restore is safer.
        # However, deleting node_modules is slow and users hate reinstalling.
        # Let's use Robocopy to MIRROR the source content, which deletes extra files in dest but keeps ignored ones if we exclude them.
        # Check if Robocopy is better or just Copy-Item with Force.
        
        # Strategy: 
        # 1. Backup local config files just in case (.env)
        # 2. Copy over, overwriting.
        
        Write-Host "Copiando archivos del proyecto (Sobrescribiendo)..."
        Copy-Item -Path "$extractedProject\*" -Destination $targetProject -Recurse -Force
        
        Write-Host "Proyecto restaurado."
    }
    else {
        Write-Warning "No se encontró la carpeta 'neoconta' en el ZIP."
    }

    # Handle Brain (Just extract to Desktop for manual merge is safer)
    $extractedBrain = Join-Path $tempDir "antigravity_brain"
    if (Test-Path $extractedBrain) {
        $brainRestorePath = Join-Path $env:USERPROFILE "Desktop\Brain_Restored_From_Notebook"
        if (Test-Path $brainRestorePath) { Remove-Item $brainRestorePath -Recurse -Force }
        Move-Item $extractedBrain $brainRestorePath
        Write-Host "Historial de Antigravity extraído en: $brainRestorePath"
        Write-Host "  (Copia manual los archivos que necesites a $targetBrain)"
    }

}
finally {
    Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "Proceso completado."
