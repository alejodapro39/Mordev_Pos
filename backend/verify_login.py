import http.client
import json

conn = http.client.HTTPConnection("localhost", 5000)
headers = {'Content-type': 'application/json'}
payload = json.dumps({"username": "admin", "password": "admin123"})
conn.request("POST", "/api/login", payload, headers)
response = conn.getresponse()
print(f"Status Code: {response.status}")
print(f"Response Body: {response.read().decode()}")
