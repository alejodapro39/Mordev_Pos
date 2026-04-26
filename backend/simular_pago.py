import requests
import json

# Configuración
WEBHOOK_URL = "http://localhost:5000/webhook-pagos"
# ID de tu negocio (puedes verlo en la URL del navegador o en la tabla negocios de Supabase)
# Si no lo sabes, intenta con el que tengas activo en tu sesión.
ID_NEGOCIO = input("Introduce el ID del negocio para la prueba (ej: 123e4567-e89b...): ")

payload = {
    "type": "payment",
    "data": {
        "id": "1234567890" # Un ID ficticio
    }
}

print(f"\n--- Simulando pago para el negocio: {ID_NEGOCIO} ---")
print(f"Enviando notificación a {WEBHOOK_URL}...")

try:
    # Enviamos el external_reference en la URL para simular lo que haría MP si no consultamos el SDK
    # Nota: Para que esta prueba funcione sin una API real de MP, 
    # he preparado una pequeña modificación en app.py que acepta pruebas.
    response = requests.post(
        f"{WEBHOOK_URL}?test=true&external_reference={ID_NEGOCIO}", 
        json=payload
    )
    
    if response.status_code == 200:
        print("\n[ÉXITO] Notificación enviada correctamente.")
        print("Revisa la consola del servidor (app.py) para ver si apareción el mensaje de confirmación.")
    else:
        print(f"\n[ERROR] El servidor respondió con status {response.status_code}")
        print(response.text)

except Exception as e:
    print(f"\n[ERROR] No se pudo conectar con el servidor: {e}")
