"""Pré-processamento (OpenCV) + OCR (Tesseract) de uma foto de carta."""

import cv2
import numpy as np
import pytesseract

# Card real: proporção 63mm x 88mm (mesma da maioria dos TCGs).
CARD_ASPECT_RATIO = 63 / 88
STRAIGHTENED_WIDTH = 630
STRAIGHTENED_HEIGHT = round(STRAIGHTENED_WIDTH / CARD_ASPECT_RATIO)


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
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 50, 150)
    edges = cv2.dilate(edges, None, iterations=2)
    edges = cv2.erode(edges, None, iterations=1)

    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None

    image_area = gray.shape[0] * gray.shape[1]
    best_quad = None
    best_area = 0

    for contour in sorted(contours, key=cv2.contourArea, reverse=True)[:10]:
        area = cv2.contourArea(contour)
        # Carta deve ocupar uma fração razoável da foto, senão é ruído de fundo.
        if area < image_area * 0.15:
            continue
        peri = cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, 0.02 * peri, True)
        if len(approx) == 4 and area > best_area:
            best_quad = approx.reshape(4, 2)
            best_area = area

    return best_quad


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
    return pytesseract.image_to_string(target_gray, lang="eng")
