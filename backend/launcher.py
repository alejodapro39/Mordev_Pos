import os
import sys
import webbrowser
from threading import Timer

# Determinar la ruta base (si es un ejecutable o script normal)
if getattr(sys, 'frozen', False):
    # Si se está ejecutando en un paquete de PyInstaller
    base_dir = sys._MEIPASS
else:
    # Si se está ejecutando como un script normal
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Cambiar al directorio donde está el launcher para que las bases de datos locales se guarden allí
# y no en la carpeta temporal de PyInstaller
if getattr(sys, 'frozen', False):
    os.chdir(os.path.dirname(sys.executable))
else:
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

# Importar app después de ajustar el entorno
from app import app

def open_browser():
    webbrowser.open_new('http://127.0.0.1:5000/')

if __name__ == '__main__':
    # Inicializar base de datos
    from database import init_db, create_default_admin
    init_db()
    create_default_admin()

    # Abrir el navegador automáticamente después de 1.5 segundos
    Timer(1.5, open_browser).start()
    
    print("\n🚀 Iniciando aplicación...")
    print(f"📁 Datos guardados en: {os.getcwd()}")
    print("Si el navegador no se abre automáticamente, visita: http://localhost:5000\n")
    
    # Iniciar Flask (sin modo debug para el ejecutable final)
    app.run(host='0.0.0.0', port=5000, debug=False)
