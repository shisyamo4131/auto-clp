[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$SessionId,
    [string]$CodexRoot = (Join-Path $env:USERPROFILE '.codex'),
    [long]$ThresholdBytes = 300MB
)

$ErrorActionPreference = 'Stop'

$sessionsRoot = Join-Path $CodexRoot 'sessions'
if (-not (Test-Path -LiteralPath $sessionsRoot -PathType Container)) {
    throw "Codex sessions directory was not found: $sessionsRoot"
}

$files = @(Get-ChildItem -LiteralPath $sessionsRoot -Recurse -File -Filter '*.jsonl' |
    Where-Object { $_.BaseName -like "*$SessionId*" })

if ($files.Count -ne 1) {
    throw "Expected exactly one session for '$SessionId', found $($files.Count)."
}

$file = $files[0]
[pscustomobject]@{
    session_id = $SessionId
    session_file = $file.FullName
    size_bytes = $file.Length
    size_mib = [math]::Round($file.Length / 1MB, 2)
    threshold_bytes = $ThresholdBytes
    threshold_mib = [math]::Round($ThresholdBytes / 1MB, 2)
    handoff_required = $file.Length -ge $ThresholdBytes
    measured_at_utc = (Get-Date).ToUniversalTime().ToString('o')
    selection = 'explicit_session_id'
} | ConvertTo-Json
