FROM python:3.12-slim
WORKDIR /service

# tesseract-ocr-eng não vem via "recommends" (que desligamos abaixo pra
# imagem ficar menor), então precisa ser listado explicitamente. Tesseract
# fica só como fallback (ver processing.py) — PaddleOCR é o engine
# principal agora. libgomp1 é exigido pelo runtime nativo do paddlepaddle;
# libgl1 é exigido pelo opencv-contrib-python que o paddleocr traz junto
# (diferente do opencv-python-headless que usávamos antes, que não precisa
# de libGL).
RUN apt-get update && apt-get install -y --no-install-recommends \
      tesseract-ocr tesseract-ocr-eng libglib2.0-0 libgomp1 libgl1 \
    && rm -rf /var/lib/apt/lists/*

COPY ocr-service/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Baixa os modelos do PaddleOCR (det/rec/cls) em tempo de build, não na
# primeira request — o servidor doméstico não deveria depender de rede pra
# subir, e isso evita um pico de latência (~1min) no primeiro scan.
RUN python -c "from paddleocr import PaddleOCR; PaddleOCR(use_angle_cls=True, lang='en', show_log=False)"

COPY ocr-service/src ./src

EXPOSE 5000
# --preload roda o import do app (que já instancia o PaddleOCR, ver
# processing.py) uma vez no processo master ANTES de dar fork nos workers —
# assim os workers compartilham as páginas de memória do modelo via
# copy-on-write em vez de cada um carregar sua própria cópia, e a primeira
# request de cada worker não paga o custo de inicializar o modelo.
CMD ["gunicorn", "--preload", "-w", "2", "-b", "0.0.0.0:5000", "src.main:app"]
