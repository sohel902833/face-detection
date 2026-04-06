FROM python:3.11-slim

WORKDIR /app

# System deps for OpenCV and InsightFace
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download the model during build for fast cold start
RUN python -c "\
import os; \
os.makedirs('/app/models', exist_ok=True); \
from insightface.app import FaceAnalysis; \
fa = FaceAnalysis(name='buffalo_sc', root='/app/models', providers=['CPUExecutionProvider']); \
fa.prepare(ctx_id=-1, det_size=(320,320)); \
print('Model downloaded and ready')"

COPY . .

EXPOSE 8001

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "2"]
