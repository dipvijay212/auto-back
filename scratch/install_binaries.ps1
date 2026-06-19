$backendDir = "d:\dipvijay\auto1\backend"
$binDir = "$backendDir\bin"

# Create directories
Write-Host "1. Creating directories..." -ForegroundColor Green
New-Item -ItemType Directory -Force -Path $binDir
$modelDir = "$binDir\voices"
New-Item -ItemType Directory -Force -Path $modelDir

# 2. Download and extract FFmpeg
Write-Host "2. Downloading FFmpeg release essentials..." -ForegroundColor Green
$ffmpegZip = "$binDir\ffmpeg.zip"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Invoke-WebRequest -Uri "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip" -OutFile $ffmpegZip

Write-Host "Extracting FFmpeg..." -ForegroundColor Green
Expand-Archive -Path $ffmpegZip -DestinationPath "$binDir\ffmpeg_temp" -Force
$nestedDir = Get-ChildItem -Path "$binDir\ffmpeg_temp" -Directory | Select-Object -First 1
Move-Item -Path "$nestedDir\bin\ffmpeg.exe" -Destination "$binDir\ffmpeg.exe" -Force
Move-Item -Path "$nestedDir\bin\ffprobe.exe" -Destination "$binDir\ffprobe.exe" -Force
Remove-Item -Recurse -Force "$binDir\ffmpeg_temp"
Remove-Item -Force $ffmpegZip
Write-Host "FFmpeg and FFprobe installed successfully in $binDir" -ForegroundColor Green

# 3. Download and extract Piper
Write-Host "3. Downloading Piper TTS Windows binary..." -ForegroundColor Green
$piperZip = "$binDir\piper.zip"
Invoke-WebRequest -Uri "https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip" -OutFile $piperZip

Write-Host "Extracting Piper..." -ForegroundColor Green
Expand-Archive -Path $piperZip -DestinationPath "$binDir\piper_temp" -Force
# Move all files from the subfolder to bin/
Move-Item -Path "$binDir\piper_temp\piper\*" -Destination "$binDir\" -Force
Remove-Item -Recurse -Force "$binDir\piper_temp"
Remove-Item -Force $piperZip
Write-Host "Piper TTS installed successfully in $binDir" -ForegroundColor Green

# 4. Download Piper Model
Write-Host "4. Downloading English Voice Model (en_US-lessac-medium)..." -ForegroundColor Green
Write-Host "Downloading ONNX file (approx 15MB)..." -ForegroundColor Green
Invoke-WebRequest -Uri "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx" -OutFile "$modelDir\en_US-lessac-medium.onnx"
Write-Host "Downloading model JSON configuration..." -ForegroundColor Green
Invoke-WebRequest -Uri "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json" -OutFile "$modelDir\en_US-lessac-medium.onnx.json"
Write-Host "Voice model installed successfully in $modelDir" -ForegroundColor Green

# 5. Update .env File
Write-Host "5. Updating .env configurations..." -ForegroundColor Green
$envPath = "$backendDir\.env"
if (Test-Path $envPath) {
    $envContent = Get-Content $envPath
    
    # Define new paths using forward slashes
    $newPiperPath = "PIPER_PATH=$binDir/piper.exe".Replace("\", "/")
    $newPiperModel = "PIPER_MODEL=$modelDir/en_US-lessac-medium.onnx".Replace("\", "/")
    $newFfmpeg = "PIPER_PATH=$binDir/piper.exe".Replace("\", "/") # wait, let's make sure key is correct
    $newFfmpeg = "FFMPEG_PATH=$binDir/ffmpeg.exe".Replace("\", "/")
    $newFfprobe = "FFPROBE_PATH=$binDir/ffprobe.exe".Replace("\", "/")

    # Replace values
    $newEnvContent = @()
    foreach ($line in $envContent) {
        if ($line -like "PIPER_PATH=*") {
            $newEnvContent += $newPiperPath
        } elseif ($line -like "PIPER_MODEL=*") {
            $newEnvContent += $newPiperModel
        } elseif ($line -like "FFMPEG_PATH=*") {
            $newEnvContent += $newFfmpeg
        } elseif ($line -like "FFPROBE_PATH=*") {
            $newEnvContent += $newFfprobe
        } else {
            $newEnvContent += $line
        }
    }
    
    $newEnvContent | Set-Content $envPath
    Write-Host ".env file updated successfully!" -ForegroundColor Green
} else {
    Write-Warning ".env file not found at $envPath. Please configure path manually."
}

Write-Host "==================================================" -ForegroundColor Green
Write-Host "All binaries installed and configured successfully!" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
