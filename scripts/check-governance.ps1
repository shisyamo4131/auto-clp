[CmdletBinding()]
param(
    [string]$ProjectPath = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
    [int]$MaxAgentsBytes = 32768
)

$ErrorActionPreference = 'Stop'

function Get-NormalizedLfSha256 {
    param([Parameter(Mandatory = $true)][string]$Path)

    $sourceBytes = [IO.File]::ReadAllBytes($Path)
    $normalizedBytes = [IO.MemoryStream]::new()
    try {
        for ($index = 0; $index -lt $sourceBytes.Length; $index++) {
            if ($sourceBytes[$index] -eq 13) {
                if (($index + 1) -lt $sourceBytes.Length -and $sourceBytes[$index + 1] -eq 10) {
                    $index++
                }
                $normalizedBytes.WriteByte(10)
            } else {
                $normalizedBytes.WriteByte($sourceBytes[$index])
            }
        }

        $sha256 = [Security.Cryptography.SHA256]::Create()
        try {
            $hashBytes = $sha256.ComputeHash($normalizedBytes.ToArray())
            return ([BitConverter]::ToString($hashBytes)).Replace('-', '').ToLowerInvariant()
        } finally {
            $sha256.Dispose()
        }
    } finally {
        $normalizedBytes.Dispose()
    }
}

$resolvedProject = (Resolve-Path -LiteralPath $ProjectPath).Path
$governanceRoot = Join-Path $resolvedProject 'governance'
$lockPath = Join-Path $governanceRoot 'governance.lock.toml'
$commonPath = Join-Path $governanceRoot 'common-governance.md'
$projectRulesPath = Join-Path $governanceRoot 'project-rules.md'
$agentsPath = Join-Path $resolvedProject 'AGENTS.md'
$rendererPath = Join-Path $resolvedProject 'scripts\render-governance.ps1'
$validatorPath = Join-Path $resolvedProject 'scripts\check-governance.ps1'

foreach ($requiredPath in @($lockPath, $commonPath, $projectRulesPath, $agentsPath, $rendererPath, $validatorPath)) {
    if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
        throw "Required governance file is missing: $requiredPath"
    }
}

function Get-LockValue {
    param([string]$Name)
    $pattern = '^%s\s*=\s*"([^"]+)"\s*$' -replace '%s', [regex]::Escape($Name)
    $match = Select-String -LiteralPath $lockPath -Pattern $pattern | Select-Object -First 1
    if (-not $match) {
        throw "Missing lock value: $Name"
    }
    return $match.Matches[0].Groups[1].Value.ToLowerInvariant()
}

$checks = [ordered]@{
    common_governance = @($commonPath, 'common_governance_sha256')
    renderer = @($rendererPath, 'renderer_sha256')
    validator = @($validatorPath, 'validator_sha256')
}

foreach ($entry in $checks.GetEnumerator()) {
    $actual = Get-NormalizedLfSha256 -Path $entry.Value[0]
    $expected = Get-LockValue -Name $entry.Value[1]
    if ($actual -ne $expected) {
        throw "Managed $($entry.Key) differs from governance.lock.toml. Restore it through the approved skill sync."
    }
}

$projectRules = [IO.File]::ReadAllText($projectRulesPath)
if ($projectRules -match '\[(Project Name|Purpose, users|Task-routed|Products, systems|Optional agents|Sensitive data|Verified commands|Roadmaps, weights|Task names)') {
    throw 'Project rules still contain template placeholders.'
}

& $rendererPath -ProjectPath $resolvedProject -Check | Out-Null

$agentsBytes = (Get-Item -LiteralPath $agentsPath).Length
if ($agentsBytes -gt $MaxAgentsBytes) {
    throw "Generated AGENTS.md is $agentsBytes bytes, above the configured maximum of $MaxAgentsBytes bytes."
}

[pscustomobject]@{
    project_path = $resolvedProject
    common_governance_version = (Get-LockValue -Name 'common_governance_version')
    agents_bytes = $agentsBytes
    max_agents_bytes = $MaxAgentsBytes
    managed_hashes_current = $true
    generated_agents_current = $true
    project_rules_present = $true
}
