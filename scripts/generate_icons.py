"""
Aether — Generador de Activos de Identidad e Iconografía
Variante B: La Órbita Trinitaria (Vapor, Líquido, Cristal)
"""

import math
import os
import sys

# Asegurar UTF-8 en stdout en Windows
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'public')
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Paleta Mineral Aether
COLOR_BASALT = (17, 18, 21)         # #111215
COLOR_GOLD = (217, 186, 133)         # #d9ba85
COLOR_GOLD_LIGHT = (245, 224, 166)   # #f5e0a6
COLOR_VAPOR = (184, 169, 201)        # #b8a9c9 (Lavanda Ópalo)
COLOR_VAPOR_LIGHT = (216, 203, 232)  # #d8cbe8
COLOR_LIQUID = (126, 168, 149)       # #7ea895 (Salvia Celadón)
COLOR_LIQUID_LIGHT = (164, 206, 190) # #a4cebe
COLOR_WHITE = (255, 255, 255)
COLOR_INK_MUTED = (155, 154, 149)    # #9b9a95
COLOR_INK_LIGHT = (232, 229, 222)    # #e8e5de

def create_triad_image(size, transparent=False, bg_color=COLOR_BASALT, glow=False, scale=0.72):
    """
    Dibuja la Órbita Trinitaria con supersampling 4x para un antialiasing perfecto.
    """
    scale_factor = 4
    w = size * scale_factor
    h = size * scale_factor
    
    if transparent:
        img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    else:
        img = Image.new('RGBA', (w, h), (*bg_color, 255))
        
    draw = ImageDraw.Draw(img)
    
    cx = w / 2
    cy = h / 2 + (h * 0.02)  # Corrección óptica sutil de centro de masas
    
    # Radio de la órbita
    r_orbit = (min(w, h) / 2) * scale * 0.88
    
    # 1. Resplandor ambiental de fondo si está activado
    if glow and not transparent:
        glow_layer = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        glow_draw = ImageDraw.Draw(glow_layer)
        glow_r = r_orbit * 1.35
        glow_draw.ellipse(
            [cx - glow_r, cy - glow_r, cx + glow_r, cy + glow_r],
            fill=(217, 186, 133, 28)
        )
        glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(radius=w * 0.08))
        img.alpha_composite(glow_layer)
        draw = ImageDraw.Draw(img)

    # Coordenadas de los 3 vértices
    # Vértice 1: Cristal (Arriba, 90° en círculo estándar -> y negativo)
    x_crystal = cx
    y_crystal = cy - r_orbit
    
    # Vértice 2: Vapor (Inferior Izquierda, 210° -> cos(210°)=-sqrt(3)/2, sin(210°)=-1/2)
    angle_vapor = math.radians(210)
    x_vapor = cx + r_orbit * math.cos(angle_vapor)
    y_vapor = cy - r_orbit * math.sin(angle_vapor)
    
    # Vértice 3: Líquido (Inferior Derecha, 330° -> cos(330°)=sqrt(3)/2, sin(330°)=-1/2)
    angle_liquid = math.radians(330)
    x_liquid = cx + r_orbit * math.cos(angle_liquid)
    y_liquid = cy - r_orbit * math.sin(angle_liquid)

    # 2. Órbita circular punteada (36 segmentos)
    orbit_width = max(2, int(w * 0.016))
    num_segments = 36
    for i in range(num_segments):
        if i % 2 == 0:
            a1 = (i / num_segments) * 360
            a2 = ((i + 0.65) / num_segments) * 360
            draw.arc(
                [cx - r_orbit, cy - r_orbit, cx + r_orbit, cy + r_orbit],
                start=a1, end=a2,
                fill=(*COLOR_GOLD, 110),
                width=orbit_width
            )

    # 3. Líneas de tensión armónica (Triángulo conector)
    tension_width = max(1, int(w * 0.01))
    draw.line([(x_crystal, y_crystal), (x_vapor, y_vapor)], fill=(255, 255, 255, 45), width=tension_width)
    draw.line([(x_vapor, y_vapor), (x_liquid, y_liquid)], fill=(255, 255, 255, 45), width=tension_width)
    draw.line([(x_liquid, y_liquid), (x_crystal, y_crystal)], fill=(255, 255, 255, 45), width=tension_width)

    # 4. Orbes de las 3 Fases
    # Radios relativos
    r_c = r_orbit * 0.38   # Cristal (ligeramente dominante)
    r_v = r_orbit * 0.32   # Vapor
    r_l = r_orbit * 0.32   # Líquido

    # Orbe Vapor (Lavanda)
    draw.ellipse([x_vapor - r_v, y_vapor - r_v, x_vapor + r_v, y_vapor + r_v], fill=(*COLOR_VAPOR, 255))
    draw.ellipse([x_vapor - r_v*0.6, y_vapor - r_v*0.6, x_vapor + r_v*0.6, y_vapor + r_v*0.6], fill=(*COLOR_VAPOR_LIGHT, 255))

    # Orbe Líquido (Salvia)
    draw.ellipse([x_liquid - r_l, y_liquid - r_l, x_liquid + r_l, y_liquid + r_l], fill=(*COLOR_LIQUID, 255))
    draw.ellipse([x_liquid - r_l*0.6, y_liquid - r_l*0.6, x_liquid + r_l*0.6, y_liquid + r_l*0.6], fill=(*COLOR_LIQUID_LIGHT, 255))

    # Orbe Cristal (Oro)
    draw.ellipse([x_crystal - r_c, y_crystal - r_c, x_crystal + r_c, y_crystal + r_c], fill=(*COLOR_GOLD, 255))
    draw.ellipse([x_crystal - r_c*0.65, y_crystal - r_c*0.65, x_crystal + r_c*0.65, y_crystal + r_c*0.65], fill=(*COLOR_GOLD_LIGHT, 255))
    # Núcleo blanco del cristal
    r_core = r_c * 0.3
    draw.ellipse([x_crystal - r_core, y_crystal - r_core, x_crystal + r_core, y_crystal + r_core], fill=(*COLOR_WHITE, 255))

    # Downsample suave con Lanczos
    return img.resize((size, size), Image.Resampling.LANCZOS)

def generate_icons():
    print("✦ Generando suite de iconos de Aether (Variante B: Órbita Trinitaria)...")

    # 1. Favicon PNGs
    f16 = create_triad_image(16, transparent=True, scale=0.88)
    f32 = create_triad_image(32, transparent=True, scale=0.88)
    f48 = create_triad_image(48, transparent=True, scale=0.85)

    f16.save(os.path.join(OUTPUT_DIR, 'favicon-16x16.png'))
    f32.save(os.path.join(OUTPUT_DIR, 'favicon-32x32.png'))

    # 2. Favicon ICO Multi-capa (16, 32, 48)
    ico_img = create_triad_image(48, transparent=True, scale=0.85)
    ico_img.save(
        os.path.join(OUTPUT_DIR, 'favicon.ico'),
        format='ICO',
        sizes=[(16, 16), (32, 32), (48, 48)],
        append_images=[f16, f32]
    )
    print("✓ favicon.ico generado (16x16, 32x32, 48x48)")

    # 3. Apple Touch Icon (180x180 px con squircle y sustrato basalto)
    apple_icon = create_triad_image(180, transparent=False, bg_color=COLOR_BASALT, glow=True, scale=0.74)
    apple_icon.save(os.path.join(OUTPUT_DIR, 'apple-touch-icon.png'))
    print("✓ apple-touch-icon.png generado (180x180)")

    # 4. PWA Icons (192x192 y 512x512)
    pwa_192 = create_triad_image(192, transparent=False, bg_color=COLOR_BASALT, glow=True, scale=0.72)
    pwa_192.save(os.path.join(OUTPUT_DIR, 'icon-192.png'))
    print("✓ icon-192.png generado (192x192)")

    pwa_512 = create_triad_image(512, transparent=False, bg_color=COLOR_BASALT, glow=True, scale=0.70)
    pwa_512.save(os.path.join(OUTPUT_DIR, 'icon-512.png'))
    print("✓ icon-512.png generado (512x512)")

def generate_og_image():
    """
    Genera una tarjeta Open Graph cinemática (1200x630) para compartir en redes.
    """
    print("✦ Generando banner social Open Graph (1200x630)...")
    w, h = 1200, 630
    img = Image.new('RGBA', (w, h), (*COLOR_BASALT, 255))
    draw = ImageDraw.Draw(img)

    # 1. Viñeta y halo de luz mineral difusa
    glow_left = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    g_draw = ImageDraw.Draw(glow_left)
    g_draw.ellipse([80, 100, 520, 540], fill=(217, 186, 133, 22))
    g_draw.ellipse([140, 160, 460, 480], fill=(126, 168, 149, 18))
    glow_left = glow_left.filter(ImageFilter.GaussianBlur(radius=75))
    img.alpha_composite(glow_left)
    draw = ImageDraw.Draw(img)

    # 2. Marco sutil perimetral
    draw.rectangle([24, 24, w - 24, h - 24], outline=(255, 255, 255, 18), width=1)
    draw.rectangle([28, 28, w - 28, h - 28], outline=(217, 186, 133, 30), width=1)

    # 3. Emblema de la Órbita Trinitaria en el tercio izquierdo (360x360)
    emblem = create_triad_image(360, transparent=True, scale=0.82)
    img.paste(emblem, (80, 135), emblem)

    # 4. Tipografía en el bloque derecho
    font_serif_path = "C:/Windows/Fonts/georgia.ttf"
    font_italic_path = "C:/Windows/Fonts/georgiai.ttf"
    font_sans_path = "C:/Windows/Fonts/segoeui.ttf"

    font_badge = ImageFont.truetype(font_sans_path, 13)
    font_title = ImageFont.truetype(font_serif_path, 72)
    font_subtitle = ImageFont.truetype(font_italic_path, 28)
    font_body = ImageFont.truetype(font_sans_path, 17)
    font_footer = ImageFont.truetype(font_sans_path, 13)

    x_text = 490

    # Badge de cabecera
    badge_text = "✦ SANTUARIO EDITORIAL · AWS ESPAÑA (EU-SOUTH-2)"
    draw.text((x_text, 145), badge_text, font=font_badge, fill=(*COLOR_GOLD, 220))

    # Título monolítico
    draw.text((x_text, 180), "A E T H E R", font=font_title, fill=COLOR_INK_LIGHT)

    # Subtítulo lírico
    draw.text((x_text, 280), "El Primer Editor de Texto Termodinámico", font=font_subtitle, fill=(*COLOR_GOLD_LIGHT, 240))

    # Párrafo descriptivo
    desc_line1 = "Escribe con foco monástico, custodia local-first y sincronización soberana."
    desc_line2 = "La materia del pensamiento estructurada en tres fases vivas:"
    draw.text((x_text, 335), desc_line1, font=font_body, fill=COLOR_INK_MUTED)
    draw.text((x_text, 365), desc_line2, font=font_body, fill=COLOR_INK_MUTED)

    # Cápsulas de las Tres Fases
    y_pills = 420
    # Vapor
    draw.ellipse([x_text, y_pills + 4, x_text + 12, y_pills + 16], fill=COLOR_VAPOR)
    draw.text((x_text + 20, y_pills), "VAPOR (Niebla)", font=font_badge, fill=(*COLOR_VAPOR_LIGHT, 230))
    # Líquido
    x_liq = x_text + 170
    draw.ellipse([x_liq, y_pills + 4, x_liq + 12, y_pills + 16], fill=COLOR_LIQUID)
    draw.text((x_liq + 20, y_pills), "LÍQUIDO (Flujo)", font=font_badge, fill=(*COLOR_LIQUID_LIGHT, 230))
    # Cristal
    x_cris = x_liq + 175
    draw.ellipse([x_cris, y_pills + 4, x_cris + 12, y_pills + 16], fill=COLOR_GOLD)
    draw.text((x_cris + 20, y_pills), "CRISTAL (Sólido)", font=font_badge, fill=(*COLOR_GOLD_LIGHT, 230))

    # Separador sutil
    draw.line([(x_text, 475), (w - 80, 475)], fill=(255, 255, 255, 25), width=1)

    # Footer
    draw.text((x_text, 495), "CIFRADO DE AUTOR · CERO RASTREO · SOBERANÍA TOTAL", font=font_footer, fill=(*COLOR_INK_MUTED, 180))

    og_path = os.path.join(OUTPUT_DIR, 'og-image.png')
    img.save(og_path, 'PNG')
    print("✓ og-image.png generado (1200x630)")

if __name__ == '__main__':
    generate_icons()
    generate_og_image()
    print("\n✦ Todos los activos del Paso 1 fueron fabricados con éxito en /public.")
