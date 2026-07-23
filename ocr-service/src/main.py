from flask import Flask, jsonify, request

from .processing import extract_text

app = Flask(__name__)


@app.get("/health")
def health():
    return jsonify(status="ok")


@app.post("/ocr")
def ocr():
    body = request.get_json(silent=True) or {}
    image_path = body.get("imagePath")
    if not image_path:
        return jsonify(error="imagePath é obrigatório"), 400

    try:
        text = extract_text(image_path)
    except ValueError as err:
        return jsonify(error=str(err)), 400
    except Exception as err:  # noqa: BLE001 - erro inesperado de processamento
        return jsonify(error=f"falha ao processar imagem: {err}"), 500

    return jsonify(text=text)
