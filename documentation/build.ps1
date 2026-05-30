# Build PDF using system Chrome/Edge (no npm required)
$ErrorActionPreference = "Stop"
$docRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$html = Join-Path $docRoot "document.html"
$outDir = Join-Path $docRoot "output"
$pdf = Join-Path $outDir "Clinic_Management_System_Documentation.pdf"
$log = Join-Path $docRoot "build.log"

"" | Set-Content $log
function Log($msg) { Add-Content $log "$(Get-Date -Format o) $msg"; Write-Host $msg }

New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$browsers = @(
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
)

$browser = $null
foreach ($b in $browsers) {
  if (Test-Path $b) { $browser = $b; break }
}

if (-not $browser) {
  Log "ERROR: Chrome or Edge not found"
  exit 1
}

Log "Using browser: $browser"
$fileUri = "file:///" + ($html -replace '\\', '/')
Log "Input: $fileUri"
Log "Output: $pdf"

$args = @(
  "--headless=new",
  "--disable-gpu",
  "--no-pdf-header-footer",
  "--print-to-pdf=$pdf",
  $fileUri
)

try {
  & $browser @args 2>&1 | ForEach-Object { Log $_ }
  Start-Sleep -Seconds 3
  if (Test-Path $pdf) {
    $size = (Get-Item $pdf).Length
    Log "SUCCESS: PDF created ($size bytes)"
    exit 0
  } else {
    Log "ERROR: PDF not created"
    exit 1
  }
} catch {
  Log "ERROR: $($_.Exception.Message)"
  exit 1
}
