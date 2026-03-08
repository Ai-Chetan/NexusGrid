param(
    [Parameter(Mandatory = $true)]
    [string]$ConnectionString,

    [Parameter(Mandatory = $true)]
    [string]$InputFile
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -Path $InputFile)) {
    throw "Backup file not found: $InputFile"
}

Write-Host "Restoring tenant DB from $InputFile"
Get-Content -Path $InputFile -Raw | psql "$ConnectionString"
Write-Host "Restore completed from $InputFile"
