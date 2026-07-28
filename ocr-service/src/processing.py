"""Pré-processamento (OpenCV) + OCR (PaddleOCR, com Tesseract como fallback) de uma foto de carta."""

import cv2
import numpy as np
import pytesseract
from paddleocr import PaddleOCR

# Card real: proporção 63mm x 88mm (mesma da maioria dos TCGs).
CARD_ASPECT_RATIO = 63 / 88
STRAIGHTENED_WIDTH = 630
STRAIGHTENED_HEIGHT = round(STRAIGHTENED_WIDTH / CARD_ASPECT_RATIO)

# Fotos de celular vêm em resolução bem alta — rodar o Canny direto nelas faz
# a própria textura/traços da ilustração virarem "bordas", fragmentando o
# contorno externo da carta em centenas de pedaços (nenhum vira um
# quadrilátero de 4 pontos). Detectar numa cópia bem menor filtra esse ruído
# fino e ainda preserva o contorno grande da carta; escalamos o resultado de
# volta pra resolução original antes de usar no perspective warp.
CONTOUR_DETECTION_WIDTH = 600

# Em fundos texturizados (ex: carpete), o dilate às vezes funde a borda da
# carta com o ruído do fundo num único contorno externo gigante, cobrindo
# quase o quadro inteiro da foto — não é a carta, é a ausência de detecção
# disfarçada de detecção. Um recorte de verdade sempre deixa alguma margem
# visível (é literalmente o motivo de recortar), então um contorno cobrindo
# quase tudo é sinal de falha, não de uma carta que preenche o quadro.
# Descartar esses casos e cair pro fallback "sem corte" (usa a foto crua)
# é estritamente melhor que endireitar um quadrilátero errado — verificado
# contra fotos reais que travavam nisso (EB04-001.jpg, OP16-058.jpg): o
# contorno "encontrado" cobria 97-99% da imagem.
MAX_CONTOUR_AREA_RATIO = 0.9

# Reflexo/brilho (comum em fotos com sleeve/toploader) fragmenta o contorno
# externo da carta — o pedaço isolado que sobra às vezes é só a metade de
# cima (arte), cortando o rodapé (tipo/nome/código) fora do recorte. Achado
# com uma foto real (OP10-067.jpg em sleeve): dois contornos tinham área
# quase empatada (26.3% vs 25.5% da imagem), mas só o SEGUNDO tinha a
# proporção de uma carta de verdade (0.75, contra os 0.72 esperados) — o
# primeiro era quase quadrado (0.91) e correspondia só à metade superior.
# Escolher o maior por área pura pegava o errado; escolher por proximidade
# da proporção real da carta acerta.
ASPECT_RATIO_TOLERANCE = 0.15


def _aspect_ratio_score(contour: np.ndarray) -> float:
    (_, _), (w, h), _ = cv2.minAreaRect(contour)
    if w == 0 or h == 0:
        return float("inf")
    ratio = min(w, h) / max(w, h)
    return abs(ratio - CARD_ASPECT_RATIO)

# Instanciado uma vez no processo master do gunicorn (--preload, ver
# Dockerfile) antes do fork dos workers — carregar aqui, no import do
# módulo, em vez de sob demanda na primeira request, evita tanto o pico de
# latência do carregamento do modelo quanto duplicar a memória dos pesos em
# cada worker (compartilhada via copy-on-write depois do fork).
# Comparado ao Tesseract (ver ocr_code_recognition_limitation na memória do
# projeto): testado contra fotos reais categorizadas, o PaddleOCR lê o
# código impresso e o nome da carta com confiança alta mesmo em condições
# ruins (carta dentro de slab), sem precisar isolar/ampliar cantos como o
# pipeline antigo baseado em Tesseract exigia.
_paddle_ocr = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)


def _order_points(pts: np.ndarray) -> np.ndarray:
    # Ordena os 4 pontos do contorno como [top-left, top-right, bottom-right, bottom-left].
    rect = np.zeros((4, 2), dtype="float32")
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]
    rect[3] = pts[np.argmax(diff)]
    return rect


def _find_card_contour(gray: np.ndarray) -> np.ndarray | None:
    height, width = gray.shape
    scale = min(1.0, CONTOUR_DETECTION_WIDTH / width)
    small = cv2.resize(gray, (round(width * scale), round(height * scale))) if scale < 1.0 else gray

    blurred = cv2.GaussianBlur(small, (5, 5), 0)
    edges = cv2.Canny(blurred, 50, 150)
    edges = cv2.dilate(edges, None, iterations=2)
    edges = cv2.erode(edges, None, iterations=1)

    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None

    image_area = small.shape[0] * small.shape[1]
    best_quad = None
    best_area = 0

    # Melhor candidato pro fallback (minAreaRect): não é o de maior área, é
    # o de proporção mais parecida com uma carta de verdade — dois
    # contornos podem ter área quase empatada quando o reflexo fragmenta a
    # borda, e o maior nem sempre é o formato certo (ver
    # ASPECT_RATIO_TOLERANCE acima).
    best_fallback_contour = None
    best_fallback_score = float("inf")

    for contour in sorted(contours, key=cv2.contourArea, reverse=True)[:10]:
        area = cv2.contourArea(contour)
        # Carta deve ocupar uma fração razoável da foto, senão é ruído de
        # fundo — mas também não pode cobrir quase tudo, senão é a borda do
        # fundo fundida com a da carta (ver MAX_CONTOUR_AREA_RATIO acima).
        if area < image_area * 0.15 or area > image_area * MAX_CONTOUR_AREA_RATIO:
            continue
        score = _aspect_ratio_score(contour)
        if score < best_fallback_score:
            best_fallback_contour = contour
            best_fallback_score = score
        peri = cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, 0.02 * peri, True)
        if len(approx) == 4 and area > best_area:
            best_quad = approx.reshape(4, 2)
            best_area = area

    quad = best_quad
    if quad is None and best_fallback_contour is not None and best_fallback_score <= ASPECT_RATIO_TOLERANCE:
        # Fotos de carta em sleeve/toploader costumam ter brilho/reflexo que
        # quebra o contorno em mais de 4 pontos — cai pro retângulo mínimo do
        # contorno de formato mais parecido com uma carta, em vez de
        # desistir e usar a foto crua sem corte algum.
        quad = cv2.boxPoints(cv2.minAreaRect(best_fallback_contour))

    if quad is None:
        return None

    return quad / scale


def _straighten(image: np.ndarray, quad: np.ndarray) -> np.ndarray:
    rect = _order_points(quad.astype("float32"))
    dst = np.array(
        [
            [0, 0],
            [STRAIGHTENED_WIDTH - 1, 0],
            [STRAIGHTENED_WIDTH - 1, STRAIGHTENED_HEIGHT - 1],
            [0, STRAIGHTENED_HEIGHT - 1],
        ],
        dtype="float32",
    )
    matrix = cv2.getPerspectiveTransform(rect, dst)
    return cv2.warpPerspective(image, matrix, (STRAIGHTENED_WIDTH, STRAIGHTENED_HEIGHT))


def _paddle_lines(image_bgr: np.ndarray) -> list[str]:
    result = _paddle_ocr.ocr(image_bgr, cls=True)
    lines = result[0] if result and isinstance(result[0], list) else (result or [])
    # PaddleOCR já detecta e recorta cada linha de texto sozinho (é o que o
    # torna melhor que o Tesseract pra fonte pequena/densa do rodapé da
    # carta) — não precisamos mais isolar/ampliar cantos na mão. Ordena de
    # cima pra baixo só pra manter a saída legível/estável; cardMatch.ts já
    # compara contra cada linha independente da ordem.
    ordered = sorted(lines, key=lambda line: line[0][0][1])
    return [text for _, (text, _confidence) in ordered]


def extract_text(image_path: str) -> str:
    image = cv2.imread(image_path)
    if image is None:
        raise ValueError(f"não foi possível ler a imagem: {image_path}")

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # Se não achar um contorno de carta confiável, segue com a imagem original
    # em vez de falhar o request inteiro — degrada a qualidade do match, não
    # derruba a feature.
    quad = _find_card_contour(gray)
    target = _straighten(image, quad) if quad is not None else image

    try:
        lines = _paddle_lines(target)
        if lines:
            return "\n".join(lines)
    except Exception:  # noqa: BLE001 - fallback deliberado, ver comentário abaixo
        pass

    # PaddleOCR falhando (ou não achando nenhuma linha) não pode derrubar o
    # scan inteiro — cai pro Tesseract, mais fraco mas confiável, em vez de
    # devolver erro pro usuário.
    target_gray = cv2.cvtColor(target, cv2.COLOR_BGR2GRAY)
    return pytesseract.image_to_string(target_gray, lang="eng")
