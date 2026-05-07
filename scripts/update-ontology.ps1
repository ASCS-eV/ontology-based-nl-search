#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Updates the ontology-management-base submodule to the latest main.
.DESCRIPTION
  Navigates the nested submodule chain, fetches and checks out latest
  origin/main for OMB, then returns to the project root.
  Run after OMB merges to keep ontology definitions current.
.EXAMPLE
  ./scripts/update-ontology.ps1
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if (-not $ProjectRoot) { $ProjectRoot = Get-Location }

$OmbRelativePath = "submodules/hd-map-asset-example/submodules/sl-5-8-asset-tools/submodules/ontology-management-base"
$OmbPath = Join-Path $ProjectRoot $OmbRelativePath

if (-not (Test-Path $OmbPath)) {
    Write-Error "OMB submodule not found at: $OmbPath`nRun 'git submodule update --init --recursive' first."
    exit 1
}

Write-Host "📦 Updating ontology-management-base..." -ForegroundColor Cyan

Push-Location $OmbPath
try {
    git fetch origin main 2>&1 | Out-Null
    $before = git rev-parse HEAD
    git checkout origin/main 2>&1 | Out-Null
    $after = git rev-parse HEAD

    if ($before -eq $after) {
        Write-Host "✅ Already up to date at $($before.Substring(0,8))" -ForegroundColor Green
    } else {
        $count = git log --oneline "$before..$after" | Measure-Object | Select-Object -ExpandProperty Count
        Write-Host "✅ Updated: $($before.Substring(0,8)) → $($after.Substring(0,8)) ($count new commits)" -ForegroundColor Green
    }
} finally {
    Pop-Location
}

Write-Host "`n🔍 Validating ontology sources..." -ForegroundColor Cyan

# Quick validation: check that key SHACL files still exist
$artifactsPath = Join-Path $OmbPath "artifacts"
$shaclFiles = Get-ChildItem -Path $artifactsPath -Recurse -Filter "*.shacl.ttl" -ErrorAction SilentlyContinue
if ($shaclFiles.Count -eq 0) {
    Write-Error "No *.shacl.ttl files found in $artifactsPath — OMB structure may have changed!"
    exit 1
}
Write-Host "  Found $($shaclFiles.Count) SHACL shape files across domains" -ForegroundColor Gray

# List discovered domains
$domains = $shaclFiles | ForEach-Object { $_.Directory.Name } | Sort-Object -Unique
Write-Host "  Domains: $($domains -join ', ')" -ForegroundColor Gray

Write-Host "`n✅ Ontology update complete. Run 'npm run validate' to verify integration." -ForegroundColor Green
