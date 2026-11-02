# Deploy NABD Orbit on Render

## Recommended: one Docker service (free tier)

One URL, no CORS, fits in **750 free hours/month**.

1. [Render Dashboard](https://dashboard.render.com) → **New +** → **Web Service**
2. Connect `Shreeya1-pixel/Qwen_Supernova`, branch `main`
3. **Runtime:** Docker  
4. **Dockerfile path:** `./Dockerfile`  
5. **Health check:** `/api/health`  
6. **Plan:** Free  
7. Env (optional): `NABD_CORS=*`, `GEMINI_API_KEY=…`

Or **New + → Blueprint** — Render reads root [`render.yaml`](render.yaml) (same Docker setup).

After deploy: open `https://YOUR-service.onrender.com/orbit`  
Cold start can take ~1 minute on free tier. Weather uses Open-Meteo; if rate-limited, the API falls back to cached/synthetic frames so Overview still renders.

---

## Optional: split API + frontend

Uses **two** free services (~2× hours). Blueprint file:

[`deploy/render.split.yaml`](deploy/render.split.yaml)

Copy it to `render.yaml` only if you intentionally want two services, or paste its contents into a Blueprint manually.

Manual setup:

| | Backend | Frontend |
|---|---|---|
| Root dir | `backend` | `frontend` |
| Build | `pip install -r requirements.txt` | `npm install && npm run build` |
| Start | `uvicorn nabd.main:app --host 0.0.0.0 --port $PORT` | `npm run start` |
| Health | `/api/health` | `/orbit` |
| Env | `NABD_CORS=*` | `NABD_BACKEND_URL=https://YOUR-API.onrender.com` · leave `NEXT_PUBLIC_NABD_API` empty so the UI uses `/api` via Next rewrites |

---

## Verify

```bash
curl -s https://YOUR-service.onrender.com/api/health
curl -s https://YOUR-service.onrender.com/api/sites/dubai-south | head -c 200
```

UI: `/` Overview · `/orbit` Theme 04 · `/alerts` · `/messages`
