# Local Development Guide
## Running Each Service Separately (DB via Docker only)

---

## Prerequisites

Make sure these are installed on your machine:

| Tool          | Version  | Install                                      |
|---------------|----------|----------------------------------------------|
| Docker        | any      | https://docs.docker.com/get-docker/          |
| Node.js       | 18+      | https://nodejs.org  or  `nvm install 20`     |
| Python        | 3.10+    | https://www.python.org  or  `pyenv`          |
| npm           | 9+       | comes with Node                              |
| pip           | latest   | comes with Python                            |

---

## Step 0 — Start Only the Database

```bash
cd face-attendance

docker compose up postgres -d
```

PostgreSQL is now running on **localhost:5432**.
Credentials: user=`faceadmin`, password=`facepass123`, db=`face_attendance`

Verify it's up:
```bash
docker compose ps
# Should show: face_attendance_db   running (healthy)
```

---

## Step 1 — Python Face Service

### Install dependencies

```bash
cd python-service

# Recommended: use a virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

pip install -r requirements.txt
```

> ⚠️ First install downloads InsightFace + ONNX runtime (~200MB total).
> The face model itself (~85MB) downloads on **first run**.

### Set environment

The `.env` file is already created at `python-service/.env`:
```env
PYTHONUNBUFFERED=1
MODEL_DIR="./models"
HOST="0.0.0.0"
PORT=8001
MATCH_THRESHOLD=0.40
```

Edit `MATCH_THRESHOLD` if you want stricter (higher) or more permissive (lower) face matching.

### Run

```bash
# Make sure venv is activated
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

First startup downloads the `buffalo_sc` model into `./models/` — takes ~30 seconds.
Subsequent starts are instant (model cached locally).

### Verify

```bash
curl http://localhost:8001/health
# → {"status":"ok","model_loaded":true}
```

---

## Step 2 — NestJS Backend

### Install dependencies

```bash
cd backend
npm install
```

### Set environment

The `.env` file is already created at `backend/.env`:
```env
DATABASE_URL="postgresql://faceadmin:facepass123@localhost:5432/face_attendance"
PYTHON_SERVICE_URL="http://localhost:8001"
JWT_SECRET="change_me_to_something_long_and_random_in_production"
JWT_EXPIRES_IN="7d"
PORT=3000
```

> 🔑 Change `JWT_SECRET` to something long and random before deploying!

### Run database migrations

```bash
npx prisma migrate deploy
# Or for fresh dev setup:
npx prisma migrate dev --name init
```

### Generate Prisma client

```bash
npx prisma generate
```

### Run in development mode

```bash
npm run start:dev
```

The backend starts with hot-reload on **localhost:3000**.

### Verify

```bash
curl http://localhost:3000/auth/profile
# → {"message":"Unauthorized","statusCode":401}  ← correct, no token
```

### Optional: Prisma Studio (DB GUI)

```bash
npx prisma studio
# Opens browser at http://localhost:5555
```

---

## Step 3 — React Frontend

### Install dependencies

```bash
cd frontend
npm install
```

### Set environment

The `.env` file is already created at `frontend/.env`:
```env
VITE_API_URL="http://localhost:3000"
```

This tells the React app where the NestJS backend lives.

### Run

```bash
npm run dev
```

Frontend starts on **http://localhost:5173** with hot-reload.

---

## All Services Running Summary

| Service         | Command                                    | URL                          |
|-----------------|--------------------------------------------|------------------------------|
| PostgreSQL      | `docker compose up postgres -d`            | localhost:5432               |
| Python service  | `uvicorn main:app --port 8001 --reload`    | http://localhost:8001        |
| NestJS backend  | `npm run start:dev`                        | http://localhost:3000        |
| React frontend  | `npm run dev`                              | http://localhost:5173        |

Open the app at **http://localhost:5173** and register your first user.

---

## Stopping Everything

```bash
# Stop Docker DB
docker compose down

# Python: Ctrl+C in its terminal, then:
deactivate   # exit venv

# NestJS: Ctrl+C
# Frontend: Ctrl+C
```

---

## Common Issues & Fixes

### ❌ `Cannot connect to database`
- Make sure Docker is running: `docker compose ps`
- Check `DATABASE_URL` in `backend/.env` — host must be `localhost` (not `postgres`) when running outside Docker

### ❌ `Python model download fails`
- Check internet connection
- Models go into `python-service/models/` — if corrupted, delete the folder and restart

### ❌ `Face not detected` during registration
- Ensure good lighting, face is clearly visible, no sunglasses
- Camera must have permission in your browser

### ❌ `Face match fails` even for same person
- Try lowering `MATCH_THRESHOLD` in `python-service/.env` to `0.35`
- Ensure consistent lighting between registration and login photos

### ❌ `ECONNREFUSED` in NestJS logs
- Python service isn't running or wrong `PYTHON_SERVICE_URL` in `backend/.env`
- Confirm Python is on port 8001: `curl http://localhost:8001/health`

### ❌ NestJS `Cannot find module` errors
```bash
cd backend
npm install
npx prisma generate
npm run start:dev
```

---

## Environment Variables — Full Reference

### `backend/.env`

| Variable             | Required | Default | Description                              |
|----------------------|----------|---------|------------------------------------------|
| `DATABASE_URL`       | ✅ yes   | —       | Full PostgreSQL connection string        |
| `PYTHON_SERVICE_URL` | ✅ yes   | —       | Base URL of the Python FastAPI service   |
| `JWT_SECRET`         | ✅ yes   | —       | Secret key used to sign JWT tokens       |
| `JWT_EXPIRES_IN`     | no       | `7d`    | Token lifetime (e.g. `1d`, `12h`, `7d`) |
| `PORT`               | no       | `3000`  | Port NestJS listens on                   |

### `python-service/.env`

| Variable          | Required | Default    | Description                                        |
|-------------------|----------|------------|----------------------------------------------------|
| `MODEL_DIR`       | no       | `./models` | Directory to cache the InsightFace model           |
| `MATCH_THRESHOLD` | no       | `0.40`     | Cosine similarity cutoff for face match (0.0–1.0)  |
| `HOST`            | no       | `0.0.0.0`  | Interface to bind                                  |
| `PORT`            | no       | `8001`     | Port to listen on                                  |
| `PYTHONUNBUFFERED`| no       | `1`        | Show Python logs in real time                      |

### `frontend/.env`

| Variable        | Required | Default                   | Description                        |
|-----------------|----------|---------------------------|------------------------------------|
| `VITE_API_URL`  | no       | `/api` (nginx proxy path) | Full URL of the NestJS backend     |

> In local dev set this to `http://localhost:3000`.
> In Docker (nginx), leave it unset — nginx proxies `/api/*` automatically.
