param(
  [ValidateSet('amd64', 'arm64')]
  [string]$Architecture = 'amd64'
)

# Builds an isolated Linux candidate. This script performs no remote operations.
$ErrorActionPreference = 'Stop'
$v2Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$repoRoot = (Resolve-Path (Join-Path $v2Root '..')).Path
Push-Location $repoRoot
try {
  $revision = (git rev-parse HEAD).Trim()
  if ($LASTEXITCODE -ne 0) { throw 'Cannot identify source revision.' }
  $dirty = [bool](git status --porcelain -- v2 docs/v2)
  if ($LASTEXITCODE -ne 0) { throw 'Cannot verify source status.' }
  $releaseName = 'v2-{0}-{1}' -f (Get-Date -Format 'yyyyMMdd-HHmmss'), $revision.Substring(0, 8)
  $releaseRoot = Join-Path $v2Root ".run/releases/$releaseName"
  if (Test-Path -LiteralPath $releaseRoot) { throw 'Release directory already exists.' }
  New-Item -ItemType Directory -Path $releaseRoot -Force | Out-Null

  $previousGoOs = $env:GOOS
  $previousGoArch = $env:GOARCH
  $previousCgo = $env:CGO_ENABLED
  Push-Location (Join-Path $v2Root 'server')
  try {
    $env:GOOS = 'linux'
    $env:GOARCH = $Architecture
    $env:CGO_ENABLED = '0'
    go build -buildvcs=false -trimpath -o (Join-Path $releaseRoot 'tiantai-v2') .
    if ($LASTEXITCODE -ne 0) { throw 'V2 Linux build failed.' }
  } finally {
    $env:GOOS = $previousGoOs
    $env:GOARCH = $previousGoArch
    $env:CGO_ENABLED = $previousCgo
    Pop-Location
  }

  Push-Location (Join-Path $v2Root 'web')
  try {
    npm run build
    if ($LASTEXITCODE -ne 0) { throw 'V2 frontend build failed.' }
  } finally {
    Pop-Location
  }
  Copy-Item -LiteralPath (Join-Path $v2Root 'web/dist') -Destination (Join-Path $releaseRoot 'web') -Recurse
  $metadata = [ordered]@{
    application = 'tiantai-v2'
    targetOrigin = 'https://v2.tiantaishiju.top'
    revision = $revision
    sourceHasUncommittedChanges = $dirty
    platform = "linux/$Architecture"
    builtAtUtc = [DateTime]::UtcNow.ToString('o')
    deploymentStatus = 'candidate-only'
  }
  $utf8 = New-Object System.Text.UTF8Encoding($false)
  [IO.File]::WriteAllText((Join-Path $releaseRoot 'release.json'), ($metadata | ConvertTo-Json), $utf8)
  $hashLines = Get-ChildItem -LiteralPath $releaseRoot -Recurse -File | Sort-Object FullName | ForEach-Object {
    $relative = $_.FullName.Substring($releaseRoot.Length + 1).Replace('\', '/')
    '{0}  {1}' -f (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant(), $relative
  }
  [IO.File]::WriteAllText((Join-Path $releaseRoot 'SHA256SUMS'), (($hashLines -join "`n") + "`n"), $utf8)
  $archive = "$releaseRoot.tar.gz"
  # Windows filesystem modes would lose the Linux executable bit. The helper
  # also avoids GNU tar interpreting a drive colon as a remote hostname.
  python (Join-Path $PSScriptRoot 'archive-release.py') $releaseRoot $archive
  if ($LASTEXITCODE -ne 0) { throw 'V2 candidate archive failed.' }
  [pscustomobject]@{
    Candidate = $archive
    SHA256 = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
    SourceRevision = $revision
    SourceHasUncommittedChanges = $dirty
    Deployed = $false
  } | ConvertTo-Json
} finally {
  Pop-Location
}
