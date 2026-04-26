"""
supabase_license.py
===================
Módulo de gestión de licencias para Mordev POS (Multi-cliente).
Usa la tabla `negocios` en Supabase para validar la suscripción.
"""

import os
from datetime import datetime, timezone, timedelta
from flask import session

try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://rrfkqqvdzslyufqxuome.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")

def _get_client() -> "Client":
    if not SUPABASE_AVAILABLE:
        raise RuntimeError("La librería 'supabase' no está instalada.")
    if not SUPABASE_KEY:
        raise RuntimeError("La variable de entorno SUPABASE_KEY no está configurada.")
    return create_client(SUPABASE_URL, SUPABASE_KEY)

def get_license_info(business_id=None) -> dict:
    """
    Consulta la licencia en Supabase para el negocio actual.
    Retorna un dict con: activa, fecha_vencimiento, dias_restantes, error.
    """
    # Si no se provee business_id, intenta sacarlo de la sesión actual
    if not business_id:
        try:
            business_id = session.get('business_id')
        except:
            business_id = None
            
    if not business_id:
        return {"activa": False, "fecha_vencimiento": None, "dias_restantes": 0, "error": "Sin sesión"}

    try:
        client = _get_client()
        resp = client.table("negocios").select("licencia_activa, fecha_vencimiento").eq("id", business_id).maybe_single().execute()
        row = resp.data
        if not row:
            return {"activa": False, "fecha_vencimiento": None, "dias_restantes": 0, "error": "Negocio no encontrado"}

        fecha_venc = None
        dias_restantes = 0
        activa = bool(row.get("licencia_activa", False))

        if row.get("fecha_vencimiento"):
            try:
                fecha_venc = datetime.fromisoformat(row["fecha_vencimiento"].replace("Z", "+00:00"))
                ahora = datetime.now(timezone.utc)
                delta = fecha_venc - ahora
                dias_restantes = max(0, delta.days)
                if ahora > fecha_venc:
                    activa = False
            except Exception:
                activa = False

        return {
            "activa": activa,
            "fecha_vencimiento": fecha_venc,
            "dias_restantes": dias_restantes,
            "error": None,
        }

    except RuntimeError as e:
        return {"activa": True, "fecha_vencimiento": None, "dias_restantes": 999, "error": str(e)}
    except Exception as e:
        return {"activa": True, "fecha_vencimiento": None, "dias_restantes": 0, "error": str(e)}

def acumular_dias(business_id, dias: int = 30) -> dict:
    """Acumula días de licencia a un negocio."""
    if not business_id:
        return {"success": False, "error": "Falta ID del negocio"}
        
    try:
        client = _get_client()
        ahora = datetime.now(timezone.utc)
        resp = client.table("negocios").select("fecha_vencimiento").eq("id", business_id).maybe_single().execute()
        row = resp.data

        if not row:
            return {"success": False, "error": "Negocio no existe"}

        fecha_actual = row.get("fecha_vencimiento")
        if fecha_actual:
            try:
                fecha_dt = datetime.fromisoformat(fecha_actual.replace("Z", "+00:00"))
                base = fecha_dt if fecha_dt > ahora else ahora
            except Exception:
                base = ahora
        else:
            base = ahora

        nueva_fecha = base + timedelta(days=dias)
        client.table("negocios").update({
            "licencia_activa": True,
            "fecha_vencimiento": nueva_fecha.isoformat(),
        }).eq("id", business_id).execute()

        # Guardar en historial
        client.table("pagos_historial").insert({
            "id_negocio": business_id,
            "payment_id": f"manual_{int(ahora.timestamp())}",
            "status": "approved",
            "monto": 0,
            "dias_acumulados": dias
        }).execute()

        return {"success": True, "fecha_vencimiento": nueva_fecha.isoformat()}

    except Exception as e:
        return {"success": False, "error": str(e)}
