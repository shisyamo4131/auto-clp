[CmdletBinding()]
param(
    [string]$PolicyPath = (Join-Path $PSScriptRoot '..\governance\verification-policy.json')
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'project-governance-functions.ps1')
$policyText = [IO.File]::ReadAllText((Resolve-Path -LiteralPath $PolicyPath).Path)
$policy = $policyText | ConvertFrom-Json
Assert-ProjectVerificationPolicy -Policy $policy
$passed = 1
$cases = @(
    @{ name = 'missing guidance class'; mutate = { param($p) $p.classes = @($p.classes | Where-Object id -ne 'project-guidance-metadata') }; expected = 'seven approved' },
    @{ name = 'duplicate class'; mutate = { param($p) $p.classes[0].id = $p.classes[1].id }; expected = 'seven approved' },
    @{ name = 'missing runtime'; mutate = { param($p) $p.runtimeProfiles = @() }; expected = 'PowerShell 7 profile only' },
    @{ name = 'no required runtime'; mutate = { param($p) $p.runtimeProfiles[0].required = $false }; expected = 'PowerShell 7 profile only' },
    @{ name = 'unsupported required runtime'; mutate = { param($p) $p.runtimeProfiles[0].versionRule = 'minimum-major=6' }; expected = 'PowerShell 7 profile only' },
    @{ name = 'unapproved legacy requirement'; mutate = { param($p) $p.runtimeProfiles[1].required = $true }; expected = 'PowerShell 7 profile only' },
    @{ name = 'unsupported legacy guarantee'; mutate = { param($p) $p.runtimeProfiles[1].supportStatus = 'supported' }; expected = 'optional and unverified' },
    @{ name = 'missing browser completion gate'; mutate = { param($p) $p.comprehensiveGateIds = @($p.comprehensiveGateIds | Where-Object { $_ -ne 'browser-tests' }) }; expected = 'must be preserved: browser-tests' },
    @{ name = 'missing unknown-impact gate'; mutate = { param($p) $p.unknownImpactGateIds = @($p.unknownImpactGateIds | Where-Object { $_ -ne 'data-contract-check' }) }; expected = 'must be preserved: data-contract-check' },
    @{ name = 'duplicate gate'; mutate = { param($p) $p.gates[0].id = $p.gates[1].id }; expected = 'gate IDs must be unique' },
    @{ name = 'missing regression inclusion'; mutate = { param($p) ($p.gates | Where-Object id -eq 'project-check').includes = @() }; expected = 'must include' }
)
foreach ($case in $cases) {
    $candidate = $policyText | ConvertFrom-Json
    & $case.mutate $candidate
    $failure = $null
    try { Assert-ProjectVerificationPolicy -Policy $candidate } catch { $failure = $_.Exception.Message }
    if ($null -eq $failure -or -not $failure.Contains($case.expected)) {
        throw "Negative case failed: $($case.name); observed=$failure"
    }
    $passed++
}
[pscustomobject]@{ gate_id = 'project-governance-regression'; positive_cases = 1; negative_cases = $cases.Count; passed = $passed; exit_status = 0 }
