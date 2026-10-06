// Empaqueta la API en un único fichero para Vercel (apps/api/.vercel-deploy/api/index.mjs)
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', '.vercel-deploy');
mkdirSync(join(out, 'api'), { recursive: true });
await build({
  entryPoints: [join(here, '..', 'src', 'vercel.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  outfile: join(out, 'api', 'index.mjs'),
  banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" },
  loader: { '.json': 'json' },
  logLevel: 'info',
});
writeFileSync(
  join(out, 'vercel.json'),
  JSON.stringify(
    {
      version: 2,
      functions: { 'api/index.mjs': { maxDuration: 300, memory: 512 } },
      rewrites: [{ source: '/(.*)', destination: '/api/index.mjs' }],
    },
    null,
    2,
  ),
);
writeFileSync(join(out, 'package.json'), JSON.stringify({ name: 'bus-sabadell-api', private: true, type: 'module' }, null, 2));
console.log('bundle ok');
