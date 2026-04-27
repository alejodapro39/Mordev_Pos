import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

URL = os.environ.get("SUPABASE_URL")
KEY = os.environ.get("SUPABASE_KEY")

print(f"Testing connection to {URL}")
try:
    client = create_client(URL, KEY)
    # Intenta listar las tablas o hacer un select simple
    res = client.table("negocios").select("count", count="exact").limit(1).execute()
    print("Connection successful!")
    print(f"Negocios count: {res.count}")
except Exception as e:
    print(f"Connection failed: {e}")
