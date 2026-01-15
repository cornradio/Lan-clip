# Configuration
$IMAGE_NAME = "kasusa/lan-clip"
$TAG = "latest"
$FULL_IMAGE_NAME = "${IMAGE_NAME}:${TAG}"
$ZIP_NAME = "lan-clip-deploy.zip"

Write-Host "=========================================="
Write-Host "   Lan-Clip Build & Deploy Script"
Write-Host "=========================================="
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

# Step 2: Docker Push
$response = Read-Host "Step 2: Push Docker Image to Remote? [y/n]"
if ($response -eq 'y') {
    Write-Host "Pushing to remote repository..."
    docker push $FULL_IMAGE_NAME
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Docker push successful." -ForegroundColor Green
    } else {
        Write-Host "Docker push failed." -ForegroundColor Red
        # We don't exit here to allow zipping
    }
} else {
    Write-Host "Skipping Docker push."
}

Write-Host ""

# Step 3: Local Zip
$response = Read-Host "Step 3: Create Local Deploy Zip ($ZIP_NAME)? [y/n]"
if ($response -eq 'y') {
    Write-Host "Creating Zip archive..."
    
    # Remove old zip if exists
    if (Test-Path $ZIP_NAME) {
        Remove-Item $ZIP_NAME
        Write-Host "Removed old zip file."
    }

    # Define files/folders to include
    # We explicitly list them to avoid including .git, venv, etc.
    $filesToZip = @(
        "app.py",
        "auth_service.py",
        "requirements.txt",
        "pwd.txt",
        "Dockerfile",
        "readme.md",
        "static",
        "templates"
    )

    # Validate existence
    $validFiles = @()
    foreach ($file in $filesToZip) {
        if (Test-Path $file) {
            $validFiles += $file
        } else {
            Write-Host "Warning: File '$file' not found, skipping." -ForegroundColor Yellow
        }
    }

    if ($validFiles.Count -gt 0) {
        Compress-Archive -Path $validFiles -DestinationPath $ZIP_NAME
        Write-Host "Zip archive created successfully: $ZIP_NAME" -ForegroundColor Green
    } else {
        Write-Host "No valid files found to zip." -ForegroundColor Red
    }
} else {
    Write-Host "Skipping Zip creation."
}

Write-Host ""
Write-Host "Done. Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
