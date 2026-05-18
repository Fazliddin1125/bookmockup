# bookmockup

3D kitob mockup generator — admin shablon yaratadi, mijoz muqovani yuklab 3D maket oladi.

## Stack

- **Frontend:** React + Vite + Tailwind
- **Backend:** Node.js + Express + MongoDB
- **Engine:** Canvas homography warp

## Local ishga tushirish

```bash
npm run install:all

# Terminal 1
cd backend && npm start

# Terminal 2
cd frontend && npm run dev
```

- Sayt: http://localhost:5173
- Admin: http://localhost:5173/login/admin

## Deploy (frontend — Vercel)

1. [Vercel](https://vercel.com) → Import repo `Fazliddin1125/bookmockup`
2. **Root Directory:** `frontend`
3. **Environment variable:**
   - `VITE_API_URL` = backend URL (masalan `https://your-api.onrender.com`)
4. Deploy

Backend alohida deploy qiling (Render, Railway, VPS) va `MONGODB_URI`, `ADMIN_*`, `JWT_SECRET` ni `.env` da sozlang.
