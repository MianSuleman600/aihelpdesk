"""Upload all Starbit docs to test the system."""
import asyncio
import httpx

FILES = [
    "starbit_account_guide.txt",
    "starbit_troubleshooting.txt",
    "starbit_it_policies.txt",
    "starbit_game_platform.txt",
]

async def upload():
    async with httpx.AsyncClient(timeout=180) as client:
        r = await client.post(
            "http://localhost:8001/api/v1/auth/login",
            data={"username": "admin@test.com", "password": "Admin123!"},
        )
        token = r.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        for fname in FILES:
            print(f"Uploading {fname}...", end=" ", flush=True)
            try:
                with open(fname, "rb") as f:
                    r = await client.post(
                        "http://localhost:8001/api/v1/documents/upload",
                        headers=headers,
                        files={"file": (fname, f, "text/plain")},
                    )
                data = r.json()
                d = data["document"]
                print(f'OK -> status={d["status"]} chunks={d["chunk_count"]}')
            except Exception as e:
                print(f"FAIL: {str(e)[:100]}")

if __name__ == "__main__":
    asyncio.run(upload())
