#!/bin/bash
cd "$(dirname "$0")"

echo "🔨 Building..."
docker compose build --quiet

echo "🚀 Subindo containers..."
docker compose up -d

echo ""
echo "✅ Pronto! Acesse: http://localhost:8080"
echo ""
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
