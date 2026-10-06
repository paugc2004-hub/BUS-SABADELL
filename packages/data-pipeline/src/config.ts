/** Lectura y validación de los ficheros editados a mano (data/config/*.yaml). */
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data en format AAAA-MM-DD');

export const FestiusSchema = z.object({
  font: z.string().min(1),
  pendents: z.array(z.object({ any: z.number().int(), motiu: z.string() })).default([]),
  festius: z.array(
    z.object({ data: isoDate, nom: z.string().min(1), ambit: z.enum(['estatal', 'catalunya', 'local']) }),
  ),
});

export const AvisosSchema = z.object({
  avisos: z.array(
    z.object({
      id: z.string().min(1),
      linies: z.array(z.string()).default([]),
      parades: z.array(z.string()).default([]),
      des_de: isoDate,
      fins_a: isoDate.nullable().default(null),
      text: z.object({ ca: z.string().min(1), es: z.string().min(1) }),
      url: z.string().url().optional(),
    }),
  ),
});

export const OverridesSchema = z.object({
  excloure: z.array(z.string()).default([]),
  colors: z.record(z.string(), z.string().regex(/^#[0-9a-fA-F]{6}$/)).default({}),
});

/** Valida y devuelve errores legibles: fichero, ruta del campo y problema. */
export function loadYaml<T extends z.ZodTypeAny>(file: string, schema: T): z.infer<T> {
  const raw = parse(readFileSync(file, 'utf8'));
  const res = schema.safeParse(raw);
  if (!res.success) {
    const msgs = res.error.issues.map((i) => `  - ${file}: ${i.path.join('.') || '(arrel)'}: ${i.message}`);
    throw new Error(`Configuració no vàlida:\n${msgs.join('\n')}`);
  }
  return res.data;
}

/** Comprobaciones semánticas de festius (fechas reales, sin duplicados). */
export function checkFestius(f: z.infer<typeof FestiusSchema>): string[] {
  const errs: string[] = [];
  const seen = new Set<string>();
  for (const h of f.festius) {
    const d = new Date(`${h.data}T12:00:00Z`);
    if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== h.data) errs.push(`data inexistent: ${h.data}`);
    if (seen.has(h.data)) errs.push(`data duplicada: ${h.data}`);
    seen.add(h.data);
  }
  return errs;
}
