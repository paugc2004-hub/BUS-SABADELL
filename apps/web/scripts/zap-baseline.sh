#!/usr/bin/env bash
# Escaneig PASSIU d'OWASP ZAP (baseline): només navega i observa capçaleres, galetes i respostes;
# no ataca ni envia formularis. Per defecte, contra el build local (`vite preview`), no contra producció.
#
#   pnpm --filter @bus/web build && (cd apps/web && npx vite preview --port 4173 &)
#   bash apps/web/scripts/zap-baseline.sh                 # http://host.docker.internal:4173
#   TARGET=https://bus-sabadell.vercel.app bash apps/web/scripts/zap-baseline.sh   # producció: només amb permís
#
# Requisits: Docker amb el dimoni en marxa. Informe a apps/web/zap-report.html (no es versiona).
# Producció: poques peticions seguides; el tallafoc de Vercel pot respondre 403 («punt de control») si n'hi ha massa.
set -euo pipefail
TARGET="${TARGET:-http://host.docker.internal:4173}"
IMAGE="ghcr.io/zaproxy/zaproxy:stable"
OUT="$(cd "$(dirname "$0")/.." && pwd)"
case "$TARGET" in
  http://localhost*|http://127.0.0.1*|http://host.docker.internal*) ;;
  *) echo "Objectiu remot: $TARGET. Escriu SI per continuar (escaneig passiu, ~5 min):"; read -r ok; [ "$ok" = "SI" ] || exit 1 ;;
esac
# -m 3: com a molt 3 min d'aranya; -I: els avisos no fan fallar l'ordre (és un informe)
docker run --rm --add-host=host.docker.internal:host-gateway -v "$OUT:/zap/wrk:rw" -t "$IMAGE" \
  zap-baseline.py -t "$TARGET" -m 3 -r zap-report.html -J zap-report.json -I
echo "Informe: $OUT/zap-report.html"
