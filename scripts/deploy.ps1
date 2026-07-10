$ErrorActionPreference = "Stop"

$appDir = "C:\apps\echo-of-photons"
$pm2Name = "echo-of-photons"
$port = "3000"
$workspace = $env:GITHUB_WORKSPACE

if (-not $workspace) {
  throw "GITHUB_WORKSPACE is not set. This script must run inside GitHub Actions."
}

New-Item -ItemType Directory -Force -Path $appDir | Out-Null

$robocopyArgs = @(
  $workspace,
  $appDir,
  "/E",
  "/R:2",
  "/W:1",
  "/XD", ".git", "node_modules", ".next",
  "/XF", ".env.local", "echo-of-photons.tar.gz"
)

robocopy @robocopyArgs | Out-Host
if ($LASTEXITCODE -ge 8) {
  throw "robocopy failed with exit code $LASTEXITCODE"
}

Push-Location $appDir
try {
  npm ci
  npm run build

  if (-not (Get-Command pm2 -ErrorAction SilentlyContinue)) {
    npm install -g pm2
  }

  $env:PORT = $port
  pm2 describe $pm2Name *> $null
  if ($LASTEXITCODE -eq 0) {
    pm2 restart $pm2Name --update-env
  } else {
    pm2 start npm --name $pm2Name -- start
  }

  pm2 save
} finally {
  Pop-Location
}
