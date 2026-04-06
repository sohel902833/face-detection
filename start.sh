#!/usr/bin/env bash
set -e

echo ""
echo "╔════════════════════════════════════════════╗"
echo "║   FaceCheck — Face Attendance System       ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# Check Docker
if ! command -v docker &> /dev/null; then
  echo "❌ Docker not found. Please install Docker Desktop."
  exit 1
fi

if ! docker compose version &> /dev/null 2>&1; then
  echo "❌ Docker Compose v2 not found."
  exit 1
fi

echo "✅ Docker found"
echo ""
echo "🔨 Building and starting all services..."
echo "   (First run downloads ~85MB face model — please wait)"
echo ""

docker compose up --build -d

echo ""
echo "⏳ Waiting for services to be healthy..."

wait_healthy() {
  local name=$1
  local max=60
  local i=0
  while [ $i -lt $max ]; do
    status=$(docker inspect --format='{{.State.Health.Status}}' "$name" 2>/dev/null || echo "starting")
    if [ "$status" = "healthy" ]; then
      echo "   ✅ $name is ready"
      return 0
    fi
    printf "   ⏳ Waiting for %s (%ds)...\r" "$name" "$i"
    sleep 3
    i=$((i+3))
  done
  echo "   ⚠️  $name health check timed out — check logs: docker logs $name"
}

wait_healthy face_attendance_db
wait_healthy face_python_service
wait_healthy face_nest_backend

echo ""
echo "╔════════════════════════════════════════════╗"
echo "║   🚀 All services running!                ║"
echo "╠════════════════════════════════════════════╣"
echo "║   Frontend:  http://localhost:5173         ║"
echo "║   Backend:   http://localhost:3000         ║"
echo "║   Python:    http://localhost:8001/health  ║"
echo "╚════════════════════════════════════════════╝"
echo ""
echo "📋 Logs: docker compose logs -f"
echo "🛑 Stop:  docker compose down"
echo ""
