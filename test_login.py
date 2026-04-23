import urllib.request, json

data = json.dumps({"username": "admin", "password": "ChangeMe!2026"}).encode()
req = urllib.request.Request(
    "http://localhost/api/v1/auth/login",
    data=data,
    headers={"Content-Type": "application/json"}
)
resp = urllib.request.urlopen(req)
result = json.loads(resp.read().decode())
print("LOGIN OK")
print("accessToken (first 60 chars):", result.get("accessToken","")[:60])
print("expiresInSeconds:", result.get("expiresInSeconds"))

