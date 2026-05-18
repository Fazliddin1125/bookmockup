# book_server

Book Mockup API — Express + MongoDB + file uploads.

## Local

```bash
npm install
cp .env.example .env
# .env ni to'ldiring
npm start
```

Health: `GET /api/health`

## Deploy (Render — tavsiya)

1. https://render.com → **New Web Service**
2. Connect repo: `Fazliddin1125/book_server`
3. **Build:** `npm install`
4. **Start:** `npm start`
5. **Environment variables:**

| Key | Qiymat |
|-----|--------|
| `MONGODB_URI` | Atlas connection string |
| `ADMIN_USERNAME` | admin |
| `ADMIN_PASSWORD` | kuchli parol |
| `JWT_SECRET` | uzun random string |
| `UPLOADS_PATH` | `/var/data/uploads/templates` (disk mount bilan) |

6. **Disk** (ixtiyoriy, shablon rasmlari saqlansin): 1GB, mount `/var/data/uploads/templates`

Deploy URL ni frontend `VITE_API_URL` ga qo'ying.

## API

- `POST /api/auth/login`
- `GET /api/templates`
- `POST /api/templates` (admin + multipart)
- `PUT /api/templates/:id` (admin)
- `DELETE /api/templates/:id` (admin)
- Static: `/uploads/templates/*`
