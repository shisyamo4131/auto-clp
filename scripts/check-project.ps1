[CmdletBinding()]
param(
    [string]$ProjectPath = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'
$resolvedProject = (Resolve-Path -LiteralPath $ProjectPath).Path

$requiredFiles = @(
    'AGENTS.md',
    'README.md',
    'CHANGELOG.md',
    'INITIAL_PROMPT.md',
    'governance/common-governance.md',
    'governance/project-rules.md',
    'governance/governance.lock.toml',
    'docs/README.md',
    'docs/specification.md',
    'docs/data-model.md',
    'docs/operations.md',
    'docs/runbooks/project-coordination.md',
    'docs/handoffs/README.md',
    'docs/handoffs/GOV14-AUTOCLP-01.md',
    'docs/roadmaps/README.md',
    'docs/roadmaps/auto-clp.md',
    'docs/decisions/README.md',
    'docs/decisions/0016-project-coordination-and-session-capacity-routing.md',
    '.codex/config.toml',
    '.codex/agents/developer.toml',
    '.codex/agents/tester.toml',
    '.codex/agents/code-explorer.toml',
    '.codex/agents/docs-researcher.toml',
    '.codex/agents/reviewer.toml',
    '.codex/agents/ui-tester.toml',
    'scripts/render-governance.ps1',
    'scripts/check-governance.ps1',
    'scripts/check-project.ps1',
    'scripts/check-data-contract.ps1',
    'scripts/check-codex-session-size.ps1',
    'schemas/project-0.1.0.schema.json'
)

foreach ($relativePath in $requiredFiles) {
    $fullPath = Join-Path $resolvedProject $relativePath
    if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
        throw "Required project file is missing: $relativePath"
    }
}

$markdownFiles = Get-ChildItem -LiteralPath $resolvedProject -Recurse -File -Filter '*.md' |
    Where-Object {
        $_.FullName -notmatch '[\\/](?:\.git|node_modules|dist|test-results)[\\/]'
    }
$linkPattern = '\[[^\]]*\]\((?<target>[^)]+)\)'
$brokenLinks = @()
foreach ($markdownFile in $markdownFiles) {
    $content = [IO.File]::ReadAllText($markdownFile.FullName)
    foreach ($match in [regex]::Matches($content, $linkPattern)) {
        $target = $match.Groups['target'].Value.Trim()
        if ($target -match '^(https?://|mailto:|#)') {
            continue
        }
        $pathPart = ($target -split '#', 2)[0]
        if (-not $pathPart) {
            continue
        }
        $decodedPath = [Uri]::UnescapeDataString($pathPart).Replace('/', [IO.Path]::DirectorySeparatorChar)
        $candidate = [IO.Path]::GetFullPath((Join-Path $markdownFile.DirectoryName $decodedPath))
        if (-not $candidate.StartsWith($resolvedProject, [StringComparison]::OrdinalIgnoreCase)) {
            $brokenLinks += "$($markdownFile.FullName): link escapes project: $target"
            continue
        }
        if (-not (Test-Path -LiteralPath $candidate)) {
            $brokenLinks += "$($markdownFile.FullName): missing target: $target"
        }
    }
}
if ($brokenLinks.Count -gt 0) {
    throw "Broken Markdown links:`n$($brokenLinks -join "`n")"
}

$docsIndex = [IO.File]::ReadAllText((Join-Path $resolvedProject 'docs/README.md'))
$indexedDocuments = @(
    'specification.md',
    'data-model.md',
    'operations.md',
    'runbooks/project-coordination.md',
    'handoffs/README.md',
    'roadmaps/auto-clp.md',
    'decisions/README.md',
    '../CHANGELOG.md'
)
foreach ($document in $indexedDocuments) {
    if (-not $docsIndex.Contains($document)) {
        throw "docs/README.md does not index: $document"
    }
}

$coordinationRunbook = [IO.File]::ReadAllText((Join-Path $resolvedProject 'docs/runbooks/project-coordination.md'))
$capacityScript = [IO.File]::ReadAllText((Join-Path $resolvedProject 'scripts/check-codex-session-size.ps1'))
$capacityAliases = @(
    '容量チェック',
    'タスク容量確認',
    'セッション容量確認',
    'session size / handoff threshold確認'
)
foreach ($alias in $capacityAliases) {
    if (-not $docsIndex.Contains($alias)) {
        throw "docs/README.md does not route capacity alias: $alias"
    }
    if (-not $coordinationRunbook.Contains($alias)) {
        throw "Coordination runbook does not define capacity alias: $alias"
    }
}
foreach ($requiredToken in @(
    'powershell -ExecutionPolicy Bypass -File scripts/check-codex-session-size.ps1 -SessionId <current-task-id>',
    '300 MiB',
    '10 GiB',
    'codex_scan_complete',
    'codex_scan_error_count',
    '最新または最終更新のsessionを推測'
)) {
    if (-not $coordinationRunbook.Contains($requiredToken)) {
        throw "Coordination runbook is missing required capacity contract: $requiredToken"
    }
}
foreach ($requiredToken in @(
    'session_id',
    'session_file',
    'size_bytes',
    'size_mib',
    'threshold_bytes',
    'threshold_mib',
    'SessionId is required',
    'Expected exactly one session',
    'ThresholdBytes = 300MB',
    'TotalThresholdBytes = 10GB',
    'usage_percent',
    'handoff_required',
    'codex_root',
    'codex_file_count',
    'codex_total_bytes',
    'codex_total_mib',
    'codex_total_threshold_bytes',
    'codex_total_threshold_mib',
    'codex_total_warning',
    'codex_top_level_bytes',
    'codex_scan_complete',
    'codex_scan_error_count',
    'codex_total_measured_at_utc',
    'codex_total_measurement_source',
    'codex_total_cache_max_age_hours',
    'measured_at_utc',
    "selection = 'session_id'"
)) {
    if (-not $capacityScript.Contains($requiredToken)) {
        throw "Session capacity script is missing required contract: $requiredToken"
    }
}
if ($capacityScript -match '(?i)LastWriteTime|Sort-Object\s+.*(?:Length|CreationTime|LastAccessTime)') {
    throw 'Session capacity script must not infer the newest session.'
}
foreach ($requiredToken in @(
    'sessionをちょうど1件',
    '300 MiBへ到達した場合',
    '新規割当と自動reviewを停止',
    '通常のtask間通信',
    'managed restricted `workspace-write`',
    '`approvals_reviewer=auto_review`'
)) {
    if (-not $coordinationRunbook.Contains($requiredToken)) {
        throw "Coordination runbook is missing preserved lifecycle contract: $requiredToken"
    }
}

$decisionIndex = [IO.File]::ReadAllText((Join-Path $resolvedProject 'docs/decisions/README.md'))
$decisionFiles = Get-ChildItem -LiteralPath (Join-Path $resolvedProject 'docs/decisions') -File -Filter '*.md' |
    Where-Object { $_.Name -match '^\d{4}-.+\.md$' }
foreach ($decisionFile in $decisionFiles) {
    $decisionContent = [IO.File]::ReadAllText($decisionFile.FullName)
    $statusMatch = [regex]::Match($decisionContent, '(?m)^- Status:\s*(Proposed|Accepted|Rejected|Superseded)\s*$')
    if (-not $statusMatch.Success) {
        throw "ADR status is missing or invalid: $($decisionFile.Name)"
    }
    $status = $statusMatch.Groups[1].Value
    $indexPattern = '\(' + [regex]::Escape($decisionFile.Name) + '\)\s*\|[^\r\n]*\|\s*' + [regex]::Escape($status) + '\s*\|'
    if (-not [regex]::IsMatch($decisionIndex, $indexPattern)) {
        throw "ADR index status or link does not match: $($decisionFile.Name) ($status)"
    }
}

$roadmapPath = Join-Path $resolvedProject 'docs/roadmaps/auto-clp.md'
$roadmap = [IO.File]::ReadAllText($roadmapPath)
$progressMatch = [regex]::Match($roadmap, '(?m)^- Current progress:\s*(\d+)%\s*$')
if (-not $progressMatch.Success) {
    throw 'Roadmap current progress is missing.'
}
$currentProgress = [int]$progressMatch.Groups[1].Value
$weightTotal = 0
$earnedTotal = 0
foreach ($line in ($roadmap -split "`r?`n")) {
    $row = [regex]::Match($line, '^\|\s*[^|*][^|]*\|\s*(\d+)\s*\|\s*(\d+)\s*\|')
    if ($row.Success) {
        $weightTotal += [int]$row.Groups[1].Value
        $earnedTotal += [int]$row.Groups[2].Value
    }
}
if ($weightTotal -ne 100) {
    throw "Roadmap milestone weights total $weightTotal instead of 100."
}
if ($earnedTotal -ne $currentProgress) {
    throw "Roadmap earned points $earnedTotal do not match current progress $currentProgress%."
}
$roadmapIndex = [IO.File]::ReadAllText((Join-Path $resolvedProject 'docs/roadmaps/README.md'))
if (-not $roadmapIndex.Contains("| Auto CLP | $currentProgress% |")) {
    throw "Roadmap index does not match Auto CLP progress $currentProgress%."
}

$config = [IO.File]::ReadAllText((Join-Path $resolvedProject '.codex/config.toml'))
if ($config -notmatch '(?m)^enabled\s*=\s*true\s*$' -or
    $config -notmatch '(?m)^max_concurrent_threads_per_session\s*=\s*4\s*$') {
    throw '.codex/config.toml does not contain the approved agent settings.'
}

$expectedModes = [ordered]@{
    'developer.toml' = 'workspace-write'
    'tester.toml' = 'workspace-write'
    'code-explorer.toml' = 'read-only'
    'docs-researcher.toml' = 'read-only'
    'reviewer.toml' = 'read-only'
    'ui-tester.toml' = 'read-only'
}
$agentNames = @()
foreach ($entry in $expectedModes.GetEnumerator()) {
    $agentPath = Join-Path $resolvedProject ".codex/agents/$($entry.Key)"
    $agent = [IO.File]::ReadAllText($agentPath)
    $nameMatch = [regex]::Match($agent, '(?m)^name\s*=\s*"([^"]+)"\s*$')
    if (-not $nameMatch.Success -or
        $agent -notmatch '(?m)^description\s*=\s*"[^"]+"\s*$' -or
        $agent -notmatch '(?ms)^developer_instructions\s*=\s*""".+"""\s*$') {
        throw "Agent TOML is missing required fields: $($entry.Key)"
    }
    $agentNames += $nameMatch.Groups[1].Value
    $modePattern = '(?m)^sandbox_mode\s*=\s*"' + [regex]::Escape($entry.Value) + '"\s*$'
    if ($agent -notmatch $modePattern) {
        throw "Agent sandbox mode is not approved: $($entry.Key) expected $($entry.Value)"
    }
}
if (@($agentNames | Select-Object -Unique).Count -ne $agentNames.Count) {
    throw 'Agent names must be unique.'
}

$datedFiles = @(
    'docs/README.md',
    'docs/specification.md',
    'docs/roadmaps/README.md',
    'docs/roadmaps/auto-clp.md'
)
foreach ($relativePath in $datedFiles) {
    $content = [IO.File]::ReadAllText((Join-Path $resolvedProject $relativePath))
    if ($content -match 'YYYY-MM-DD') {
        throw "Unresolved date placeholder remains: $relativePath"
    }
}

[pscustomobject]@{
    project_path = $resolvedProject
    required_files = $requiredFiles.Count
    markdown_files = @($markdownFiles).Count
    relative_links_valid = $true
    indexed_documents_valid = $true
    adr_count = @($decisionFiles).Count
    adr_statuses_valid = $true
    roadmap_weight = $weightTotal
    roadmap_progress = $currentProgress
    agent_count = $agentNames.Count
    agent_permissions_valid = $true
}
