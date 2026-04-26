import sys
import os
import database

def change_admin_password(new_password):
    print(f"🔄 Intentando cambiar contraseña del usuario 'admin'...")
    
    user = database.get_user_by_username('admin')
    if not user:
        print("❌ Error: El usuario 'admin' no existe en la base de datos.")
        return

    result = database.update_user_password(user['id'], new_password)
    
    if result.get("success"):
        print(f"✅ ¡Éxito! La contraseña de 'admin' ha sido actualizada.")
        print(f"🔑 Nueva contraseña: {new_password}")
    else:
        print(f"❌ Error al actualizar la contraseña: {result.get('error')}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python change_admin_password.py <nueva_contraseña>")
    else:
        new_pwd = sys.argv[1]
        change_admin_password(new_pwd)
