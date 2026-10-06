import { describe, expect, it } from 'vitest';
import { AuthError, DEMO_USER, LocalAuthProvider, type KV } from './auth.ts';

const memory = (): KV & { dump(): string } => {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k), dump: () => JSON.stringify([...m]) };
};

const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return null;
  } catch (e) {
    return (e as AuthError).code;
  }
};

describe('comptes (ficticis, al navegador)', () => {
  it('registre → sessió iniciada; tancar i tornar a entrar', async () => {
    const kv = memory();
    const a = new LocalAuthProvider(kv);
    const u = await a.signUp('Pau', 'Pau@Exemple.cat ', 'una-contrasenya');
    expect(u.email).toBe('pau@exemple.cat');
    expect(a.current()?.id).toBe(u.id);
    await a.signOut();
    expect(a.current()).toBeNull();
    expect((await a.signIn('pau@exemple.cat', 'una-contrasenya')).id).toBe(u.id);
  });

  it('la contrasenya no es guarda mai en clar', async () => {
    const kv = memory();
    await new LocalAuthProvider(kv).signUp('Pau', 'pau@exemple.cat', 'secret-molt-llarg');
    expect(kv.dump()).not.toContain('secret-molt-llarg');
  });

  it('valida correu, contrasenya i nom; no permet correus repetits', async () => {
    const a = new LocalAuthProvider(memory());
    expect(await code(a.signUp('Pau', 'no-es-un-correu', '12345678'))).toBe('invalid-email');
    expect(await code(a.signUp('Pau', 'pau@exemple.cat', 'curta'))).toBe('weak-password');
    expect(await code(a.signUp('  ', 'pau@exemple.cat', '12345678'))).toBe('name-required');
    await a.signUp('Pau', 'pau@exemple.cat', '12345678');
    expect(await code(a.signUp('Altre', 'PAU@exemple.cat', '12345678'))).toBe('email-in-use');
  });

  it('el mateix error si el correu no existeix o la contrasenya és incorrecta', async () => {
    const a = new LocalAuthProvider(memory());
    await a.signUp('Pau', 'pau@exemple.cat', '12345678');
    await a.signOut();
    expect(await code(a.signIn('pau@exemple.cat', 'dolenta1'))).toBe('wrong-credentials');
    expect(await code(a.signIn('ningu@exemple.cat', '12345678'))).toBe('wrong-credentials');
    expect(a.current()).toBeNull();
  });

  it('compte de demostració sense contrasenya', async () => {
    const a = new LocalAuthProvider(memory());
    await a.signInDemo();
    expect(a.current()).toEqual(DEMO_USER);
  });
});
