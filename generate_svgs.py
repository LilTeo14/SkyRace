import os
import qrcode

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

def generate_section_svg(sec, output_dir="public/qr"):
    os.makedirs(output_dir, exist_ok=True)
    
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=1,
        border=2,
    )
    qr.add_data(sec["url"])
    qr.make(fit=True)
    matrix = qr.get_matrix()
    matrix_size = len(matrix)
    
    viewbox_size = 150.0
    center = viewbox_size / 2.0
    
    qr_display_size = 75.0  # 75 mm size
    cell_size = qr_display_size / matrix_size
    qr_x_start = center - qr_display_size / 2.0
    qr_y_start = 44.0  # mm from top
    
    modules_svg = []
    finders_svg = []
    
    for r in range(matrix_size):
        for c in range(matrix_size):
            if matrix[r][c]:
                is_finder = (r < 7 and c < 7) or (r < 7 and c >= matrix_size - 7) or (r >= matrix_size - 7 and c < 7)
                cx = qr_x_start + (c + 0.5) * cell_size
                cy = qr_y_start + (r + 0.5) * cell_size
                rad = cell_size * 0.42
                
                if is_finder:
                    x0 = qr_x_start + c * cell_size + cell_size * 0.05
                    y0 = qr_y_start + r * cell_size + cell_size * 0.05
                    w = cell_size * 0.90
                    finders_svg.append(f'<rect x="{x0:.3f}" y="{y0:.3f}" width="{w:.3f}" height="{w:.3f}" fill="#0b0b0d" />')
                else:
                    modules_svg.append(f'<circle cx="{cx:.3f}" cy="{cy:.3f}" r="{rad:.3f}" fill="#0b0b0d" />')
                    
    qr_bg_pad = 4.0
    qr_bg_w = qr_display_size + qr_bg_pad * 2
    qr_bg_x = qr_x_start - qr_bg_pad
    qr_bg_y = qr_y_start - qr_bg_pad
    
    svg_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="150mm" height="150mm" viewBox="0 0 150 150">
  <defs>
    <style>
      .cut-line {{ stroke: #cccccc; stroke-width: 0.5; fill: none; stroke-dasharray: 2,2; }}
      .accent-ring {{ stroke: #ff9700; stroke-width: 0.8; fill: #ffffff; }}
      .header-text {{ font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 4.2px; fill: #666666; font-weight: bold; letter-spacing: 0.5px; text-anchor: middle; }}
      .sec-badge-text {{ font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 7.5px; fill: #ff9700; font-weight: bold; text-anchor: middle; dominant-baseline: central; }}
      .sec-name-text {{ font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 5.5px; fill: #111111; font-weight: bold; text-anchor: middle; }}
      .url-text {{ font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 3.8px; fill: #555555; text-anchor: middle; dominant-baseline: central; }}
    </style>
  </defs>

  <!-- 15.0 cm Cut Line Guide -->
  <circle cx="75" cy="75" r="74.7" class="cut-line" />
  
  <!-- Safe Area Ring -->
  <circle cx="75" cy="75" r="72.0" class="accent-ring" />
  
  <!-- Top Header -->
  <text x="75" y="12" class="header-text">SKYRACE · RACE CONTROL</text>
  
  <!-- Section Pill -->
  <rect x="42.5" y="19" width="65" height="12" rx="6" fill="#0b0b0d" />
  <text x="75" y="25" class="sec-badge-text">SECCIÓN 0{sec['num']}</text>
  
  <!-- Section Name -->
  <text x="75" y="36" class="sec-name-text">{sec['name']}</text>
  
  <!-- QR Card Background -->
  <rect x="{qr_bg_x:.3f}" y="{qr_bg_y:.3f}" width="{qr_bg_w:.3f}" height="{qr_bg_w:.3f}" rx="3" fill="#ffffff" stroke="#e0e0e0" stroke-width="0.4" />
  
  <!-- QR Finder Patterns and Modules -->
  <g id="qr-finders">
    {''.join(finders_svg)}
  </g>
  <g id="qr-modules">
    {''.join(modules_svg)}
  </g>
  
  <!-- Bottom URL Pill -->
  <rect x="40" y="129" width="70" height="8" rx="4" fill="#f4f4f7" stroke="#d0d0d5" stroke-width="0.3" />
  <text x="75" y="133" class="url-text">{sec['url']}</text>
</svg>
"""
    filepath = os.path.join(output_dir, f"qr_sec_{sec['num']}.svg")
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(svg_content)
    print(f"Saved SVG: {filepath}")
    return filepath

if __name__ == "__main__":
    for sec in SECTIONS:
        generate_section_svg(sec, "public/qr")
