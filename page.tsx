'use client';

import { FormEvent, useState } from 'react';

type Result = any;
const euro = (v: number | null | undefined) => v == null ? '—' : new Intl.NumberFormat('fr-FR', { style:'currency', currency:'EUR' }).format(v);

export default function Home() {
  const [q, setQ] = useState('');
  const [data, setData] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (q.trim().length < 2) return;
    setLoading(true); setError(''); setData(null);
    try {
      const r = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Erreur de recherche');
      setData(j);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }

  const r = data?.result;
  return <main className="shell">
    <section className="hero">
      <div className="eyebrow">CERVEAU COLLECTION · LECTURE SEULE</div>
      <h1>Cote <span>Collection</span></h1>
      <p>Un jeu, une plateforme, une réponse rapide.</p>
      <form onSubmit={submit} className="search">
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Star Trek PS3 · Hotel Dusk DS · Majin Xbox 360" autoFocus />
        <button disabled={loading}>{loading ? 'Recherche…' : 'Analyser'}</button>
      </form>
      <div className="examples">Essaie : <button onClick={()=>setQ('GTA 5 PS3')}>GTA 5 PS3</button><button onClick={()=>setQ('Hotel Dusk DS')}>Hotel Dusk DS</button><button onClick={()=>setQ('Majin Xbox 360')}>Majin Xbox 360</button></div>
    </section>

    {error && <div className="notice error">{error}</div>}
    {data && !data.found && <div className="notice">Aucune cote exploitable trouvée pour cette recherche.</div>}

    {r && <section className="results">
      <div className="titleRow"><div><div className="platform">{r.platform}</div><h2>{r.title}</h2><div className="canonical">{r.canonicalKey}</div></div><div className={`signal ${r.marketReading?.toLowerCase().replaceAll(' ','-')}`}>{r.marketReading ?? 'Lecture indisponible'}</div></div>

      <div className="grid prices">
        <article><small>Cote médiane</small><strong>{euro(r.quote.median)}</strong><span>coût total acheteur</span></article>
        <article><small>Prix vendeur observé</small><strong>{euro(r.askingPrice)}</strong><span>dernière observation</span></article>
        <article><small>Coût total observé</small><strong>{euro(r.totalPrice)}</strong><span>Vinted acheteur</span></article>
      </div>

      <div className="range">
        <div><span>Q1</span><b>{euro(r.quote.q1)}</b></div>
        <div><span>Médiane</span><b>{euro(r.quote.median)}</b></div>
        <div><span>Q3</span><b>{euro(r.quote.q3)}</b></div>
      </div>

      <div className="grid detail">
        <article><small>Observations</small><strong>{r.quote.observations}</strong><span>{r.quote.rawObservations} brutes</span></article>
        <article><small>Confiance cote</small><strong>{r.quote.confidenceLabel}</strong><span>{r.quote.confidence}/100</span></article>
        <article className="collection"><small>Intérêt collection Antho</small><strong>{r.collectionInterest.label}</strong><span>{r.collectionInterest.reason}</span></article>
      </div>

      {data.candidates?.length > 1 && <details><summary>Autres correspondances possibles ({data.candidates.length - 1})</summary><div className="candidates">{data.candidates.slice(1).map((c:any)=><div key={`${c.platform}-${c.canonicalKey}`}><b>{c.canonicalKey}</b><span>{c.platform} · {euro(c.median)} · {c.observations} obs.</span></div>)}</div></details>}
    </section>}

    <footer>Source : Cerveau Collection / Neon · aucune écriture depuis ce site</footer>
  </main>
}
