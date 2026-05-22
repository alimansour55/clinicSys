# Opens Windows Firewall for Clinivo dev ports (run once as Administrator).
# Usage: Right-click PowerShell -> Run as administrator, then:
#   cd "d:\project 2\clinicSys"
#   .\scripts\enable-mobile-access.ps1

$ErrorActionPreference = 'Stop'
$ports = @(4000, 5173, 5174)

function Get-LanIp {
    $addrs = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object {
            $_.IPAddress -match '^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)' -and
            $_.PrefixOrigin -ne 'WellKnown'
        } |
        Select-Object -ExpandProperty IPAddress -First 1
    if ($addrs) { return $addrs }
    return $null
}

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host ''
    Write-Host 'ERROR: Run PowerShell as Administrator.' -ForegroundColor Red
    Write-Host 'Right-click PowerShell -> Run as administrator, then run this script again.'
    Write-Host ''
    exit 1
}

foreach ($port in $ports) {
    $name = "Clinivo Dev TCP $port"
    Get-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue | Remove-NetFirewallRule -ErrorAction SilentlyContinue
    New-NetFirewallRule -DisplayName $name -Direction Inbound -Protocol TCP -LocalPort $port -Action Allow -Profile Domain,Private,Public | Out-Null
    Write-Host "Allowed inbound TCP port $port ($name)"
}

$ip = Get-LanIp
Write-Host ''
Write-Host 'Firewall updated. On your phone (same Wi-Fi), open:' -ForegroundColor Green
Write-Host ''
if ($ip) {
    Write-Host "  Patient site:  http://${ip}:5173"
    Write-Host "  Staff panel:   http://${ip}:5174"
    Write-Host "  API check:     http://${ip}:4000/"
} else {
    Write-Host '  Run ipconfig on this PC and use your IPv4 Address (192.168.x.x)'
    Write-Host '  Patient: http://YOUR_IP:5173'
    Write-Host '  Staff:   http://YOUR_IP:5174'
}
Write-Host ''
Write-Host 'Start servers in 3 terminals:' -ForegroundColor Cyan
Write-Host '  cd backend  && npm run server'
Write-Host '  cd frontend && npm run dev'
Write-Host '  cd admin    && npm run dev'
Write-Host ''
