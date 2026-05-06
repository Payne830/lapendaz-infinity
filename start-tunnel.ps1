# Lapendaz Infinity - Auto Tunnel
Write-Host ""
Write-Host "  Starting Cloudflare tunnel..." -ForegroundColor Cyan
Write-Host "  The URL will appear below and auto-update in the app." -ForegroundColor Gray
Write-Host ""

$urlFile = Join-Path $PSScriptRoot "tunnel-url.json"

# Clear old URL
Set-Content -Path $urlFile -Value '{"url":""}' -Encoding UTF8

# Start cloudflared and capture output
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = "npx"
$psi.Arguments = "cloudflared tunnel --url http://localhost:3000"
$psi.RedirectStandardError = $true
$psi.UseShellExecute = $false
$psi.CreateNoWindow = $false

$proc = New-Object System.Diagnostics.Process
$proc.StartInfo = $psi

$urlFound = $false
$proc.ErrorDataReceived += {
    param($s, $e)
    if ($e.Data) {
        Write-Host $e.Data
        if (-not $urlFound -and $e.Data -match 'https://[a-z0-9\-]+\.trycloudflare\.com') {
            $url = $matches[0]
            $urlFound = $true
            $json = "{`"url`":`"$url`"}"
            Set-Content -Path $urlFile -Value $json -Encoding UTF8
            Write-Host ""
            Write-Host "  PUBLIC URL: $url" -ForegroundColor Green
            Write-Host "  QR code in the app will auto-update!" -ForegroundColor Yellow
            Write-Host ""
        }
    }
}

$proc.Start() | Out-Null
$proc.BeginErrorReadLine()
$proc.WaitForExit()
