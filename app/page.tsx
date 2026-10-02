'use client';

import { FormEvent, useEffect, useState } from 'react';

type Profile = {
  userId: string;
  email?: string | null;
  displayName?: string | null;
  role: 'user' | 'admin';
  isActive: boolean;
  collectionFilename?: string | null;
  collectionItemCount?: number;
  collectionUpdatedAt?: string | null;
};

type AdminUser = {
  userId: string;
  email?: string | null;
  displayName?: string | null;
  role: 'user' | 'admin';
  isActive: boolean;
  collectionItemCount?: number;
};

type Result = any;

const euro = (value: number | null | undefined) =>
  value == null
    ? '—'
    : new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR',
      }).format(value);

async function apiJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error || 'Une erreur est survenue.');
  return json;
}

export default function Home() {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState('');

  const [q, setQ] = useState('');
  const [price, setPrice] = useState('');
  const [data, setData] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [importBusy, setImportBusy] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [adminBusy, setAdminBusy] = useState(false);

  async function refreshMe() {
    try {
      const response = await fetch('/api/auth/me', { cache: 'no-store' });
      if (!response.ok) {
        setProfile(null);
        return;
      }
      const json = await response.json();
      setProfile(json.profile ?? null);
    } finally {
      setCheckingAuth(false);
    }
  }

  useEffect(() => {
    refreshMe();
  }, []);

  useEffect(() => {
    if (profile?.role === 'admin' && profile.isActive) loadAdminUsers();
  }, [profile?.role, profile?.isActive]);

  async function submitAuth(e: FormEvent) {
    e.preventDefault();
    setAuthBusy(true);
    setAuthMessage('');

    try {
      if (authMode === 'signup') {
        const json = await apiJson('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ displayName, email, password }),
        });

        if (json.needsEmailConfirmation) {
          setAuthMessage('Compte créé. Confirme ton adresse email puis connecte-toi.');
          setAuthMode('login');
          return;
        }
      } else {
        await apiJson('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
      }

      setPassword('');
      await refreshMe();
    } catch (err: any) {
      setAuthMessage(err.message);
    } finally {
      setAuthBusy(false);
    }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setProfile(null);
    setData(null);
    setAdminUsers([]);
  }

  async function importCsv(file: File | null) {
    if (!file) return;
    setImportBusy(true);
    setImportMessage('');

    try {
      const form = new FormData();
      form.set('file', file);
      const json = await apiJson('/api/collection', { method: 'POST', body: form });
      const count = json.collection?.itemCount ?? 0;
      setImportMessage(`${count} jeu${count > 1 ? 'x' : ''} importé${count > 1 ? 's' : ''}.`);
      await refreshMe();
    } catch (err: any) {
      setImportMessage(err.message);
    } finally {
      setImportBusy(false);
    }
  }

  async function loadAdminUsers() {
    setAdminBusy(true);
    try {
      const json = await apiJson('/api/admin/users');
      setAdminUsers(json.users ?? []);
    } catch {
      setAdminUsers([]);
    } finally {
      setAdminBusy(false);
    }
  }

  async function updateUser(user: AdminUser, changes: Partial<AdminUser>) {
    setAdminBusy(true);
    try {
      await apiJson('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.userId,
          isActive: changes.isActive ?? user.isActive,
          role: changes.role ?? user.role,
        }),
      });
      await loadAdminUsers();
    } catch (err: any) {
      setError(err.message);
      setAdminBusy(false);
    }
  }

  async function submitSearch(e: FormEvent) {
    e.preventDefault();
    if (q.trim().length < 2) return;

    setLoading(true);
    setError('');
    setData(null);

    try {
      const params = new URLSearchParams({ q: q.trim() });
      if (price.trim()) params.set('price', price.trim());
      const json = await apiJson(`/api/search?${params.toString()}`);
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (checkingAuth) {
    return <main className="shell"><div className="notice">Chargement de ton espace…</div></main>;
  }

  if (!profile) {
    return (
      <main className="shell authShell">
        <section className="hero compactHero">
          <div className="eyebrow">CERVEAU COLLECTION · ESPACE PERSONNEL</div>
          <h1>Cote <span>Collection</span></h1>
          <p>Le même moteur de cote, avec ta propre collection.</p>
        </section>

        <section className="accountCard">
          <div className="authTabs">
            <button className={authMode === 'login' ? 'active' : ''} onClick={() => setAuthMode('login')}>Connexion</button>
            <button className={authMode === 'signup' ? 'active' : ''} onClick={() => setAuthMode('signup')}>Créer un compte</button>
          </div>

          <form className="authForm" onSubmit={submitAuth}>
            {authMode === 'signup' && (
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Prénom / nom affiché" autoComplete="name" />
            )}
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" autoComplete="email" />
            <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mot de passe" type="password" autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} />
            <button disabled={authBusy}>{authBusy ? 'Patiente…' : authMode === 'login' ? 'Se connecter' : 'Créer mon compte'}</button>
          </form>
          {authMessage && <div className="notice slim">{authMessage}</div>}
        </section>
      </main>
    );
  }

  if (!profile.isActive) {
    return (
      <main className="shell authShell">
        <section className="accountCard pendingCard">
          <div className="eyebrow">COMPTE CRÉÉ</div>
          <h2>Bonjour {profile.displayName || profile.email}</h2>
          <p>Ton compte attend l’activation d’un administrateur Cote Collection.</p>
          <button className="secondaryButton" onClick={logout}>Se déconnecter</button>
        </section>
      </main>
    );
  }

  const r = data?.result;

  return (
    <main className="shell">
      <section className="userBar">
        <div>
          <b>{profile.displayName || profile.email}</b>
          <span>{profile.role === 'admin' ? 'Administrateur' : 'Collectionneur'} · {profile.collectionItemCount ?? 0} jeux</span>
        </div>
        <button onClick={logout}>Déconnexion</button>
      </section>

      <section className="hero">
        <div className="eyebrow">CERVEAU COLLECTION · {profile.displayName || 'MON ESPACE'}</div>
        <h1>Cote <span>Collection</span></h1>
        <p>Vérifie le prix d’un jeu grâce au cerveau commun, puis compare automatiquement avec ta collection personnelle.</p>

        <form onSubmit={submitSearch} className="search">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ex. Spec Ops The Line PS3" autoFocus />
          <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Prix vu (€)" inputMode="decimal" />
          <button disabled={loading}>{loading ? 'Analyse…' : 'Analyser'}</button>
        </form>

        <div className="examples">
          Exemples :
          <button type="button" onClick={() => setQ('GTA 5 PS3')}>GTA 5 PS3</button>
          <button type="button" onClick={() => setQ('Spec Ops The Line PS3')}>Spec Ops PS3</button>
          <button type="button" onClick={() => setQ('Hotel Dusk DS')}>Hotel Dusk DS</button>
        </div>
      </section>

      <section className="collectionPanel">
        <div>
          <small>MA COLLECTION MYGAMEDB</small>
          <strong>{profile.collectionItemCount ?? 0} jeux chargés</strong>
          <span>{profile.collectionFilename || 'Aucun CSV importé'}</span>
        </div>
        <label className={`uploadButton ${importBusy ? 'disabled' : ''}`}>
          {importBusy ? 'Import…' : profile.collectionItemCount ? 'Remplacer le CSV' : 'Importer mon CSV'}
          <input type="file" accept=".csv,text/csv" disabled={importBusy} onChange={(e) => importCsv(e.target.files?.[0] ?? null)} />
        </label>
        {importMessage && <span className="importMessage">{importMessage}</span>}
      </section>

      {error && <div className="notice error">{error}</div>}
      {data && !data.found && <div className="notice">Aucune cote exploitable trouvée pour cette recherche.</div>}

      {r && (
        <section className="results">
          <div className="titleRow">
            <div>
              <div className="platform">{r.platform}</div>
              <h2>{r.title}</h2>
              <div className="canonical">{r.canonicalKey}</div>
            </div>
            <div className={`signal ${r.marketReading?.toLowerCase().replaceAll(' ', '-') ?? ''}`}>{r.marketReading}</div>
          </div>

          <div className="grid prices">
            <article><small>Ton prix</small><strong>{euro(r.evaluatedPrice)}</strong><span>prix à évaluer</span></article>
            <article><small>Cote médiane</small><strong>{euro(r.quote.median)}</strong><span>marché observé</span></article>
            <article><small>Dernier coût total observé</small><strong>{euro(r.latestObservation?.totalPrice)}</strong><span>dernière observation</span></article>
          </div>

          <div className="range">
            <div><span>Q1</span><b>{euro(r.quote.q1)}</b></div>
            <div><span>Médiane</span><b>{euro(r.quote.median)}</b></div>
            <div><span>Q3</span><b>{euro(r.quote.q3)}</b></div>
          </div>

          <div className="grid detail twoColumns">
            <article>
              <small>Confiance cote</small>
              <strong>{r.quote.confidenceLabel}</strong>
              <span>{r.quote.observations} observations · {r.quote.confidence ?? '—'}/100</span>
            </article>
            <article className={`ownership ${r.ownership?.owned ? 'owned' : ''}`}>
              <small>Collection de {profile.displayName || 'cet utilisateur'}</small>
              <strong>{!r.ownership?.available ? 'Vérification indisponible' : r.ownership.owned ? '✓ Déjà possédé' : 'Pas dans ma collection'}</strong>
              <span>
                {!r.ownership?.available
                  ? 'La vérification de possession n’a pas répondu.'
                  : r.ownership.owned
                    ? [r.ownership.displayName, r.ownership.completeness, r.ownership.edition, r.ownership.region].filter(Boolean).join(' · ')
                    : 'Aucune correspondance dans ta collection personnelle.'}
              </span>
            </article>
          </div>

          {data.candidates?.length > 0 && (
            <details>
              <summary>Autres correspondances possibles ({data.candidates.length})</summary>
              <div className="candidates">
                {data.candidates.map((candidate: any) => (
                  <div key={`${candidate.platform}-${candidate.canonicalKey}`}>
                    <b>{candidate.canonicalKey}</b>
                    <span>{candidate.platform} · {euro(candidate.median)} · {candidate.observations} obs.</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </section>
      )}

      {profile.role === 'admin' && (
        <details className="adminPanel">
          <summary>Administration des comptes</summary>
          <div className="adminList">
            {adminBusy && adminUsers.length === 0 && <div className="notice slim">Chargement…</div>}
            {adminUsers.map((user) => (
              <div className="adminUser" key={user.userId}>
                <div>
                  <b>{user.displayName || user.email}</b>
                  <span>{user.email} · {user.collectionItemCount ?? 0} jeux</span>
                </div>
                <div className="adminActions">
                  <button disabled={adminBusy} onClick={() => updateUser(user, { isActive: !user.isActive })}>{user.isActive ? 'Désactiver' : 'Activer'}</button>
                  <button disabled={adminBusy} onClick={() => updateUser(user, { role: user.role === 'admin' ? 'user' : 'admin' })}>{user.role === 'admin' ? 'Retirer admin' : 'Passer admin'}</button>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      <footer>Source commune : Cerveau Collection / Neon · collections personnelles séparées</footer>
    </main>
  );
}
