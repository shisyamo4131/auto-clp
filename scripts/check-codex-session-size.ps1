param(
    [string]$SessionId,
    [string]$CodexRoot = (Join-Path $env:USERPROFILE '.codex'),
    [long]$ThresholdBytes = 300MB,
    [long]$TotalThresholdBytes = 10GB,
    [int]$TotalScanMaxAgeHours = 24,
    [string]$TotalCachePath = (Join-Path $PSScriptRoot '..\tmp\codex-capacity-cache.json'),
    [switch]$ForceTotalScan
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($SessionId)) {
    throw 'SessionId is required. Pass the current Codex task ID; do not infer the newest session.'
}
if ($ThresholdBytes -le 0) {
    throw 'ThresholdBytes must be greater than zero.'
}
if ($TotalThresholdBytes -le 0) {
    throw 'TotalThresholdBytes must be greater than zero.'
}

$sessionsRoot = Join-Path $CodexRoot 'sessions'
if (-not (Test-Path -LiteralPath $sessionsRoot)) {
    throw "Codex sessions directory was not found: $sessionsRoot"
}

$files = Get-ChildItem -LiteralPath $sessionsRoot -Recurse -File -Filter '*.jsonl' |
    Where-Object { $_.BaseName -like "*$SessionId*" }
if (@($files).Count -ne 1) {
    throw "Expected exactly one session for '$SessionId', found $(@($files).Count)."
}

$file = @($files)[0]
$capacity = $null
$capacitySource = 'scanned'
if (-not $ForceTotalScan -and (Test-Path -LiteralPath $TotalCachePath)) {
    try {
        $cachedCapacity = Get-Content -Raw -Encoding utf8 -LiteralPath $TotalCachePath | ConvertFrom-Json
        $cachedAtUtc = [datetimeoffset]::Parse($cachedCapacity.measured_at_utc).UtcDateTime
        $cacheAge = (Get-Date).ToUniversalTime() - $cachedAtUtc
        if ($cachedCapacity.codex_root -eq $CodexRoot -and $cacheAge.TotalHours -ge 0 -and $cacheAge.TotalHours -lt $TotalScanMaxAgeHours) {
            $capacity = $cachedCapacity
            $capacitySource = 'cached'
        }
    } catch {
        $capacity = $null
    }
}

if (-not $capacity) {
    $scanErrors = @()
    $allCodexFiles = Get-ChildItem -LiteralPath $CodexRoot -Recurse -File -ErrorAction SilentlyContinue -ErrorVariable +scanErrors
    $totalBytes = ($allCodexFiles | Measure-Object -Property Length -Sum).Sum
    $topLevelBytes = [ordered]@{}
    foreach ($codexFile in $allCodexFiles) {
        $relativePath = $codexFile.FullName.Substring($CodexRoot.TrimEnd('\').Length).TrimStart('\')
        $topLevelName = ($relativePath -split '\\', 2)[0]
        if (-not $topLevelBytes.Contains($topLevelName)) {
            $topLevelBytes[$topLevelName] = [long]0
        }
        $topLevelBytes[$topLevelName] += $codexFile.Length
    }
    $capacity = [pscustomobject]@{
        codex_root = $CodexRoot
        file_count = @($allCodexFiles).Count
        total_bytes = $totalBytes
        top_level_bytes = $topLevelBytes
        scan_complete = @($scanErrors).Count -eq 0
        scan_error_count = @($scanErrors).Count
        measured_at_utc = (Get-Date).ToUniversalTime().ToString('o')
    }
    $cacheDirectory = Split-Path -Parent $TotalCachePath
    if (-not (Test-Path -LiteralPath $cacheDirectory)) {
        New-Item -ItemType Directory -Path $cacheDirectory -Force | Out-Null
    }
    $capacity | ConvertTo-Json -Depth 4 | Set-Content -Encoding utf8 -LiteralPath $TotalCachePath
}

[pscustomobject]@{
    session_id = $SessionId
    session_file = $file.FullName
    size_bytes = $file.Length
    size_mib = [math]::Round($file.Length / 1MB, 2)
    threshold_bytes = $ThresholdBytes
    threshold_mib = [math]::Round($ThresholdBytes / 1MB, 2)
    usage_percent = [math]::Round(($file.Length / $ThresholdBytes) * 100, 2)
    handoff_required = $file.Length -ge $ThresholdBytes
    codex_root = $capacity.codex_root
    codex_file_count = $capacity.file_count
    codex_total_bytes = $capacity.total_bytes
    codex_total_mib = [math]::Round($capacity.total_bytes / 1MB, 2)
    codex_total_threshold_bytes = $TotalThresholdBytes
    codex_total_threshold_mib = [math]::Round($TotalThresholdBytes / 1MB, 2)
    codex_total_warning = $capacity.total_bytes -ge $TotalThresholdBytes
    codex_top_level_bytes = $capacity.top_level_bytes
    codex_scan_complete = $capacity.scan_complete
    codex_scan_error_count = $capacity.scan_error_count
    codex_total_measured_at_utc = $capacity.measured_at_utc
    codex_total_measurement_source = $capacitySource
    codex_total_cache_max_age_hours = $TotalScanMaxAgeHours
    measured_at_utc = (Get-Date).ToUniversalTime().ToString('o')
    selection = 'session_id'
} | ConvertTo-Json
