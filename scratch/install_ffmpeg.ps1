$binDir = "d:\dipvijay\auto1\backend\bin"
$ffmpegZip = "$binDir\ffmpeg.zip"

Write-Host "1. Downloading FFmpeg release essentials..." -ForegroundColor Green
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Invoke-WebRequest -Uri "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip" -OutFile $ffmpegZip

Write-Host "2. Extracting FFmpeg archive..." -ForegroundColor Green
Expand-Archive -Path $ffmpegZip -DestinationPath "$binDir\ffmpeg_temp" -Force

# Locate the extracted folder using .FullName for absolute path resolution
$nestedDir = Get-ChildItem -Path "$binDir\ffmpeg_temp" -Directory | Select-Object -First 1
$absoluteNestedPath = $nestedDir.FullName

Write-Host "3. Moving binaries from $absoluteNestedPath to $binDir..." -ForegroundColor Green
Move-Item -Path "$absoluteNestedPath\bin\ffmpeg.exe" -Destination "$binDir\ffmpeg.exe" -Force
Move-Item -Path "$absoluteNestedPath\bin\ffprobe.exe" -Destination "$binDir\ffprobe.exe" -Force

# Cleanup temp files
Write-Host "4. Cleaning up temporary files..." -ForegroundColor Green
Remove-Item -Recurse -Force "$binDir\ffmpeg_temp"
Remove-Item -Force $ffmpegZip

Write-Host "==================================================" -ForegroundColor Green
Write-Host "FFmpeg and FFprobe installed successfully in $binDir!" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
