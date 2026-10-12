/**
 * Comptes de NextMobility Sabadell.
 *
 * DE MOMENT SÓN FICTICIS: tot es guarda en aquest navegador (localStorage). No hi ha cap
 * servidor, no s'envia res enlloc i un compte creat aquí no existeix en cap altre dispositiu.
 * Les contrasenyes no es guarden mai en clar: PBKDF2-SHA-256 (WebCrypto) amb sal aleatòria.
 *
 * La UI només parla amb `AuthProvider`. Quan hi hagi un servei real (Supabase, Firebase…),
 * s'escriu un altre proveïdor amb la mateixa interfície i no cal tocar cap pantalla.
 */

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: number;
  /** compte de demostració (sense contrasenya; per a presentacions) */
  demo?: boolean;
}

export type AuthErrorCode = 'invalid-email' | 'weak-password' | 'name-required' | 'email-in-use' | 'wrong-credentials' | 'unavailable';

export class AuthError extends Error {
  constructor(readonly code: AuthErrorCode) {
    super(code);
  }
}

export interface AuthProvider {
  /** "local" = ficticis al navegador; un proveïdor real diria "remote" */
  readonly kind: 'local' | 'remote';
  current(): User | null;
  signUp(name: string, email: string, password: string): Promise<User>;
  signIn(email: string, password: string): Promise<User>;
  signInDemo(): Promise<User>;
  signOut(): Promise<void>;
  /** canvia el nom visible del compte amb la sessió iniciada */
  updateName(name: string): Promise<User>;
  /** cal la contrasenya actual */
  changePassword(current: string, next: string): Promise<void>;
  /** esborra el compte (cal la contrasenya) i tot el que és seu en aquest dispositiu */
  deleteAccount(password: string, extraKeys: string[]): Promise<void>;
}

/** Emmagatzematge mínim (localStorage al navegador; un Map als tests). */
export interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

interface StoredUser extends User {
  salt: string;
  hash: string;
}

const USERS = 'nextmobility.users';
const SESSION = 'nextmobility.session';
export const MIN_PASSWORD = 8;
const ITERATIONS = 150_000;

export const DEMO_USER: User = { id: 'demo', email: 'demo@nextmobility.app', name: 'Compte de demostració', createdAt: 0, demo: true };

export const normalizeEmail = (e: string) => e.trim().toLowerCase();
export const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizeEmail(e));

const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf)));

async function hashPassword(password: string, salt: Uint8Array<ArrayBuffer>): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS }, key, 256);
  return b64(bits);
}

/** Comparació en temps constant (no revela per temps quants caràcters coincideixen). */
function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export class LocalAuthProvider implements AuthProvider {
  readonly kind = 'local' as const;
  constructor(private readonly kv: KV) {}

  private users(): StoredUser[] {
    try {
      return JSON.parse(this.kv.getItem(USERS) ?? '[]') as StoredUser[];
    } catch {
      return [];
    }
  }

  private save(users: StoredUser[]) {
    this.kv.setItem(USERS, JSON.stringify(users));
  }

  private startSession(u: User): User {
    this.kv.setItem(SESSION, JSON.stringify({ userId: u.id, at: Date.now() }));
    return u;
  }

  current(): User | null {
    try {
      const s = JSON.parse(this.kv.getItem(SESSION) ?? 'null') as { userId: string } | null;
      if (!s) return null;
      if (s.userId === DEMO_USER.id) return DEMO_USER;
      const u = this.users().find((x) => x.id === s.userId);
      if (!u) return null;
      const { salt: _s, hash: _h, ...pub } = u;
      return pub;
    } catch {
      return null;
    }
  }

  async signUp(name: string, email: string, password: string): Promise<User> {
    const em = normalizeEmail(email);
    if (!name.trim()) throw new AuthError('name-required');
    if (!validEmail(em)) throw new AuthError('invalid-email');
    if (password.length < MIN_PASSWORD) throw new AuthError('weak-password');
    const users = this.users();
    if (users.some((u) => u.email === em) || em === DEMO_USER.email) throw new AuthError('email-in-use');
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const user: StoredUser = {
      id: crypto.randomUUID(),
      email: em,
      name: name.trim().slice(0, 60),
      createdAt: Date.now(),
      salt: b64(salt),
      hash: await hashPassword(password, salt),
    };
    this.save([...users, user]);
    const { salt: _s, hash: _h, ...pub } = user;
    return this.startSession(pub);
  }

  async signIn(email: string, password: string): Promise<User> {
    const em = normalizeEmail(email);
    const u = this.users().find((x) => x.email === em);
    // mateix error si el correu no existeix o la contrasenya és incorrecta (no revela quins comptes hi ha)
    if (!u) {
      await hashPassword(password, new Uint8Array(16));
      throw new AuthError('wrong-credentials');
    }
    const salt = new Uint8Array(Uint8Array.from(atob(u.salt), (c) => c.charCodeAt(0)));
    if (!sameText(await hashPassword(password, salt), u.hash)) throw new AuthError('wrong-credentials');
    const { salt: _s, hash: _h, ...pub } = u;
    return this.startSession(pub);
  }

  async signInDemo(): Promise<User> {
    return this.startSession(DEMO_USER);
  }

  async signOut(): Promise<void> {
    this.kv.removeItem(SESSION);
  }

  /** l'usuari de la sessió (no el de demostració) amb la contrasenya comprovada */
  private async own(password?: string): Promise<StoredUser> {
    const cur = this.current();
    const u = cur && !cur.demo ? this.users().find((x) => x.id === cur.id) : undefined;
    if (!u) throw new AuthError('unavailable');
    if (password !== undefined) {
      const salt = new Uint8Array(Uint8Array.from(atob(u.salt), (c) => c.charCodeAt(0)));
      if (!sameText(await hashPassword(password, salt), u.hash)) throw new AuthError('wrong-credentials');
    }
    return u;
  }

  async updateName(name: string): Promise<User> {
    if (!name.trim()) throw new AuthError('name-required');
    const u = await this.own();
    const next = { ...u, name: name.trim().slice(0, 60) };
    this.save(this.users().map((x) => (x.id === u.id ? next : x)));
    const { salt: _s, hash: _h, ...pub } = next;
    return pub;
  }

  async changePassword(current: string, next: string): Promise<void> {
    const u = await this.own(current);
    if (next.length < MIN_PASSWORD) throw new AuthError('weak-password');
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const upd = { ...u, salt: b64(salt), hash: await hashPassword(next, salt) };
    this.save(this.users().map((x) => (x.id === u.id ? upd : x)));
  }

  async deleteAccount(password: string, extraKeys: string[]): Promise<void> {
    const u = await this.own(password);
    this.save(this.users().filter((x) => x.id !== u.id));
    for (const k of extraKeys) this.kv.removeItem(k);
    this.kv.removeItem(SESSION);
  }
}

/** localStorage si existeix; si el navegador el bloqueja (mode privat estricte), memòria. */
function browserKV(): KV {
  try {
    const k = '__nextmobility_probe';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return localStorage;
  } catch {
    const m = new Map<string, string>();
    return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
  }
}

export const auth: AuthProvider = typeof window === 'undefined' ? new LocalAuthProvider(new Map() as unknown as KV) : new LocalAuthProvider(browserKV());
