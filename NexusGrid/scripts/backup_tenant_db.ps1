param(
    [Parameter(Mandatory = $true)]
    [string]$ConnectionString,

    [Parameter(Mandatory = $true)]
    [string]$OutputFile
)

$ErrorActionPreference = "Stop"

$outputDir = Split-Path -Path $OutputFile -Parent
if ($outputDir -and -not (Test-Path -Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

Write-Host "Starting tenant DB backup to $OutputFile"
pg_dump "$ConnectionString" | Out-File -FilePath $OutputFile -Encoding utf8
Write-Host "Backup completed: $OutputFile"
