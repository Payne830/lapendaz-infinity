# Run this as Administrator
Write-Host "Fixing WiFi access for Lapendaz Infinity..." -ForegroundColor Cyan

# Change WiFi network profile from Public to Private
$profile = Get-NetConnectionProfile -InterfaceAlias "WiFi" -ErrorAction SilentlyContinue
if ($profile) {
    Set-NetConnectionProfile -InterfaceAlias "WiFi" -NetworkCategory Private
    Write-Host "WiFi network changed from Public to Private" -ForegroundColor Green
} else {
    Write-Host "WiFi interface not found - trying by name..." -ForegroundColor Yellow
    Get-NetConnectionProfile | Where-Object { $_.NetworkCategory -eq "Public" } | ForEach-Object {
        Set-NetConnectionProfile -Name $_.Name -NetworkCategory Private
        Write-Host "Changed '$($_.Name)' to Private" -ForegroundColor Green
    }
}

# Remove old rules
netsh advfirewall firewall delete rule name="Lapendaz Port 3000" | Out-Null
netsh advfirewall firewall delete rule name="Lapendaz Infinity Dev" | Out-Null

# Add new rule that works on all profiles including Public
New-NetFirewallRule -DisplayName "Lapendaz Port 3000" `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort 3000 `
    -Action Allow `
    -Profile Any `
    -ErrorAction SilentlyContinue | Out-Null

Write-Host "Firewall rule added for port 3000 (all profiles)" -ForegroundColor Green
Write-Host ""
Write-Host "Done! Your phone can now access:" -ForegroundColor Cyan
Write-Host "http://192.168.100.9:3000" -ForegroundColor Yellow
Write-Host ""
Read-Host "Press Enter to close"
