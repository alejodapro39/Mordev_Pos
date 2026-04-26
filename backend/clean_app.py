import sys

filepath = r"c:\Users\david.pena_cabify\Documents\PRUEBAS_PERSO\PRUEBAS_PERSO\grocery-app\backend\app.py"

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("session.get('business_id'), session.get('business_id'), session.get('business_id')", "session.get('business_id')")
content = content.replace("session.get('business_id'), session.get('business_id')", "session.get('business_id')")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Hecho")
