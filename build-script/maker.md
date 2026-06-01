# Test

flask run --debug --host=0.0.0.0

# Build

## Package the main app (Windows)
```
pyinstaller --name=clipboard_app --add-data "templates;templates" --add-data "static;static" app.py -y
```

## Package the main app (Linux)
```
pyinstaller --name=clipboard_app --add-data "templates:templates" --add-data "static:static" app.py -y
```

## PACK apploader
```
pyinstaller --name=apploader apploader.py -y
```

## Clean up files after packaging
```
git clean -fdX
```

# docker

```
docker rmi kasusa/lan-clipboard-app:latest
docker build -t kasusa/lan-clipboard-app:latest .
docker tag kasusa/lan-clipboard-app:latest kasusa/lan-clipboard-app:20251229
docker run -d -p 5000:5000 kasusa/lan-clipboard-app:latest
docker login
# It's successful once you see your avatar in Docker Desktop.
docker push kasusa/lan-clipboard-app:latest
docker push kasusa/lan-clipboard-app:20251229
```

Use docker image pusher to push to the Alibaba Cloud registry
https://github.com/cornradio/docker_image_pusher/edit/main/images.txt
https://github.com/cornradio/docker_image_pusher/actions