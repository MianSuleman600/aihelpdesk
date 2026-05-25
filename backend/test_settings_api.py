"""Test all new settings endpoints."""
import asyncio
import httpx

async def test():
    base = 'http://localhost:8001/api/v1'
    async with httpx.AsyncClient() as c:
        r = await c.post(f'{base}/auth/login', data={'username': 'admin@test.com', 'password': 'Admin123!'})
        print(f'Login: {r.status_code}')
        if r.status_code != 200:
            print(f'  Body: {r.text}')
            return
        token = r.json()['access_token']
        h = {'Authorization': f'Bearer {token}'}
        print('1. Login OK')

        r = await c.get(f'{base}/settings', headers=h)
        print(f'GET /settings: {r.status_code} {r.text[:200]}')

        r = await c.patch(f'{base}/settings', headers=h, json={
            'notification_email': True, 'notification_browser': False,
            'notification_ticket_updates': True, 'theme': 'dark',
        })
        print(f'PATCH /settings: {r.status_code} {r.text[:200]}')

        r = await c.patch(f'{base}/auth/me', headers=h, json={'name': 'Admin Updated'})
        print(f'PATCH /auth/me: {r.status_code} {r.text[:200]}')

        r = await c.post(f'{base}/auth/change-password', headers=h, json={
            'old_password': 'wrongpass1!', 'new_password': 'NewPass123!',
        })
        print(f'POST change-pw (wrong): {r.status_code} {r.text[:200]}')

        r = await c.post(f'{base}/auth/change-password', headers=h, json={
            'old_password': 'Admin123!', 'new_password': 'NewPass123!',
        })
        print(f'POST change-pw (correct): {r.status_code} {r.text[:200]}')

        r = await c.post(f'{base}/auth/change-password', headers=h, json={
            'old_password': 'NewPass123!', 'new_password': 'Admin123!',
        })
        print(f'POST change-pw (revert): {r.status_code} {r.text[:200]}')

asyncio.run(test())
