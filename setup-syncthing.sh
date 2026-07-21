#!/bin/bash
set -e

echo "=== Setup Syncthing — RetroArch Saves ==="
echo ""

# Cria estrutura de pastas
mkdir -p syncthing/config
mkdir -p syncthing/retroarch_saves

echo "[1/3] Pastas criadas:"
echo "  syncthing/config"
echo "  syncthing/retroarch_saves"
echo ""

# Inicia o container
echo "[2/3] Iniciando container Syncthing..."
docker compose up -d syncthing
echo ""

# Aguarda o container ficar pronto
echo "[3/3] Aguardando Syncthing inicializar..."
sleep 5

# Mostra o Device ID
echo ""
echo "============================================"
echo "  DEVICE ID DO SERVIDOR"
echo "============================================"
docker exec syncthing syncthing -device-id 2>/dev/null || \
  docker exec syncthing cat /config/cert.pem 2>/dev/null | \
  openssl x509 -noout -fingerprint -sha256 2>/dev/null | \
  cut -d= -f2 | tr -d ':' || \
  echo "  Aguarde 30s e acesse http://localhost:8384 para ver o Device ID"
echo ""
echo "============================================"
echo ""
echo "Interface Web: http://localhost:8384"
echo ""
echo "PROXIMOS PASSOS:"
echo "1. Acesse http://localhost:8384"
echo "2. Vá em Dispositivos → Adicionar"
echo "3. Cole o Device ID acima"
echo "4. No PC/Celular, adicione o Device ID deste servidor"
echo "5. Compartilhe a pasta 'saves' com este servidor"
echo "6. Aceite a pasta no servidor apontando para /saves"
echo ""
echo "REGRAS DE SEGURANCA:"
echo "- Ative Versionamento Simples (manter ultimos 5 saves)"
echo "- Priorize sempre o .srm com timestamp mais recente"
echo ""
echo "Sincronizacao entre PC ↔ Servidor ↔ Celular ativa!"
