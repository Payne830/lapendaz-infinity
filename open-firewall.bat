@echo off
echo Opening port 3000 for Lapendaz Infinity...
netsh advfirewall firewall delete rule name="Lapendaz Infinity Dev" >/dev/null 2>&1
netsh advfirewall firewall delete rule name="Lapendaz Port 3000" >/dev/null 2>&1
netsh advfirewall firewall add rule name="Lapendaz Port 3000" dir=in action=allow protocol=TCP localport=3000
echo Done! Participants can now join via WiFi at http://192.168.100.9:3000
pause
