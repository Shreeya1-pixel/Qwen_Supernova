# Deploy configs

| File | Use |
|---|---|
| [`../render.yaml`](../render.yaml) | **Default.** One Docker service (UI + API). Free-tier friendly. |
| [`../Dockerfile`](../Dockerfile) | Image used by the default blueprint / “Docker” Web Service. |
| [`render.split.yaml`](render.split.yaml) | Optional: separate API + Next.js services (uses 2× free hours). |
| [`../DEPLOY_RENDER.md`](../DEPLOY_RENDER.md) | Step-by-step Render guide. |

**Judges / demo:** prefer the single Docker URL (what `qwen-supernova-2.onrender.com` uses).
