$ErrorActionPreference = 'Stop'

$projectDir = (Get-Item $PSScriptRoot).Parent.FullName
$stagingDir = "$projectDir\deploy_staging"
$zipPath = "$projectDir\neoconta_deploy.zip"

Write-Host "Creating deployment staging directory at $stagingDir..."
if (Test-Path $stagingDir) { Remove-Item $stagingDir -Recurse -Force }
New-Item -ItemType Directory -Path $stagingDir | Out-Null

Write-Host "Copying NeoConta project using Robocopy (excluding heavy/dev folders)..."
# Robocopy exit codes: 0-7 are success/no-change/copy-successful. 8+ are errors.
$exitCode = 0
try {
    robocopy $projectDir $stagingDir /XD node_modules .next .venv .git deploy_staging migracion_staging /XF *.zip /S /R:1 /W:1 /NDL /NFL /NJH /NJS
} catch {
    # robocopy returns non-zero even on success, so we catch errors manually if needed
}

Write-Host "Creating deployment zip file..."
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($stagingDir, $zipPath, [System.IO.Compression.CompressionLevel]::Fastest, $false)

Write-Host "Cleaning up staging directory..."
Remove-Item $stagingDir -Recurse -Force

Write-Host "Done! Deployment bundle created at $zipPath"
