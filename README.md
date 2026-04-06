# FaceCheck — Face Recognition Attendance System

A full-stack attendance system using real-time face recognition.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Architecture                             │
│                                                                 │
│  React (Vite)  ──/api/──►  Nginx  ──►  NestJS (3000)          │
│     :5173                  :80          │                        │
│                                         ├──► PostgreSQL (5432)  │
│                                         └──► Python FastAPI     │
│                                                (8001)           │
└─────────────────────────────────────────────────────────────────┘
```

## Stack

| Layer        | Technology                                |
|--------------|-------------------------------------------|
| Frontend     | React 18 + Vite + react-webcam            |
| Backend API  | NestJS 10 + Prisma ORM                    |
| Face AI      | Python FastAPI + InsightFace (buffalo_sc) |
| Database     | PostgreSQL 16                             |
| Infra        | Docker Compose + Nginx                    |

## Face Recognition Details

- **Model**: InsightFace `buffalo_sc` (~85MB, CPU-optimized)
- **Embedding**: 512-dim L2-normalized float vector
- **Matching**: Cosine similarity — threshold 0.40
- **Target latency**: < 2 seconds per match (CPU)
- **Storage**: Embeddings stored as `DOUBLE PRECISION[]` in Postgres

## Quick Start

### Prerequisites
- Docker Desktop (or Docker + Docker Compose v2)
- At least 4GB RAM (model loading)
- Webcam / camera

### Run

```bash
# Clone / unzip project, then:
cd face-attendance
docker compose up --build
```

First startup takes ~5–10 minutes (downloads the ~85MB InsightFace model).

Once running:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **Python Face Service**: http://localhost:8001
- **Python Health**: http://localhost:8001/health

### Development (without Docker)

**PostgreSQL** (run separately or use Docker just for DB):
```bash
docker compose up postgres -d
```

**Python service**:
```bash
cd python-service
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

**NestJS backend**:
```bash
cd backend
npm install
DATABASE_URL="postgresql://faceadmin:facepass123@localhost:5432/face_attendance" \
PYTHON_SERVICE_URL="http://localhost:8001" \
JWT_SECRET="dev_secret" \
npx prisma migrate deploy && npm run start:dev
```

**React frontend**:
```bash
cd frontend
npm install
VITE_API_URL="http://localhost:3000" npm run dev
```

## User Flows

### Registration
1. User fills name, email, phone
2. Captures face photo via webcam
3. NestJS validates email uniqueness
4. NestJS forwards photo → Python → returns 512-dim embedding
5. User + embedding saved to PostgreSQL
6. JWT token returned

### Login
1. User enters email + live face photo
2. NestJS checks user exists
3. Sends photo + stored embedding → Python
4. Python embeds live photo, computes cosine similarity
5. If similarity ≥ 0.40 → JWT issued
6. If < 0.40 → 401 Unauthorized

### Attendance Marking
1. Authenticated user opens dashboard
2. Clicks "Mark Attendance", picks date, captures photo
3. Same face match pipeline
4. On success → attendance record created with similarity score
5. Duplicate check: one record per user per date

## API Reference

### Auth
```
POST /auth/register   multipart: name, email, phone?, photo
POST /auth/login      multipart: email, photo
GET  /auth/profile    Bearer token required
```

### Attendance
```
POST /attendance/mark   Bearer + multipart: photo, date (ISO)
GET  /attendance/my     Bearer + ?page=1&limit=20
GET  /attendance/stats  Bearer
GET  /attendance/all    Bearer + ?page&limit&date
```

### Python Face Service
```
GET  /health
POST /detect-and-embed   multipart: file
POST /match-face         multipart: file, stored_embedding (JSON string)
```

## Environment Variables

### Backend
| Variable             | Default                  | Description          |
|----------------------|--------------------------|----------------------|
| DATABASE_URL         | (required)               | PostgreSQL URL       |
| PYTHON_SERVICE_URL   | http://localhost:8001    | Face service URL     |
| JWT_SECRET           | (required in prod)       | JWT signing key      |
| JWT_EXPIRES_IN       | 7d                       | Token lifetime       |
| PORT                 | 3000                     | Server port          |

## Performance Tips

- Run on a machine with 4+ CPU cores for faster face matching
- The `buffalo_sc` model runs in ~200-800ms on modern CPUs
- For production, consider `buffalo_l` model for better accuracy (tradeoff: slower)
- GPU support: change `CPUExecutionProvider` → `CUDAExecutionProvider` in Python service

## Project Structure

```
face-attendance/
├── docker-compose.yml
├── python-service/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── main.py                 # FastAPI face detection & matching
├── backend/
│   ├── Dockerfile
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   └── src/
│       ├── main.ts
│       ├── app.module.ts
│       ├── prisma/             # PrismaService
│       ├── face/               # FaceService (calls Python)
│       ├── auth/               # Register, Login, JWT
│       └── attendance/         # Mark, History, Stats
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    └── src/
        ├── api/client.js
        ├── context/AuthContext.jsx
        ├── components/CameraCapture.jsx
        ├── pages/
        │   ├── RegisterPage.jsx
        │   ├── LoginPage.jsx
        │   └── DashboardPage.jsx
        └── styles.css
```
