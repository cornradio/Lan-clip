# 测试

flask run --debug --host=0.0.0.0

# 打包

## 打包程序本体 win
```
pyinstaller --name=clipboard_app --add-data "templates;templates" --add-data "static;static" app.py -y
```

## 打包程序本体 linux
```
pyinstaller --name=clipboard_app --add-data "templates:templates" --add-data "static:static" app.py -y
```

## PACK apploader
```
pyinstaller --name=apploader apploader.py -y
```

## 打包后清理文件
```
git clean -fdX
```

# docker

```
docker rmi kasusa/lan-clipboard-app:latest
docker build -t kasusa/lan-clipboard-app:latest .
docker tag kasusa/lan-clipboard-app:latest kasusa/lan-clipboard-app:20251219
docker run -d -p 5000:5000 kasusa/lan-clipboard-app:latest
docker login
# 看到docker desktop 上面有头像算成功。
docker push kasusa/lan-clipboard-app:latest
docker push kasusa/lan-clipboard-app:20251219
```


https://github.com/cornradio/docker_image_pusher/edit/main/images.txt