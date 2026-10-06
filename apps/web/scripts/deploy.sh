#!/usr/bin/env bash
# Desplega la web a Vercel (projecte bus-sabadell) — sempre al mateix projecte, per ID.
set -euo pipefail
cd "$(dirname "$0")/.."
VITE_API_URL=https://bus-sabadell-api.vercel.app npx vite build --outDir dist-deploy --emptyOutDir
cp vercel.json dist-deploy/
cd dist-deploy
VERCEL_ORG_ID=team_3sBuFqndI5AXxdLcbIXcJWql VERCEL_PROJECT_ID=prj_CXBGg03VRW8w3wemhJVy2at7PrUQ npx vercel deploy --prod --yes
