# Lapendaz Infinity - ngrok Tunnel
Write-Host ""
Write-Host "  Starting ngrok tunnel on port 3001..." -ForegroundColor Cyan
Write-Host ""

$urlFile = Join-Path $PSScriptRoot "tunnel-url.json"
Set-Content -Path $urlFile -Value '{"url":""}' -Encoding UTF8

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = "ngrok"
$psi.Arguments = "http 3001 --log stdout"
$psi.RedirectStandardOutput = $true
$psi.UseShellExecute = $false
$psi.CreateNoWindow = $false

$proc = New-Object System.Diagnostics.Process
$proc.StartInfo = $psi

$urlFound = $false
$proc.OutputDataReceived += {
    param($s, $e)
    if ($e.Data) {
        if (-not $urlFound -and $e.Data -match 'url=(https://[a-z0-9\-]+\.ngrok[^\s]+)') {
            $url = $matches[1]
            $urlFound = $true
            $json = "{`"url`":`"$url`"}"
            Set-Content -Path $urlFile -Value $json -Encoding UTF8
            Write-Host ""
            Write-Host "  ========================================" -ForegroundColor Green
            Write-Host "  PUBLIC URL: $url" -ForegroundColor Green
            Write-Host "  Fill this into the host dashboard!" -ForegroundColor Yellow
            Write-Host "  ========================================" -ForegroundColor Green
            Write-Host ""
        }
    }
}

$proc.Start() | Out-Null
$proc.BeginOutputReadLine()
$proc.WaitForExit()
