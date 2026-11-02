# Supernova × SpacePoint · Theme 04

Right now, a satellite is crossing the UAE. It sees clouds over the Hajar, ships in Hormuz, cities spreading into the sand. Most of it goes unused.

**NABD Orbit** turns that pass into a first-responder flood + damage view for **April 2024**.

## First Responders from Orbit · Disaster response

1. Map floods within hours, not days.  
2. Assess damage to roads and buildings.  
3. Learn from the April 2024 UAE floods.

**Data:** Sentinel-1 radar · Sentinel-2 · Copernicus DEM  
**Also live:** **NASA GIBS** context · **Overture Maps** hospitals/schools/clinics  

## Honest pitch lines

- **NASA:** yes — live GIBS WMS satellite wall (flood product, false-colour, night lights, …) at `/api/orbit/nasa`.  
- **Flood mask:** precomputed Sentinel-1 RTC change mask (VV −3 dB / −15 dB) from stored April 2024 scene IDs — offline, not a live SAR job.  
- **T+4 / T+6:** design targets vs ~T+48 optical — **not** measured wall-clock.  
- **Damage:** **3,000+** real Overture critical places triaged against the mask.

**Live:** https://qwen-supernova-2.onrender.com/orbit  
**Local:** http://127.0.0.1:3848/orbit · Full notes: [README.md](README.md)
