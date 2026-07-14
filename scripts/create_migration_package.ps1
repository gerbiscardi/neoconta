$ErrorActionPreference = 'Stop'

$projectDir = (Get-Item $PSScriptRoot).Parent.FullName
$antigravityDir = (Get-Item $projectDir).Parent.Parent.FullName
$stagingDir = "$projectDir\migracion_staging"
$zipPath = "$projectDir\NeoConta_Migration_Package.zip"

Write-Host "Project dir: $projectDir"
Write-Host "Antigravity dir: $antigravityDir"

Write-Host "Creating staging directory at $stagingDir..."
if (Test-Path $stagingDir) { Remove-Item $stagingDir -Recurse -Force }
New-Item -ItemType Directory -Path $stagingDir | Out-Null
New-Item -ItemType Directory -Path "$stagingDir\antigravity" | Out-Null
New-Item -ItemType Directory -Path "$stagingDir\antigravity\scratch" | Out-Null

Write-Host "Copying NeoConta project (excluding node_modules and .next)..."
$neocontaDest = "$stagingDir\antigravity\scratch\neoconta"
New-Item -ItemType Directory -Path $neocontaDest | Out-Null
Get-ChildItem -Path $projectDir -Exclude "node_modules", ".next", "migracion_staging", "*.zip" | ForEach-Object {
    Copy-Item -Path $_.FullName -Destination $neocontaDest -Recurse -Force
}

Write-Host "Copying Antigravity History..."
$foldersToCopy = @("brain", "conversations", "knowledge", "implicit")
foreach ($folder in $foldersToCopy) {
    $src = "$antigravityDir\$folder"
    $dest = "$stagingDir\antigravity\$folder"
    if (Test-Path $src) {
        Write-Host "  Copying $folder..."
        Copy-Item -Path $src -Destination $dest -Recurse -Force
    }
}

Write-Host "Creating zip file..."
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($stagingDir, $zipPath, [System.IO.Compression.CompressionLevel]::Fastest, $false)

Write-Host "Cleaning up staging directory..."
Remove-Item $stagingDir -Recurse -Force

Write-Host "Done! Package created at $zipPath"
