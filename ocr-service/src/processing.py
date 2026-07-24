"""Pré-processamento (OpenCV) + OCR (Tesseract) de uma foto de carta."""

import cv2
import numpy as np
import pytesseract

# Card real: proporção 63mm x 88mm (mesma da maioria dos TCGs).
CARD_ASPECT_RATIO = 63 / 88
STRAIGHTENED_WIDTH = 630
STRAIGHTENED_HEIGHT = round(STRAIGHTENED_WIDTH / CARD_ASPECT_RATIO)

# O código impresso (ex: "OP12-001") fica sempre numa faixa fina no rodapé
# da carta — no canto esquerdo em carta de Personagem/Evento, no direito em
# carta de Líder (o esquerdo ali é ocupado pelo ícone de cor/atributo).
# Pequeno demais pra sair legível quando o OCR roda na carta inteira, então
# isolamos e ampliamos os dois cantos numa passada à parte.
CODE_STRIP_TOP_RATIO = 0.885
CODE_STRIP_BOTTOM_RATIO = 0.95
CODE_STRIP_CORNER_WIDTH_RATIO = 0.35
# --psm 11 (texto esparso, sem presumir bloco/linha única) leu bem melhor
# aqui do que --psm 7 — o corte, mesmo isolado, ainda tem ícones ao lado do
# texto, e o Tesseract não considera isso "uma linha só". Whitelist de
# caracteres não ajudou (cortava o hífen do meio do código e colava dígitos
# de ícones vizinhos) — melhor deixar solto e extrair com regex depois.
CODE_OCR_CONFIG = "--oem 1 --psm 11"

# Fotos de celular vêm em resolução bem alta — rodar o Canny direto nelas faz
# a própria textura/traços da ilustração virarem "bordas", fragmentando o
# contorno externo da carta em centenas de pedaços (nenhum vira um
# quadrilátero de 4 pontos). Detectar numa cópia bem menor filtra esse ruído
# fino e ainda preserva o contorno grande da carta; escalamos o resultado de
# volta pra resolução original antes de usar no perspective warp.
CONTOUR_DETECTION_WIDTH = 600


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

    largest_contour = None
    largest_area = 0

    for contour in sorted(contours, key=cv2.contourArea, reverse=True)[:10]:
        area = cv2.contourArea(contour)
        # Carta deve ocupar uma fração razoável da foto, senão é ruído de fundo.
        if area < image_area * 0.15:
            continue
        if area > largest_area:
            largest_contour = contour
            largest_area = area
        peri = cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, 0.02 * peri, True)
        if len(approx) == 4 and area > best_area:
            best_quad = approx.reshape(4, 2)
            best_area = area

    quad = best_quad
    if quad is None and largest_contour is not None:
        # Fotos de carta em sleeve/toploader costumam ter brilho/reflexo que
        # quebra o contorno em mais de 4 pontos — cai pro retângulo mínimo do
        # maior contorno em vez de desistir e usar a foto crua sem corte algum.
        quad = cv2.boxPoints(cv2.minAreaRect(largest_contour))

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


def _ocr_region(region_bgr: np.ndarray) -> str:
    gray = cv2.cvtColor(region_bgr, cv2.COLOR_BGR2GRAY)
    # Recorte é bem pequeno (só um canto do rodapé) — amplia bastante antes
    # de binarizar, senão o texto vira só um borrão de poucos pixels de altura.
    gray = cv2.resize(gray, None, fx=6, fy=6, interpolation=cv2.INTER_CUBIC)
    gray = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(gray)

    _, thresholded = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    inverted = cv2.bitwise_not(thresholded)

    # Não dá pra saber de antemão se o rodapé é texto claro em fundo escuro
    # ou o contrário — roda os dois e junta; o pior caso é só mais ruído no
    # texto (o match de código é por regex depois, então não atrapalha).
    return "\n".join(
        pytesseract.image_to_string(variant, config=CODE_OCR_CONFIG)
        for variant in (thresholded, inverted)
    )


def _ocr_code_strip(straightened_bgr: np.ndarray) -> str:
    height, width = straightened_bgr.shape[:2]
    top = round(height * CODE_STRIP_TOP_RATIO)
    bottom = round(height * CODE_STRIP_BOTTOM_RATIO)
    band = straightened_bgr[top:bottom, 0:width]

    corner_width = round(width * CODE_STRIP_CORNER_WIDTH_RATIO)
    left_corner = band[:, 0:corner_width]
    right_corner = band[:, width - corner_width : width]

    return "\n".join([_ocr_region(left_corner), _ocr_region(right_corner)])


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

    target_gray = cv2.cvtColor(target, cv2.COLOR_BGR2GRAY)
    full_text = pytesseract.image_to_string(target_gray, lang="eng")
    code_text = _ocr_code_strip(target)

    # Código isolado primeiro: é o sinal mais forte pro ranking em
    # cardMatch.ts, então deve vir antes do texto cheio da carta.
    return f"{code_text}\n{full_text}"
