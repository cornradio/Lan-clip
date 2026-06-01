#!/bin/bash
# Used to update the Lan-clip docker container on the server using a tar file

IMAGE_NAME="kasusa/lan-clip:latest"
CONTAINER_NAME="lan-clip"
TAR_FILE="lan-clip-deploy.tar"

echo "Starting forced update process..."

# 1. Step one: force-kill by port (most reliable)
# Find the ID of the container using port 5000 and force-remove it
PORT_CONTAINER=$(docker ps -q --filter "publish=5000")
if [ -n "$PORT_CONTAINER" ]; then
    echo "Found container $PORT_CONTAINER using port 5000, force-removing it..."
    docker rm -f $PORT_CONTAINER
fi

# 2. Step two: force-kill by name
# Prevent a leftover container named lan-clip that isn't running
if [ "$(docker ps -aq -f name=^/${CONTAINER_NAME}$)" ]; then
    echo "Cleaning up the container with the same name..."
    docker rm -f $CONTAINER_NAME
fi

# 3. Step three: clean up images
# Get the IDs of the old images (clean up the unnamed <none> images as well)
OLD_IMAGE_IDS=$(docker images -q $IMAGE_NAME)
if [ -n "$OLD_IMAGE_IDS" ]; then
    echo "Force-removing old images..."
    docker rmi -f $OLD_IMAGE_IDS
fi

# 4. Step four: load and run
if [ -f "$TAR_FILE" ]; then
    echo "Loading the new image from $TAR_FILE..."
    docker load -i "$TAR_FILE"

    echo "Starting the new container..."
    docker run -d \
      --name $CONTAINER_NAME \
      -p 5000:5000 \
      -v "$(pwd)/LAN-clip/cards:/app/cards" \
      -v "$(pwd)/LAN-clip/uploads:/app/uploads" \
      -v "$(pwd)/LAN-clip/images:/app/images" \
      -v "$(pwd)/LAN-clip/pinned.json:/app/pinned.json" \
      -v "$(pwd)/LAN-clip/pwd.txt:/app/pwd.txt" \
      --restart always \
      $IMAGE_NAME
else
    echo "Error: $TAR_FILE does not exist!"
    exit 1
fi

echo "Deployment complete!"