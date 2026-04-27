"""
email_service.py — Servicio de correo para Mordev POS
Usa Resend API para envíos transaccionales.
Configura RESEND_API_KEY y RESEND_FROM_EMAIL en tu .env
"""
import os
import requests

RESEND_API_KEY  = os.environ.get("RESEND_API_KEY", "")
RESEND_FROM     = os.environ.get("RESEND_FROM_EMAIL", "Mordev POS <noreply@mordev.co>")
APP_BASE_URL    = os.environ.get("APP_BASE_URL", "http://localhost:5000")


def _send(to: str, subject: str, html: str) -> dict:
    """Envía un correo via Resend API. Retorna dict con success o error."""
    if not RESEND_API_KEY:
        print("[EMAIL] RESEND_API_KEY no configurada — correo no enviado")
        return {"error": "RESEND_API_KEY no configurada"}

    payload = {
        "from": RESEND_FROM,
        "to":   [to],
        "subject": subject,
        "html": html,
    }
    try:
        resp = requests.post(
            "https://api.resend.com/emails",
            json=payload,
            headers={
                "Authorization": f"Bearer {RESEND_API_KEY}",
                "Content-Type":  "application/json",
            },
            timeout=10,
        )
        if resp.status_code in (200, 201):
            print(f"[EMAIL] Enviado a {to} ✓")
            return {"success": True, "id": resp.json().get("id")}
        else:
            print(f"[EMAIL] Error {resp.status_code}: {resp.text}")
            return {"error": resp.text}
    except Exception as e:
        print(f"[EMAIL] Excepción: {e}")
        return {"error": str(e)}


# ─────────────────────────────────────────────────────────────────────────────
# Template base compartida
# ─────────────────────────────────────────────────────────────────────────────
def _base_template(content_html: str) -> str:
    return f"""
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Mordev POS</title>
</head>
<body style="margin:0;padding:0;background:#0A0B0F;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0B0F;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="580" cellpadding="0" cellspacing="0"
               style="background:#12131A;border-radius:20px;overflow:hidden;
                      border:1px solid rgba(0,200,255,0.15);
                      box-shadow:0 20px 60px rgba(0,0,0,0.6);">

          <!-- HEADER CON LOGO -->
          <tr>
            <td style="background:linear-gradient(135deg,#0A0B0F 0%,#12131A 100%);
                       padding:40px 40px 30px;text-align:center;
                       border-bottom:1px solid rgba(0,200,255,0.1);">
              <!-- Logo SVG "M" azul -->
              <div style="display:inline-flex;align-items:center;justify-content:center;
                          width:72px;height:72px;background:linear-gradient(135deg,#00C8FF,#0066FF);
                          border-radius:18px;margin-bottom:20px;
                          box-shadow:0 0 30px rgba(0,200,255,0.4);">
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                  <path d="M6 32V8l14 16L34 8v24" stroke="white" stroke-width="4"
                        stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
              <div style="font-size:26px;font-weight:800;color:#FFFFFF;letter-spacing:-0.5px;">
                Mordev <span style="color:#00C8FF;">POS</span>
              </div>
              <div style="font-size:13px;color:rgba(255,255,255,0.4);margin-top:4px;">
                Sistema de Punto de Venta
              </div>
            </td>
          </tr>

          <!-- CONTENIDO DINÁMICO -->
          <tr>
            <td style="padding:40px;">
              {content_html}
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background:#0A0B0F;padding:24px 40px;text-align:center;
                       border-top:1px solid rgba(255,255,255,0.05);">
              <p style="color:rgba(255,255,255,0.3);font-size:12px;margin:0;">
                © 2026 Mordev POS · Este es un correo automático, no responder.<br>
                Si no solicitaste esto, ignora este mensaje.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""


# ─────────────────────────────────────────────────────────────────────────────
# EMAIL: Recuperación de contraseña
# ─────────────────────────────────────────────────────────────────────────────
def send_password_reset_email(to_email: str, nombre_negocio: str, reset_url: str) -> dict:
    """
    Envía el correo de recuperación de contraseña con link de reset.
    El link expira en 3 minutos (180 segundos).
    """
    content = f"""
    <h2 style="color:#FFFFFF;font-size:24px;font-weight:700;margin:0 0 12px;
               letter-spacing:-0.3px;">
      Restablece tu contraseña
    </h2>
    <p style="color:rgba(255,255,255,0.6);font-size:15px;line-height:1.7;margin:0 0 28px;">
      Hola, <strong style="color:#FFFFFF;">{nombre_negocio}</strong>.<br>
      Recibimos una solicitud para restablecer la contraseña de tu cuenta en
      <strong style="color:#00C8FF;">Mordev POS</strong>.
    </p>

    <!-- AVISO DE EXPIRACIÓN -->
    <div style="background:rgba(255,170,0,0.08);border:1px solid rgba(255,170,0,0.2);
                border-radius:12px;padding:16px 20px;margin-bottom:28px;">
      <p style="color:#FFAA00;font-size:13px;font-weight:600;margin:0;">
        ⏱ Este enlace expira en <strong>3 minutos</strong>.
      </p>
    </div>

    <!-- BOTÓN CTA -->
    <div style="text-align:center;margin:32px 0;">
      <a href="{reset_url}"
         style="display:inline-block;background:linear-gradient(135deg,#00C8FF,#0066FF);
                color:#FFFFFF;font-size:16px;font-weight:700;text-decoration:none;
                padding:16px 40px;border-radius:12px;letter-spacing:0.3px;
                box-shadow:0 8px 24px rgba(0,200,255,0.35);">
        🔑 Restablecer Contraseña
      </a>
    </div>

    <!-- LINK ALTERNATIVO -->
    <div style="background:rgba(255,255,255,0.04);border-radius:10px;
                padding:16px 20px;margin-top:24px;">
      <p style="color:rgba(255,255,255,0.4);font-size:12px;margin:0 0 8px;">
        ¿El botón no funciona? Copia y pega este enlace:
      </p>
      <p style="color:#00C8FF;font-size:12px;word-break:break-all;margin:0;">
        {reset_url}
      </p>
    </div>

    <p style="color:rgba(255,255,255,0.35);font-size:13px;margin-top:28px;
              padding-top:20px;border-top:1px solid rgba(255,255,255,0.06);">
      Si no solicitaste este cambio, puedes ignorar este correo. Tu contraseña
      actual seguirá siendo la misma.
    </p>
    """

    html = _base_template(content)
    return _send(
        to=to_email,
        subject="🔑 Restablece tu contraseña — Mordev POS",
        html=html,
    )


# ─────────────────────────────────────────────────────────────────────────────
# EMAIL: Bienvenida al registrarse (nuevo negocio)
# ─────────────────────────────────────────────────────────────────────────────
def send_welcome_email(to_email: str, nombre_negocio: str, categoria: str) -> dict:
    """Envía correo de bienvenida al registrar un nuevo negocio."""
    iconos = {
        "mascotas":   "🐾", "carros": "🚗",
        "comida":     "🍔", "tecnologia": "💻", "general": "🏪",
    }
    icono = iconos.get(categoria, "🏪")

    content = f"""
    <h2 style="color:#FFFFFF;font-size:24px;font-weight:700;margin:0 0 12px;">
      {icono} ¡Bienvenido a Mordev POS!
    </h2>
    <p style="color:rgba(255,255,255,0.6);font-size:15px;line-height:1.7;margin:0 0 28px;">
      Tu negocio <strong style="color:#00C8FF;">{nombre_negocio}</strong> ha sido
      registrado exitosamente. Tienes <strong style="color:#FFFFFF;">30 días de prueba gratis</strong>
      para explorar todo el sistema.
    </p>
    <div style="text-align:center;margin:32px 0;">
      <a href="{APP_BASE_URL}/pos"
         style="display:inline-block;background:linear-gradient(135deg,#00C8FF,#0066FF);
                color:#FFFFFF;font-size:16px;font-weight:700;text-decoration:none;
                padding:16px 40px;border-radius:12px;
                box-shadow:0 8px 24px rgba(0,200,255,0.35);">
        🚀 Ir a mi POS
      </a>
    </div>
    """
    html = _base_template(content)
    return _send(
        to=to_email,
        subject=f"🚀 ¡Bienvenido, {nombre_negocio}! Tu POS está listo",
        html=html,
    )
