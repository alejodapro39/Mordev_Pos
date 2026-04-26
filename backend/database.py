import os
import uuid
from datetime import datetime, timezone
from werkzeug.security import generate_password_hash, check_password_hash
from supabase import create_client, Client
import openpyxl
try:
    from dotenv import load_dotenv
    load_dotenv()
except: pass

# ── Conexión a Supabase ────────────────────────────────────────────────────────
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://rrfkqqvdzslyufqxuome.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")

def get_client() -> Client:
    if not SUPABASE_KEY:
        raise ValueError("SUPABASE_KEY no configurada en variables de entorno")
    return create_client(SUPABASE_URL, SUPABASE_KEY)

# ── REGISTRO Y NEGOCIOS (Multi-tenant SaaS) ────────────────────────────────────

def registrar_nuevo_negocio(nombre_negocio, email, password):
    """
    Crea un nuevo negocio (tenant), le asigna 30 días de prueba, y crea su primer usuario (admin).
    """
    client = get_client()
    try:
        # 1. Verificar si el email ya existe
        existing_negocio = client.table("negocios").select("id").eq("email", email).maybe_single().execute()
        if existing_negocio and hasattr(existing_negocio, 'data') and existing_negocio.data:
            return {"error": "Ya existe un negocio registrado con este correo."}

        # 2. Crear ID único para el negocio (tenant ID)
        id_negocio = str(uuid.uuid4())

        # Calcular vencimiento (30 días)
        from datetime import timedelta
        vencimiento = datetime.now(timezone.utc) + timedelta(days=30)

        # 3. Insertar el negocio
        client.table("negocios").insert({
            "id": id_negocio,
            "nombre_negocio": nombre_negocio,
            "email": email,
            "licencia_activa": True,
            "fecha_vencimiento": vencimiento.isoformat()
        }).execute()

        # 4. Crear el usuario administrador para este negocio
        password_hash = generate_password_hash(password)
        res_user = client.table("users").insert({
            "id_negocio": id_negocio,
            "username": email, # Usamos el email como username inicial
            "password_hash": password_hash,
            "role": "admin"
        }).execute()

        user_id = None
        if res_user and hasattr(res_user, 'data') and res_user.data:
            user_id = res_user.data[0]['id']
        elif isinstance(res_user, list) and len(res_user) > 0:
            user_id = res_user[0]['id']
        elif isinstance(res_user, dict) and 'data' in res_user:
            user_id = res_user['data'][0]['id']
            
        return {"success": True, "id_negocio": id_negocio, "user_id": user_id}
    except Exception as e:
        return {"error": str(e)}

# ── Configuración (Settings por Negocio) ───────────────────────────────────────
def get_setting(business_id, key, default=None):
    try:
        client = get_client()
        res = client.table("app_settings").select("value").eq("id_negocio", business_id).eq("key", key).maybe_single().execute()
        return res.data['value'] if res.data else default
    except: return default

def set_setting(business_id, key, value):
    get_client().table("app_settings").upsert({
        "id_negocio": business_id,
        "key": key, 
        "value": str(value)
    }).execute()

# ── Usuarios ───────────────────────────────────────────────────────────────────
def get_user_by_username_and_business(username, business_id=None):
    client = get_client()
    query = client.table("users").select("*").eq("username", username)
    if business_id:
        query = query.eq("id_negocio", business_id)
    try:
        res = query.maybe_single().execute()
        return res.data if res and hasattr(res, 'data') else None
    except Exception as e:
        print(f"Error en get_user: {e}")
        return None

def get_all_users(business_id):
    return get_client().table("users").select("id, username, role, avatar_path, created_at").eq("id_negocio", business_id).execute().data

def create_user(business_id, username, password, role, avatar_path=''):
    client = get_client()
    password_hash = generate_password_hash(password)
    client.table("users").insert({
        "id_negocio": business_id,
        "username": username,
        "password_hash": password_hash,
        "role": role,
        "avatar_path": avatar_path
    }).execute()
    return {"success": True}

def delete_user(business_id, user_id):
    get_client().table("users").delete().eq("id_negocio", business_id).eq("id", user_id).execute()

def update_user_avatar(business_id, user_id, path):
    get_client().table("users").update({"avatar_path": path}).eq("id_negocio", business_id).eq("id", user_id).execute()

def update_user_password(business_id, user_id, password):
    hash = generate_password_hash(password)
    get_client().table("users").update({"password_hash": hash}).eq("id_negocio", business_id).eq("id", user_id).execute()

# ── Productos (Inventario) ─────────────────────────────────────────────────────
def get_all_products(business_id):
    client = get_client()
    res = client.table("products").select("*").eq("id_negocio", business_id).order("name").execute()
    return res.data if res.data else []

def get_product_by_id(business_id, product_id):
    client = get_client()
    res = client.table("products").select("*").eq("id_negocio", business_id).eq("id", product_id).maybe_single().execute()
    return res.data

def get_product_by_barcode(business_id, barcode):
    client = get_client()
    res = client.table("products").select("*").eq("id_negocio", business_id).or_(f"barcode.eq.{barcode},reference.eq.{barcode}").maybe_single().execute()
    return res.data

def add_product(business_id, name, category, price, stock, **kwargs):
    client = get_client()
    data = {
        "id_negocio": business_id,
        "name": name,
        "category": category,
        "sale_price": price,
        "price": price,
        "stock": stock,
        **{k: v for k, v in kwargs.items() if v is not None or k == "barcode"}
    }
    res = client.table("products").insert(data).execute()
    return res.data[0]['id']

def update_product(business_id, product_id, **kwargs):
    client = get_client()
    data = {k: v for k, v in kwargs.items() if v is not None or k == "barcode"}
    client.table("products").update(data).eq("id_negocio", business_id).eq("id", product_id).execute()

def delete_product(business_id, product_id):
    get_client().table("products").delete().eq("id_negocio", business_id).eq("id", product_id).execute()

def import_from_excel(business_id, filepath):
    try:
        wb = openpyxl.load_workbook(filepath)
        ws = wb.active
        count = 0
        for row in ws.iter_rows(min_row=2, values_only=True):
            if row[0]:
                add_product(business_id, name=row[0], category=row[1] or '', price=row[2] or 0, stock=row[3] or 0)
                count += 1
        return {"success": True, "count": count}
    except Exception as e:
        return {"error": str(e)}

# ── Clientes ───────────────────────────────────────────────────────────────────
def get_all_customers(business_id):
    return get_client().table("customers").select("*").eq("id_negocio", business_id).order("name").execute().data or []

def get_customer_by_nid(business_id, nid):
    return get_client().table("customers").select("*").eq("id_negocio", business_id).eq("nid", nid).maybe_single().execute().data

def create_customer(business_id, name, **kwargs):
    client = get_client()
    data = {"id_negocio": business_id, "name": name, **{k: v for k, v in kwargs.items() if v is not None}}
    try:
        res = client.table("customers").insert(data).execute()
        return {"success": True, "id": res.data[0]['id']}
    except Exception as e:
        return {"error": str(e)}

# ── Ventas y Facturación ───────────────────────────────────────────────────────
def create_invoice(business_id, items, customer_data, payment_info, seller_id, draft_id=None):
    client = get_client()
    try:
        seller = client.table("users").select("username").eq("id_negocio", business_id).eq("id", seller_id).single().execute().data
        inv_data = {
            "id_negocio": business_id,
            "customer_id": customer_data.get('id'),
            "customer_name": customer_data.get('name'),
            "customer_address": customer_data.get('address'),
            "customer_phone": customer_data.get('phone'),
            "customer_nid": customer_data.get('nid'),
            "subtotal": payment_info['subtotal'],
            "abonos": payment_info.get('abonos', 0),
            "saldo": payment_info.get('saldo', 0),
            "total": payment_info['total'],
            "payment_method": payment_info.get('payment_method', 'Contado'),
            "seller_id": seller_id,
            "seller_name": seller['username']
        }
        invoice_id = client.table("invoices").insert(inv_data).execute().data[0]['id']

        for item in items:
            prod = get_product_by_id(business_id, item['product_id'])
            unit_price = float(item.get('unit_price', item.get('price', 0)))
            total = float(item.get('total', unit_price * float(item['quantity'])))
            
            client.table("sales").insert({
                "id_negocio": business_id,
                "invoice_id": invoice_id,
                "product_id": item['product_id'],
                "product_name": prod['name'],
                "quantity": item['quantity'],
                "unit_price": unit_price,
                "purchase_unit_price": prod.get('purchase_price', 0),
                "total": total,
                "seller_id": seller_id,
                "seller_name": seller['username']
            }).execute()
            nuevo_stock = float(prod['stock']) - float(item['quantity'])
            update_product(business_id, item['product_id'], stock=nuevo_stock)

        if draft_id: delete_draft(business_id, draft_id)
        return {"success": True, "invoice_id": invoice_id}
    except Exception as e:
        return {"error": str(e)}

def register_sale(business_id, product_id, quantity, seller_id):
    client = get_client()
    try:
        prod = get_product_by_id(business_id, product_id)
        seller = client.table("users").select("username").eq("id_negocio", business_id).eq("id", seller_id).single().execute().data
        
        unit_price = float(prod.get('sale_price') or prod.get('price', 0))
        total = unit_price * float(quantity)
        
        data = {
            "id_negocio": business_id,
            "product_id": product_id,
            "product_name": prod['name'],
            "quantity": quantity,
            "unit_price": unit_price,
            "purchase_unit_price": prod.get('purchase_price', 0),
            "total": total,
            "seller_id": seller_id,
            "seller_name": seller['username']
        }
        res = client.table("sales").insert(data).execute()
        
        # Update stock
        nuevo_stock = float(prod['stock']) - float(quantity)
        update_product(business_id, product_id, stock=nuevo_stock)
        
        return {"success": True, "sale_id": res.data[0]['id']}
    except Exception as e:
        return {"error": str(e)}

def delete_invoice(business_id, invoice_id):
    try:
        get_client().table("invoices").delete().eq("id_negocio", business_id).eq("id", invoice_id).execute()
        return {"success": True}
    except Exception as e:
        return {"error": str(e)}

def get_invoice_details(business_id, invoice_id):
    client = get_client()
    inv = client.table("invoices").select("*").eq("id_negocio", business_id).eq("id", invoice_id).maybe_single().execute().data
    if inv:
        inv['items'] = client.table("sales").select("*").eq("id_negocio", business_id).eq("invoice_id", invoice_id).execute().data
    return inv

# ── Borradores (Drafts) ────────────────────────────────────────────────────────
def save_draft(business_id, items, customer_data, payment_info, seller_id, draft_id=None):
    client = get_client()
    data = {
        "id_negocio": business_id,
        "customer_name": customer_data.get('name'),
        "customer_nid": customer_data.get('nid'),
        "subtotal": payment_info['subtotal'],
        "total": payment_info['total'],
        "seller_id": seller_id
    }
    if draft_id:
        client.table("draft_invoices").update(data).eq("id_negocio", business_id).eq("id", draft_id).execute()
    else:
        res = client.table("draft_invoices").insert(data).execute()
        draft_id = res.data[0]['id']
    
    client.table("draft_invoice_items").delete().eq("draft_id", draft_id).execute()
    for item in items:
        unit_price = float(item.get('unit_price', item.get('price', 0)))
        total = float(item.get('total', unit_price * float(item['quantity'])))
        client.table("draft_invoice_items").insert({
            "draft_id": draft_id, "product_id": item['product_id'],
            "quantity": item['quantity'], 
            "unit_price": unit_price, 
            "total": total
        }).execute()
    return {"success": True, "draft_id": draft_id}

def get_all_drafts(business_id, seller_id=None):
    client = get_client()
    q = client.table("draft_invoices").select("*").eq("id_negocio", business_id).order("date", desc=True)
    if seller_id: q = q.eq("seller_id", seller_id)
    return q.execute().data

def get_draft_details(business_id, draft_id):
    client = get_client()
    draft = client.table("draft_invoices").select("*").eq("id_negocio", business_id).eq("id", draft_id).maybe_single().execute().data
    if draft:
        draft['items'] = client.table("draft_invoice_items").select("*").eq("draft_id", draft_id).execute().data
    return draft

def delete_draft(business_id, draft_id):
    try:
        get_client().table("draft_invoices").delete().eq("id_negocio", business_id).eq("id", draft_id).execute()
        return {"success": True}
    except Exception as e:
        return {"error": str(e)}

# ── Reportes ───────────────────────────────────────────────────────────────────
def get_sales(business_id, seller_id=None):
    client = get_client()
    q = client.table("sales").select("*").eq("id_negocio", business_id).order("date", desc=True)
    if seller_id: q = q.eq("seller_id", seller_id)
    return q.execute().data

def get_sales_by_date_range(business_id, start, end):
    # Asegurar que el rango cubra todo el día final (hasta las 23:59:59)
    if len(end) == 10:  # Si solo viene YYYY-MM-DD
        end = f"{end}T23:59:59"
    return get_client().table("sales").select("*").eq("id_negocio", business_id).gte("date", start).lte("date", end).order("date").execute().data

def delete_sale(business_id, sale_id):
    try:
        get_client().table("sales").delete().eq("id_negocio", business_id).eq("id", sale_id).execute()
        return {"success": True}
    except Exception as e:
        return {"error": str(e)}
