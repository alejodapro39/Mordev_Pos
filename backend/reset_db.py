import os
import sys

# Agregar el directorio actual al path para poder importar database
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import database

def reset():
    print("🔄 Iniciando reseteo de base de datos...")
    
    # Ruta de la base de datos
    db_path = database.DB_PATH
    
    # Eliminar el archivo de la base de datos si existe
    if os.path.exists(db_path):
        os.remove(db_path)
        print(f"🗑️ Archivo de base de datos eliminado: {db_path}")
    
    # Re-inicializar la base de datos
    database.init_db()
    
    # Crear el administrador por defecto
    database.create_default_admin()
    
    print("✨ Base de datos reseteada con éxito. Solo queda el usuario 'admin'.")

if __name__ == "__main__":
    reset()
