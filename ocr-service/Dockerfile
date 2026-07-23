FROM python:3.12-slim
WORKDIR /service

# tesseract-ocr-eng não vem via "recommends" (que desligamos abaixo pra
# imagem ficar menor), então precisa ser listado explicitamente.
RUN apt-get update && apt-get install -y --no-install-recommends \
      tesseract-ocr tesseract-ocr-eng libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY ocr-service/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY ocr-service/src ./src

EXPOSE 5000
CMD ["gunicorn", "-w", "2", "-b", "0.0.0.0:5000", "src.main:app"]
