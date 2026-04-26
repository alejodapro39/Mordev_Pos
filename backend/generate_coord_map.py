
import io
import os
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.units import mm
from pypdf import PdfReader, PdfWriter

def generate_coord_map():
    template_path = r"c:\Users\alejo\Downloads\PRUEBAS_PERSO\formato_factura.pdf"
    output_path = r"c:\Users\alejo\Downloads\PRUEBAS_PERSO\guia_coordenadas.pdf"
    
    if not os.path.exists(template_path):
        print(f"Error: No se encontró el archivo {template_path}")
        return

    # 1. Crear el overlay con la cuadrícula
    packet = io.BytesIO()
    # Usamos A4 por defecto si no sabemos el tamaño exacto, o tratamos de leerlo
    reader = PdfReader(template_path)
    page = reader.pages[0]
    width = float(page.mediabox.width)
    height = float(page.mediabox.height)
    
    c = canvas.Canvas(packet, pagesize=(width, height))
    
    # Dibujar cuadrícula cada 10mm
    c.setStrokeColorRGB(0.8, 0.8, 0.8) # Gris claro
    c.setLineWidth(0.1)
    
    # Líneas verticales
    for x in range(0, int(width/mm) + 1, 10):
        c.line(x*mm, 0, x*mm, height)
        if x % 50 == 0:
            c.setFont("Helvetica", 8)
            c.drawString(x*mm + 2, 10, f"{x}mm")

    # Líneas horizontales
    for y in range(0, int(height/mm) + 1, 10):
        c.line(0, y*mm, width, y*mm)
        if y % 50 == 0:
            c.setFont("Helvetica", 8)
            c.drawString(10, y*mm + 2, f"{y}mm")
            
    # Dibujar puntos de referencia cada 50mm para mayor precisión
    c.setStrokeColorRGB(1, 0, 0) # Rojo
    c.setLineWidth(0.5)
    for x in range(50, int(width/mm), 50):
        for y in range(50, int(height/mm), 50):
            c.circle(x*mm, y*mm, 1*mm, fill=0)
            c.setFont("Helvetica-Bold", 6)
            c.drawString(x*mm + 1, y*mm + 1, f"({x},{y})")

    c.save()
    packet.seek(0)
    
    # 2. Mezclar el overlay con el template
    new_pdf = PdfReader(packet)
    template = PdfReader(open(template_path, "rb"))
    output = PdfWriter()
    
    template_page = template.pages[0]
    template_page.merge_page(new_pdf.pages[0])
    output.add_page(template_page)
    
    with open(output_path, "wb") as f:
        output.write(f)
    
    print(f"Guía de coordenadas generada exitosamente en: {output_path}")

if __name__ == "__main__":
    generate_coord_map()
