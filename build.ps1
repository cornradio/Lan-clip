# Configuration
$IMAGE_NAME = "kasusa/lan-clip"
$TAG = "latest"
$FULL_IMAGE_NAME = "${IMAGE_NAME}:${TAG}"
$TAR_NAME = "lan-clip-deploy.tar"

Write-Host "=========================================="
Write-Host "   Lan-Clip Build & Deploy Script"
Write-Host "=========================================="
Write-Host ""

# Step 0: Cleanup
$response = Read-Host "Step 0: Cleanup temporary files and data (dist, build, cards, images, uploads)? [y/n]"
if ($response -eq 'y') {
    Write-Host "Cleaning up project directories..."
    $itemsToClean = @("dist", "build", "cards", "images", "uploads", "__pycache__")
    foreach ($item in $itemsToClean) {
        if (Test-Path $item) {
            Write-Host "Removing $item..."
            Remove-Item -Path $item -Recurse -Force
            # Recreate data dirs if they were deleted (optional)
            if ($item -in @("cards", "images", "uploads")) {
                New-Item -ItemType Directory -Path $item -Force | Out-Null
            }
        }
    }
    Write-Host "Cleanup successful." -ForegroundColor Green
} else {
    Write-Host "Skipping cleanup."
}

Write-Host ""

# Step 1: Docker Build
$response = Read-Host "Step 1: Build Docker Image ($FULL_IMAGE_NAME)? [y/n]"
if ($response -eq 'y') {
    Write-Host "Building Docker Image..."
    docker build -t $FULL_IMAGE_NAME .
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Docker build successful." -ForegroundColor Green
    } else {
        Write-Host "Docker build failed." -ForegroundColor Red
        exit
    }
} else {
    Write-Host "Skipping Docker build."
}

Write-Host ""

# Step 3: Local Docker Tar
$response = Read-Host "Step 3: Save Docker Image to Tar ($TAR_NAME)? [y/n]"
if ($response -eq 'y') {
    Write-Host "Saving Docker Image to Tar..."

    # Remove old tar if exists
    if (Test-Path $TAR_NAME) {
        Remove-Item $TAR_NAME
        Write-Host "Removed old tar file."
    }

    docker save -o $TAR_NAME $FULL_IMAGE_NAME
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Docker image saved successfully: $TAR_NAME" -ForegroundColor Green
    } else {
        Write-Host "Failed to save Docker image." -ForegroundColor Red
    }
} else {
    Write-Host "Skipping Docker save."
}

Write-Host ""

# Step 2: Docker Push
$response = Read-Host "Step 2: Push Docker Image to Remote? [y/n]"
if ($response -eq 'y') {
    Write-Host "Pushing to remote repository..."
    docker push $FULL_IMAGE_NAME
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Docker push successful." -ForegroundColor Green
    } else {
        Write-Host "Docker push failed." -ForegroundColor Red
        # We don't exit here to allow other steps
    }
} else {
    Write-Host "Skipping Docker push."
}

Write-Host ""



# Step 4: Windows Build (PyInstaller)
$response = Read-Host "Step 4: Run Windows Build Script (build-win.bat)? [y/n]"
if ($response -eq 'y') {
    Write-Host "Running Windows Build Script..."
    if (Test-Path "build-script\build-win.bat") {
        cmd /c "build-script\build-win.bat"
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Windows build successful." -ForegroundColor Green
        } else {
            Write-Host "Windows build failed." -ForegroundColor Red
        }
    } else {
        Write-Host "Error: build-script\build-win.bat not found." -ForegroundColor Red
    }
} else {
    Write-Host "Skipping Windows build."
}

Write-Host ""
Write-Host "Done. Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
