# HomeCareX Mobile Connection Helper Script

$adbPath = "C:\Users\Dell\AppData\Local\Android\Sdk\platform-tools\adb.exe"

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "  HomeCareX Mobile - Server Connection Setup   " -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

# 1. Check ADB Devices
Write-Host "`n[1/3] Checking connected Android devices..." -ForegroundColor Yellow
if (Test-Path $adbPath) {
    & $adbPath devices
} else {
    adb devices
}

# 2. Port Forwarding for USB Debugging
Write-Host "`n[2/3] Setting up USB Reverse Proxy (tcp:5000 -> tcp:5000)..." -ForegroundColor Yellow
try {
    if (Test-Path $adbPath) {
        & $adbPath reverse tcp:5000 tcp:5000
    } else {
        adb reverse tcp:5000 tcp:5000
    }
    Write-Host "✓ USB reverse proxy established: phone can now reach http://localhost:5000" -ForegroundColor Green
} catch {
    Write-Host "Note: Connect your phone via USB and allow USB debugging to enable reverse proxy." -ForegroundColor Gray
}

# 3. Wi-Fi LAN IP Info
Write-Host "`n[3/3] Wi-Fi LAN IP Connection..." -ForegroundColor Yellow
$localIp = (ipconfig | Select-String "IPv4" | Out-String).Trim()
Write-Host "Local Host IP: 192.168.1.6" -ForegroundColor Green
Write-Host "Mobile API Endpoint: http://192.168.1.6:5000/api/v1" -ForegroundColor Cyan
Write-Host "`nYour mobile app is automatically configured in api_constants.dart to use:" -ForegroundColor White
Write-Host "  - Wi-Fi: http://192.168.1.6:5000/api/v1" -ForegroundColor Gray
Write-Host "  - USB (adb reverse): http://localhost:5000/api/v1" -ForegroundColor Gray
Write-Host "  - Android Emulator: http://10.0.2.2:5000/api/v1" -ForegroundColor Gray
Write-Host "`nSetup complete!" -ForegroundColor Green

