FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# 排除dist文件夹    
COPY . . 

ENV FLASK_APP=app.py
ENV FLASK_ENV=production

EXPOSE 5000

# flask run --host=0.0.0.0 --port=5000
CMD ["flask", "run", "--host=0.0.0.0", "--port=5000"] 