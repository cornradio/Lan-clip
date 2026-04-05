# Configuration (保持不变)
$IMAGE_NAME = "kasusa/lan-clip"
$TAG = "latest"
$FULL_IMAGE_NAME = "${IMAGE_NAME}:${TAG}"
$TAR_NAME = "lan-clip-deploy.tar"

Write-Host "=========================================="
Write-Host "   Lan-Clip Build & Deploy Script"
Write-Host "=========================================="
Write-Host ""

# Set project root (保持不变)
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $projectRoot
Write-Host "Current working directory set to: $(Get-Location)" -ForegroundColor Yellow

# Step 0: Cleanup (保持不变)
$response = Read-Host "Step 0: Cleanup temporary files and data (dist, build, cards, images, uploads)? [y/n]"
if ($response -eq 'y') {
    $itemsToClean = @("dist", "build", "cards", "images", "uploads", "__pycache__")
    foreach ($item in $itemsToClean) {
        if (Test-Path $item) { Remove-Item -Path $item -Recurse -Force }
    }
    $dataDirs = @("cards", "images", "uploads")
    foreach ($dir in $dataDirs) {
        if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    }
    Write-Host "Cleanup successful." -ForegroundColor Green
} else { Write-Host "Skipping cleanup." }

Write-Host ""

# Docker steps (保持不变)
$runDockerSteps = $false
$response = Read-Host "Step 1: Build Docker Image ($FULL_IMAGE_NAME)? [y/n]"
if ($response -eq 'y') {
    $runDockerSteps = $true
    docker build -t $FULL_IMAGE_NAME .
    if ($LASTEXITCODE -eq 0) { Write-Host "Docker build successful." -ForegroundColor Green }
    else { Write-Host "Docker build failed." -ForegroundColor Red; $runDockerSteps = $false }
} else { Write-Host "Skipping Docker build and all subsequent Docker steps." }

Write-Host ""

if ($runDockerSteps) {
    $response = Read-Host "Step 2: Push Docker Image to Remote? [y/n]"
    if ($response -eq 'y') {
        docker push $FULL_IMAGE_NAME
        if ($LASTEXITCODE -eq 0) { Write-Host "Docker push successful." -ForegroundColor Green }
        else { Write-Host "Docker push failed." -ForegroundColor Red }
    } else { Write-Host "Skipping Docker push." }
} else { Write-Host "Skipping Docker push as Docker build was skipped or failed." }

Write-Host ""

if ($runDockerSteps) {
    $response = Read-Host "Step 3: Save Docker Image to Tar ($TAR_NAME)? [y/n]"
    if ($response -eq 'y') {
        if (Test-Path $TAR_NAME) { Remove-Item $TAR_NAME -Force }
        docker save -o $TAR_NAME $FULL_IMAGE_NAME
        if ($LASTEXITCODE -eq 0) { Write-Host "Docker image saved successfully: $TAR_NAME" -ForegroundColor Green }
        else { Write-Host "Failed to save Docker image." -ForegroundColor Red }
    } else { Write-Host "Skipping Docker save." }
} else { Write-Host "Skipping Docker save as Docker build was skipped or failed." }

Write-Host ""

# =================================================================
# Step 4: Windows Build (通过 build-win.bat)
# =================================================================

$response = Read-Host "Step 4: Run Windows Build Script (build-win.bat)? [y/n]"
if ($response -eq 'y') {
    Write-Host "Running Windows Build Script..."

    # 使用绝对路径，避免 bat 脚本改变工作目录后路径失效
    $buildScriptPath = Join-Path $projectRoot "build-script\build-win.bat"

    # ==================== 调试信息 ====================
    Write-Host "Current location before running batch: $(Get-Location)" -ForegroundColor Cyan
    Write-Host "Attempting to run batch script from: $buildScriptPath" -ForegroundColor Cyan
    # ====================================================

    if (Test-Path $buildScriptPath) {

        # 执行 bat 前锁定工作目录，执行完自动恢复，防止 bat 内部 cd 污染后续路径
        Push-Location $projectRoot
        & $buildScriptPath
        $batchExitCode = $LASTEXITCODE
        Pop-Location

        if ($batchExitCode -eq 0) {
            Write-Host "Windows build successful (batch script exited with code 0)." -ForegroundColor Green

            # ========================================================
            # Resolve traymode.vbs copy issue (Use absolute paths)
            # ========================================================
            $vbsSource = Join-Path $projectRoot "traymode.vbs"
            $targetBaseDir = Join-Path $projectRoot "dist"

            if (-not (Test-Path $vbsSource)) {
                Write-Host "[ERROR] Source file 'traymode.vbs' not found in root! Copy aborted." -ForegroundColor Red
            } elseif (-not (Test-Path $targetBaseDir -PathType Container)) {
                Write-Host "[ERROR] Target directory 'dist' doesn't exist! build-win.bat may have failed." -ForegroundColor Red
            } else {
                # Find compiled target subdirectories
                $subDirs = @(Get-ChildItem -Path $targetBaseDir -Directory -ErrorAction SilentlyContinue)
                
                if ($subDirs.Count -gt 0) {
                    $lanClipDir = $subDirs | Where-Object { $_.Name -eq "lan-clip" }
                    if ($lanClipDir) {
                        $actualTargetDir = $lanClipDir.FullName
                    } else {
                        $actualTargetDir = $subDirs[0].FullName
                    }
                } else {
                    $actualTargetDir = $targetBaseDir
                }

                $vbsDestinationPath = Join-Path $actualTargetDir "traymode.vbs"
                Write-Host "Copying 'traymode.vbs' to '$actualTargetDir' ..." -ForegroundColor Cyan
                
                try {
                    Copy-Item -Path $vbsSource -Destination $vbsDestinationPath -Force -ErrorAction Stop
                    
                    if (Test-Path $vbsDestinationPath) {
                        Write-Host "[SUCCESS] traymode.vbs copied successfully to: $vbsDestinationPath" -ForegroundColor Green
                    } else {
                        Write-Host "[SEVERE] Copy-Item succeeded but file is missing at: $vbsDestinationPath" -ForegroundColor Red
                    }
                } catch {
                    Write-Host "[FATAL ERROR] Failed to copy traymode.vbs! (Check permissions/antivirus)" -ForegroundColor Red
                    Write-Host "Details: $($_.Exception.Message)" -ForegroundColor Red
                }
            }
            # ========================================================

            # Zip the dist directory
            $zipSourcePath = Join-Path $projectRoot "dist"
            $zipDestinationPath = Join-Path $projectRoot "lan-clip_win.zip"

            if (Test-Path $zipDestinationPath) { Remove-Item $zipDestinationPath -Force }

            Write-Host "Compressing '$zipSourcePath' to zip..." -ForegroundColor Cyan
            try {
                if (-not (Test-Path $zipSourcePath -PathType Container)) {
                    throw "Directory 'dist' not found. Cannot compress."
                }

                Get-ChildItem -Path "$zipSourcePath\*" | Compress-Archive -DestinationPath $zipDestinationPath -Force -ErrorAction Stop
                
                if (Test-Path $zipDestinationPath) {
                    Write-Host "[SUCCESS] Files compressed successfully to '$zipDestinationPath'." -ForegroundColor Green
                } else {
                    Write-Host "[SEVERE] Compression finished but output zip is missing: $zipDestinationPath" -ForegroundColor Red
                }
            }
            catch {
                Write-Host "[FATAL ERROR] ZIP compression failed!" -ForegroundColor Red
                Write-Host "Details: $($_.Exception.Message)" -ForegroundColor Red
            }

        } else {
            Write-Host "Windows build failed (batch script exited with code $batchExitCode)." -ForegroundColor Red
        }

    } else {
        Write-Host "Error: '$buildScriptPath' not found in '$projectRoot'." -ForegroundColor Red
    }

} else {
    Write-Host "Skipping Windows build."
}

Write-Host ""
Write-Host "Done. Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

