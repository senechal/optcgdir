FROM python:3.12-slim
WORKDIR /service

# tesseract-ocr-eng não vem via "recommends" (que desligamos abaixo pra
# imagem ficar menor), então precisa ser listado explicitamente. Tesseract
# fica só como fallback (ver processing.py) — RapidOCR (sobre ONNX Runtime)
# é o engine principal. libgl1/libxcb1/libxext6/libsm6 são exigidos pela
# cadeia de import do opencv mesmo em ambiente sem GUI (container slim não
# tem essas libs por padrão). PaddleOCR/paddlepaddle foram removidos: a
# CPU de produção (Intel Celeron N3450, Apollo Lake) não tem AVX — nem
# AVX1 — e o paddlepaddle trava com "illegal instruction" nela; o
# onnxruntime faz dispatch de instrução em tempo de execução e roda em
# qualquer CPU x86_64, testado e confirmado nessa mesma máquina.
RUN apt-get update && apt-get install -y --no-install-recommends \
      tesseract-ocr tesseract-ocr-eng libglib2.0-0 libgl1 libxcb1 libxext6 libsm6 \
    && rm -rf /var/lib/apt/lists/*

COPY ocr-service/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY ocr-service/src ./src

EXPOSE 5000
# --preload roda o import do app (que já instancia o RapidOCR, ver
# processing.py) uma vez no processo master ANTES de dar fork nos workers —
# assim os workers compartilham as páginas de memória do modelo via
# copy-on-write em vez de cada um carregar sua própria cópia, e a primeira
# request de cada worker não paga o custo de inicializar o modelo.
# --timeout: o padrão do gunicorn (30s) matava o worker no meio do
# processamento numa foto real na CPU de produção (Celeron N3450, bem mais
# fraca que a máquina de dev) — via "WORKER TIMEOUT" nos logs, não falta de
# memória (mensagem padrão do gunicorn pra qualquer SIGKILL por timeout).
# Configurável via GUNICORN_TIMEOUT (ver docker-compose.yml,
# OCR_GUNICORN_TIMEOUT) pra CPUs ainda mais fracas não precisarem de uma
# imagem nova — 120 é o padrão se a variável não for definida (inclusive
# rodando essa imagem fora do compose). CMD em forma shell (com "exec")
# pra permitir a expansão de variável e ainda assim deixar o gunicorn
# como processo principal (PID 1), recebendo sinais corretamente.
ENV GUNICORN_TIMEOUT=120
CMD exec gunicorn --preload -w 2 --timeout "${GUNICORN_TIMEOUT}" -b 0.0.0.0:5000 src.main:app
