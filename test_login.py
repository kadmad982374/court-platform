import urllib.request, json

data = json.dumps({"username": "section_fi_dam", "password": "ChangeMe!2026"}).encode()
req = urllib.request.Request(
    "http://178.104.171.3/api/v1/auth/login",
    data=data,
    headers={"Content-Type": "application/json"}
)
resp = urllib.request.urlopen(req)
result = json.loads(resp.read().decode())
print("LOGIN OK")
print("username:         section_fi_dam")
print("accessToken:     ", result.get("accessToken","")[:80])
print("expiresInSeconds:", result.get("expiresInSeconds"))



