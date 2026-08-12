import os
import math
import qrcode
from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.pdfgen import canvas

# Dimensions in millimeters and points
LETTER_WIDTH_MM = 215.9
LETTER_HEIGHT_MM = 279.4
BADGE_DIAMETER_MM = 150.0  # Exactly 15 cm

MM_TO_PT = 72.0 / 25.4
LETTER_WIDTH_PT = LETTER_WIDTH_MM * MM_TO_PT
LETTER_HEIGHT_PT = LETTER_HEIGHT_MM * MM_TO_PT
BADGE_DIAMETER_PT = BADGE_DIAMETER_MM * MM_TO_PT
BADGE_RADIUS_PT = BADGE_DIAMETER_PT / 2.0

CENTER_X_PT = LETTER_WIDTH_PT / 2.0
CENTER_Y_PT = LETTER_HEIGHT_PT / 2.0

SECTIONS = [
    {
        "num": 1,
        "code": "SEC-01",
        "name": "SALIDA / START LINE",
        "url": "https://skyrace.app/sec/1"
    },
    {
        "num": 2,
        "code": "SEC-02",
        "name": "CURVA NORTE",
        "url": "https://skyrace.app/sec/2"
    },
    {
        "num": 3,
        "code": "SEC-03",
        "name": "RECTA PRINCIPAL",
        "url": "https://skyrace.app/sec/3"
    },
    {
        "num": 4,
        "code": "SEC-04",
        "name": "CHICANE OESTE",
        "url": "https://skyrace.app/sec/4"
    },
    {
        "num": 5,
        "code": "SEC-05",
        "name": "META / FINISH LINE",
        "url": "https://skyrace.app/sec/5"
    },
    {
        "num": 6,
        "code": "SEC-06",
        "name": "ZONA PITS / BONUS",
        "url": "https://skyrace.app/sec/6"
    }
]

def create_qr_matrix_image(url, size_px=900):
    """Generates a high-resolution clean QR code matrix."""
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=20,
        border=2,
    )
    qr.add_data(url)
    qr.make(fit=True)
    
    matrix = qr.get_matrix()
    matrix_size = len(matrix)
    
    img = Image.new("RGBA", (size_px, size_px), (255, 255, 255, 0))
    draw = ImageDraw.Draw(img)
    
    cell_size = size_px / matrix_size
    padding = cell_size * 0.08
    
    for r in range(matrix_size):
        for c in range(matrix_size):
            if matrix[r][c]:
                x0 = c * cell_size + padding
                y0 = r * cell_size + padding
                x1 = (c + 1) * cell_size - padding
                y1 = (r + 1) * cell_size - padding
                
                is_finder = (r < 7 and c < 7) or (r < 7 and c >= matrix_size - 7) or (r >= matrix_size - 7 and c < 7)
                
                if is_finder:
                    draw.rectangle([x0, y0, x1, y1], fill=(11, 11, 13, 255))
                else:
                    draw.ellipse([x0, y0, x1, y1], fill=(11, 11, 13, 255))
                    
    return img

def create_circular_badge_png(sec, output_dir="public/qr"):
    """Generates 300 DPI high-res circular badge image, 100% inside 15cm circle."""
    os.makedirs(output_dir, exist_ok=True)
    
    DPI = 300
    SIZE_PX = int(round(150.0 / 25.4 * DPI)) # 1772 px
    CENTER_PX = SIZE_PX / 2.0
    
    img = Image.new("RGBA", (SIZE_PX, SIZE_PX), (255, 255, 255, 0))
    draw = ImageDraw.Draw(img)
    
    # Outer cut circle boundary (15.0 cm)
    draw.ellipse([0, 0, SIZE_PX-1, SIZE_PX-1], fill=(255, 255, 255, 255), outline=(210, 210, 210, 255), width=4)
    
    # Inner safe area border (13.8 cm radius ~ 50px margin from cut line)
    draw.ellipse([30, 30, SIZE_PX-30, SIZE_PX-30], fill=(255, 255, 255, 255), outline=(255, 151, 0, 255), width=6)
    
    # Load fonts
    try:
        font_header = ImageFont.truetype("arialbd.ttf", int(SIZE_PX * 0.028)) # ~50px
        font_sec_badge = ImageFont.truetype("arialbd.ttf", int(SIZE_PX * 0.050)) # ~88px
        font_sec_name = ImageFont.truetype("arialbd.ttf", int(SIZE_PX * 0.038)) # ~67px
        font_url = ImageFont.truetype("arial.ttf", int(SIZE_PX * 0.026)) # ~46px
    except Exception:
        font_header = font_sec_badge = font_sec_name = font_url = ImageFont.load_default()
        
    # 1. Top Header (inside circle): "SKYRACE · RACE CONTROL"
    header_text = "SKYRACE · RACE CONTROL"
    bbox_h = draw.textbbox((0, 0), header_text, font=font_header)
    w_h = bbox_h[2] - bbox_h[0]
    draw.text((CENTER_PX - w_h/2, SIZE_PX * 0.075), header_text, fill=(100, 100, 100, 255), font=font_header)
    
    # 2. Section Pill Badge (e.g. "SECCIÓN 01")
    sec_pill_text = f"SECCIÓN 0{sec['num']}"
    bbox_sp = draw.textbbox((0, 0), sec_pill_text, font=font_sec_badge)
    w_sp = bbox_sp[2] - bbox_sp[0]
    h_sp = bbox_sp[3] - bbox_sp[1]
    
    pill_w = w_sp + int(SIZE_PX * 0.08)
    pill_h = h_sp + int(SIZE_PX * 0.035)
    pill_x0 = int(CENTER_PX - pill_w / 2)
    pill_y0 = int(SIZE_PX * 0.135)
    pill_x1 = pill_x0 + pill_w
    pill_y1 = pill_y0 + pill_h
    
    draw.rounded_rectangle([pill_x0, pill_y0, pill_x1, pill_y1], radius=int(pill_h/2), fill=(11, 11, 13, 255))
    draw.text((CENTER_PX - w_sp/2, pill_y0 + (pill_h - h_sp)/2 - 3), sec_pill_text, fill=(255, 151, 0, 255), font=font_sec_badge)
    
    # 3. Section Sub-name (e.g. "SALIDA / START LINE")
    sec_name = sec["name"]
    bbox_sn = draw.textbbox((0, 0), sec_name, font=font_sec_name)
    w_sn = bbox_sn[2] - bbox_sn[0]
    draw.text((CENTER_PX - w_sn/2, SIZE_PX * 0.22), sec_name, fill=(20, 20, 20, 255), font=font_sec_name)
    
    # 4. QR Code in center
    qr_size_px = int(SIZE_PX * 0.50) # ~886 px
    qr_img = create_qr_matrix_image(sec["url"], size_px=qr_size_px)
    
    qr_x = int(CENTER_PX - qr_size_px / 2)
    qr_y = int(SIZE_PX * 0.29)
    
    # White background square behind QR with border
    qr_bg_pad = int(qr_size_px * 0.05)
    qr_bg = [qr_x - qr_bg_pad, qr_y - qr_bg_pad, qr_x + qr_size_px + qr_bg_pad, qr_y + qr_size_px + qr_bg_pad]
    draw.rounded_rectangle(qr_bg, radius=24, fill=(255, 255, 255, 255), outline=(220, 220, 220, 255), width=3)
    
    img.paste(qr_img, (qr_x, qr_y), qr_img)
    
    # 5. Bottom URL Badge (inside safe area)
    url_text = sec["url"]
    bbox_u = draw.textbbox((0, 0), url_text, font=font_url)
    w_u = bbox_u[2] - bbox_u[0]
    h_u = bbox_u[3] - bbox_u[1]
    
    url_pill_w = w_u + int(SIZE_PX * 0.06)
    url_pill_h = h_u + int(SIZE_PX * 0.025)
    url_pill_x0 = int(CENTER_PX - url_pill_w / 2)
    url_pill_y0 = int(SIZE_PX * 0.86)
    url_pill_x1 = url_pill_x0 + url_pill_w
    url_pill_y1 = url_pill_y0 + url_pill_h
    
    draw.rounded_rectangle([url_pill_x0, url_pill_y0, url_pill_x1, url_pill_y1], radius=int(url_pill_h/2), fill=(245, 245, 248, 255), outline=(210, 210, 210, 255), width=2)
    draw.text((CENTER_PX - w_u/2, url_pill_y0 + (url_pill_h - h_u)/2 - 2), url_text, fill=(70, 70, 70, 255), font=font_url)
    
    filepath = os.path.join(output_dir, f"qr_sec_{sec['num']}.png")
    img.save(filepath, "PNG")
    print(f"Saved PNG: {filepath}")
    return filepath

def generate_pdf_document(png_paths, pdf_filename="public/qr/qr_codes_15cm_carta.pdf"):
    """Creates a 6-page printable PDF on Letter paper with exact 15 cm circular badges."""
    c = canvas.Canvas(pdf_filename, pagesize=letter)
    
    for i, sec in enumerate(SECTIONS):
        png_path = png_paths[i]
        
        c.saveState()
        cx = LETTER_WIDTH_PT / 2.0
        cy = LETTER_HEIGHT_PT / 2.0
        
        d_pt = BADGE_DIAMETER_PT
        r_pt = BADGE_RADIUS_PT
        
        x0 = cx - r_pt
        y0 = cy - r_pt
        
        # Draw 15 cm Image centered
        c.drawImage(png_path, x0, y0, width=d_pt, height=d_pt, mask='auto')
        
        # Dotted scissor cut line exactly at 15.0 cm diameter
        c.setStrokeColor(colors.HexColor("#666666"))
        c.setLineWidth(1.2)
        c.setDash(4, 4)
        c.circle(cx, cy, r_pt)
        
        # Scissors icon and instruction text above cut line
        c.setDash()
        c.setFont("Helvetica-Bold", 10)
        c.setFillColor(colors.HexColor("#333333"))
        c.drawCentredString(cx, cy + r_pt + 16, "✂  LÍNEA DE CORTE - DIÁMETRO EXACTO: 15.0 CM (150 MM)")
        
        # Footer scale verification
        c.setFont("Helvetica", 8)
        c.setFillColor(colors.HexColor("#666666"))
        c.drawCentredString(cx, 42, "Imprimir en tamaño Real / Escala 100% (Sin ajustar a la página / No scale)")
        c.drawCentredString(cx, 30, f"SkyRace Control · Sección 0{sec['num']}: {sec['name']} · Página {i+1} de 6")
        
        rule_w = 50 * MM_TO_PT # 5.0 cm
        rule_x0 = cx - rule_w / 2.0
        rule_y = 54
        c.setLineWidth(1)
        c.setStrokeColor(colors.HexColor("#111111"))
        c.line(rule_x0, rule_y, rule_x0 + rule_w, rule_y)
        c.line(rule_x0, rule_y - 4, rule_x0, rule_y + 4)
        c.line(rule_x0 + rule_w, rule_y - 4, rule_x0 + rule_w, rule_y + 4)
        c.setFont("Helvetica-Bold", 7)
        c.drawCentredString(cx, rule_y + 6, "VERIFICACIÓN DE ESCALA: 5.0 CM EXACTOS")
        
        c.showPage()
        
    c.save()
    print(f"Generated printable PDF: {pdf_filename}")

if __name__ == "__main__":
    os.makedirs("public/qr", exist_ok=True)
    png_paths = []
    for sec in SECTIONS:
        path = create_circular_badge_png(sec, output_dir="public/qr")
        png_paths.append(path)
        
    generate_pdf_document(png_paths, "public/qr/qr_codes_15cm_carta.pdf")
