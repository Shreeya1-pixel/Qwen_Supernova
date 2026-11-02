# Deploying Qwen_Supernova (NABD Orbit) on Render

This guide outlines how to deploy **NABD Orbit (Qwen_Supernova)** to [Render](https://render.com).

---

## Deployment Options at a Glance

| Approach | Best For | Services on Render | Free Tier Impact |
|---|---|---|---|
| **Option 1: Render Blueprint (`render.yaml`)** *(Recommended for microservices)* | Automated setup of separate backend & frontend services | 2 Web Services | Uses 2 × hours (suspends after ~15 days on free tier unless upgraded) |
| **Option 2: Single Unified Service (`Dockerfile`)** *(Recommended for free tier)* | Running full-stack UI + API under **1 single URL** | 1 Web Service | 100% fits within 750 free hours/month |
| **Option 3: Manual Deployment** | Full control via Render dashboard UI | 1 or 2 Services | Flexible |

---

## Option 1: One-Click Render Blueprint (Automated)

Render Blueprints deploy both the **Python FastAPI Backend** and the **Next.js Frontend** automatically using the included `render.yaml`.

1. Push this repository to your GitHub account:
   ```bash
   git add .
   git commit -m "feat: make deployment ready for Render"
   git push origin main
   ```
2. Log into [Render Dashboard](https://dashboard.render.com).
3. Click **New +** → **Blueprint**.
4. Connect your `Qwen_Supernova` repository.
5. Render will automatically detect `render.yaml` and configure:
   - **`qwen-supernova-api`**: Python 3.11 Web Service running on `uvicorn`.
   - **`qwen-supernova-frontend`**: Node 20 Web Service running Next.js.
6. Under Environment Variables, provide any optional API keys (e.g. `GEMINI_API_KEY`), or leave them blank to use mock/dry-run mode.
7. Click **Apply**. Render will build and deploy both services!

---

## Option 2: Unified Full-Stack Container (Free Tier Friendly)

Render's free tier provides 750 free instance hours per month. Running two web services continuously consumes ~1,488 hours. By using the included multi-stage `Dockerfile`, both the **Next.js frontend** and the **FastAPI backend** run inside **one single container**:

- **No CORS issues** (frontend and backend share the exact same domain).
- **Single URL** for judges and users (e.g., `https://qwen-supernova.onrender.com`).
- **100% Free** (1 service × 24h × 31 days = 744 hours ≤ 750 free hours).

### Steps:
1. In Render Dashboard, click **New +** → **Web Service**.
2. Connect your Git repository.
3. Select **Docker** as the Runtime.
4. Set:
   - **Name**: `qwen-supernova`
   - **Region**: Any (e.g., Oregon or Frankfurt)
   - **Branch**: `main`
   - **Plan**: `Free`
   - **Health Check Path**: `/api/health`
5. *(Optional)* Add environment variables under **Environment**:
   - `GEMINI_API_KEY`: *(Your Google AI Studio API key)*
   - `NABD_CORS`: `*`
6. Click **Deploy Web Service**.

Once built, visiting your Render URL will load the full NABD Orbit UI (`/orbit`, `/alerts`, `/messages`, etc.) with the API running on `/api`.

---

## Option 3: Manual Dashboard Setup (Separate Services)

If you prefer to configure each service manually in the Render dashboard:

### Service 1: Backend API (FastAPI)
1. In Render, click **New +** → **Web Service**.
2. Select your repository.
3. Configure:
   - **Name**: `qwen-supernova-api`
   - **Root Directory**: `backend`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn nabd.main:app --host 0.0.0.0 --port $PORT`
   - **Health Check Path**: `/api/health`
4. Environment Variables:
   - `PYTHON_VERSION`: `3.11.10`
   - `NABD_CORS`: `*` (or your frontend URL)
   - *(Optional)* `GEMINI_API_KEY`
5. Click **Create Web Service**. Note the deployed URL (e.g., `https://qwen-supernova-api.onrender.com`).

### Service 2: Frontend UI (Next.js)
1. In Render, click **New +** → **Web Service**.
2. Select the same repository.
3. Configure:
   - **Name**: `qwen-supernova-frontend`
   - **Root Directory**: `frontend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`
   - **Health Check Path**: `/orbit`
4. Environment Variables:
   - `NODE_VERSION`: `20.18.0`
   - `NABD_BACKEND_URL`: `https://qwen-supernova-api.onrender.com`
   - `NEXT_PUBLIC_NABD_API`: `https://qwen-supernova-api.onrender.com/api`
5. Click **Create Web Service**.

---

## Environment Variables Reference

| Variable | Required? | Description |
|---|---|---|
| `PORT` | Auto-set by Render | Port the application listens on (Render automatically provides this). |
| `PYTHON_VERSION` | Recommended (`3.11.10`) | Ensures Python 3.11 runtime on Render. |
| `NODE_VERSION` | Recommended (`20.18.0`) | Ensures Node 20 runtime on Render. |
| `NABD_CORS` | Optional (default: `*`) | Comma-separated allowed CORS origins or `*` for all. |
| `NEXT_PUBLIC_NABD_API` | Optional | Backend API base URL for the frontend (e.g., `https://<api-url>/api`). |
| `NABD_BACKEND_URL` | Optional | Backend URL for Next.js server reverse-proxy rewrites. |
| `GEMINI_API_KEY` | Optional | Google Gemini API key for AI synthesis features. |
| `WHATSAPP_TOKEN` | Optional | Meta WhatsApp Cloud API access token. |
| `WHATSAPP_PHONE_NUMBER_ID`| Optional | Meta WhatsApp sender phone ID. |
| `WHATSAPP_TEST_TO` | Optional | Phone number to receive demo emergency alerts (format: `9715XXXXXXXX`). |
| `JIRA_BASE_URL` | Optional | Atlassian Jira Cloud instance URL. |
| `JIRA_USER_EMAIL` | Optional | Jira user email. |
| `JIRA_API_TOKEN` | Optional | Jira API token. |
| `JIRA_PROJECT_KEY` | Optional | Jira project key (e.g. `OPS`). |

---

## Post-Deployment Smoke Verification

After deployment, verify the services using `curl` or your browser:

```bash
# 1. Check API Health
curl -s https://<your-backend-or-unified-url>/api/health
# Expected: {"ok": true, "sites": [...], "gemini": false/true}

# 2. Check Orbit NASA GIBS API
curl -s https://<your-backend-or-unified-url>/api/orbit/nasa | head -c 120

# 3. Check Orbit Scenes (Sentinel / STAC)
curl -s https://<your-backend-or-unified-url>/api/orbit/scenes | head -c 120

# 4. Open in browser:
# https://<your-frontend-or-unified-url>/orbit
```

---

## Troubleshooting

- **502 Bad Gateway / Application failed to respond**:
  Ensure the service is binding to `0.0.0.0` and using `$PORT` (Render's internal port). The repository's start scripts already default to `0.0.0.0:$PORT`.
- **Render Free Tier Spin-Down**:
  On Render's free tier, Web Services sleep after 15 minutes without requests. The first request after sleep may take ~50 seconds to boot.
- **CORS Errors**:
  `NABD_CORS` defaults to `*` to allow seamless connections between frontend and backend. If you customized it, ensure your frontend URL (including `https://`) is present in `NABD_CORS`.
- **Turbopack Build Panic**:
  Next.js 16 build scripts in `package.json` are pre-configured with `--webpack` to avoid Turbopack memory panics with WebGL / MapLibre assets during deployment.
