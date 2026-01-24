#!/bin/bash
#用于在服务器上使用 tar 更新 Lan-clip docker容器

IMAGE_NAME="kasusa/lan-clip:latest"
CONTAINER_NAME="lan-clip"
TAR_FILE="lan-clip-deploy.tar"

echo "开始执行暴力更新流程..."

# 1. 第一步：根据端口强杀（最管用）
# 查找占用 5000 端口的容器 ID 并强制删除
PORT_CONTAINER=$(docker ps -q --filter "publish=5000")
if [ -n "$PORT_CONTAINER" ]; then
    echo "发现占用 5000 端口的容器 $PORT_CONTAINER，正在强制删除..."
    docker rm -f $PORT_CONTAINER
fi

# 2. 第二步：根据名字强杀
# 防止之前有叫 lan-clip 但没运行的容器残留
if [ "$(docker ps -aq -f name=^/${CONTAINER_NAME}$)" ]; then
    echo "清理同名容器..."
    docker rm -f $CONTAINER_NAME
fi

# 3. 第三步：清理镜像
# 拿到旧镜像的 ID（即使是那些没名字的 <none> 镜像也一并清理）
OLD_IMAGE_IDS=$(docker images -q $IMAGE_NAME)
if [ -n "$OLD_IMAGE_IDS" ]; then
    echo "正在强制删除旧镜像..."
    docker rmi -f $OLD_IMAGE_IDS
fi

# 4. 第四步：加载并运行
if [ -f "$TAR_FILE" ]; then
    echo "正在从 $TAR_FILE 加载新镜像..."
    docker load -i "$TAR_FILE"
    
    echo "正在启动新容器..."
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
    echo "错误: $TAR_FILE 不存在！"
    exit 1
fi

echo "部署完毕！"