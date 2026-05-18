# bookmockup

3D kitob mockup generator — **frontend** (React + Vite).

Backend alohida repo: [book_server](https://github.com/Fazliddin1125/book_server)

## Local

```bash
npm install
npm run dev
```

Backend local: `http://localhost:5001` (Vite proxy `/api` va `/uploads`)

## Deploy (Vercel)

1. Import repo: [Fazliddin1125/bookmockup](https://github.com/Fazliddin1125/bookmockup)
2. **Root Directory:** `.` (repo ildizi)
3. **Environment variable:**
   - `VITE_API_URL` = `https://your-book-server.onrender.com`
4. Deploy

## Admin

`/login/admin` — backend `.env` dagi `ADMIN_USERNAME` / `ADMIN_PASSWORD`
