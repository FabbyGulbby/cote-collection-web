'use client';

import { FormEvent, useState } from 'react';

type Result = any;

const euro = (value: number | null | undefined) =>
  value == null
    ? '—'
    : new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR',
      }).format(value);

export default function Home() {
  const [q, setQ] = useState('');
  const [price, setPrice] = useState('');
  const [data, setData] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();

    if (q.trim().length < 2) return;

    setLoading(true);
    setError('');
    setData(null);

    try {
      const params = new URLSearchParams({
        q: q.trim(),
      });

      if (price.trim()) {
        params.set('price', price.trim());
      }

      const response = await fetch(
        `/api/search?${params.toString()}`
      );

      const json = await response.json();

      if (!response.ok) {
        throw new Error(
          json.error || 'Erreur de recherche'
        );
      }

      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const r = data?.result;

  return (
    <main className="shell">
      <section className="hero">
        <div className="eyebrow">
          CERVEAU COLLECTION · LECTURE SEULE
        </div>

        <h1>
          Cote <span>Collection</span>
        </h1>

        <p>
          Vérifie rapidement si le prix d&apos;un jeu est
          intéressant par rapport au marché.
        </p>

        <form onSubmit={submit} className="search">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ex. Spec Ops The Line PS3"
            autoFocus
          />

          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Prix vu (€)"
            inputMode="decimal"
          />

          <button disabled={loading}>
            {loading ? 'Analyse…' : 'Analyser'}
          </button>
        </form>

        <div className="examples">
          Exemples :
          <button
            type="button"
            onClick={() => setQ('GTA 5 PS3')}
          >
            GTA 5 PS3
          </button>

          <button
            type="button"
            onClick={() =>
              setQ('Spec Ops The Line PS3')
            }
          >
            Spec Ops PS3
          </button>

          <button
            type="button"
            onClick={() =>
              setQ('Hotel Dusk DS')
            }
          >
            Hotel Dusk DS
          </button>
        </div>
      </section>

      {error && (
        <div className="notice error">
          {error}
        </div>
      )}

      {data && !data.found && (
        <div className="notice">
          Aucune cote exploitable trouvée pour cette
          recherche.
        </div>
      )}

      {r && (
        <section className="results">
          <div className="titleRow">
            <div>
              <div className="platform">
                {r.platform}
              </div>

              <h2>{r.title}</h2>

              <div className="canonical">
                {r.canonicalKey}
              </div>
            </div>

            <div
              className={`signal ${
                r.marketReading
                  ?.toLowerCase()
                  .replaceAll(' ', '-') ?? ''
              }`}
            >
              {r.marketReading}
            </div>
          </div>

          <div className="grid prices">
            <article>
              <small>Ton prix</small>
              <strong>
                {euro(r.evaluatedPrice)}
              </strong>
              <span>prix à évaluer</span>
            </article>

            <article>
              <small>Cote médiane</small>
              <strong>
                {euro(r.quote.median)}
              </strong>
              <span>marché observé</span>
            </article>

            <article>
              <small>
                Dernier coût total observé
              </small>
              <strong>
                {euro(
                  r.latestObservation?.totalPrice
                )}
              </strong>
              <span>
                dernière observation
              </span>
            </article>
          </div>

          <div className="range">
            <div>
              <span>Q1</span>
              <b>{euro(r.quote.q1)}</b>
            </div>

            <div>
              <span>Médiane</span>
              <b>{euro(r.quote.median)}</b>
            </div>

            <div>
              <span>Q3</span>
              <b>{euro(r.quote.q3)}</b>
            </div>
          </div>

          <div className="grid detail">
            <article>
              <small>Observations</small>
              <strong>
                {r.quote.observations}
              </strong>
              <span>
                {r.quote.rawObservations} brutes
              </span>
            </article>

            <article>
              <small>Confiance cote</small>
              <strong>
                {r.quote.confidenceLabel}
              </strong>
              <span>
                {r.quote.confidence}/100
              </span>
            </article>

            <article className="collection">
              <small>
                Intérêt collection Antho
              </small>

              <strong>
                {r.collectionInterest?.available
                  ? r.collectionInterest.label
                  : 'Indisponible'}
              </strong>

              <span>
                {r.collectionInterest?.available &&
                r.collectionInterest.score != null
                  ? `${r.collectionInterest.reason} · ${r.collectionInterest.label}`
                  : r.collectionInterest?.reason ??
                    'Évaluation collection indisponible.'}
              </span>
            </article>

            <article className="ownership">
              <small>
                Ma collection
              </small>

              <strong>
                {!r.ownership?.available
                  ? 'Vérification indisponible'
                  : r.ownership.owned
                    ? '✓ Déjà possédé'
                    : 'Pas dans ma collection'}
              </strong>

              <span>
                {!r.ownership?.available
                  ? 'La vérification de possession n’a pas répondu.'
                  : r.ownership.owned
                    ? [
                        r.ownership.completeness,
                        r.ownership.edition,
                        r.ownership.region,
                      ]
                        .filter(Boolean)
                        .join(' · ')
                    : 'Aucune correspondance dans la collection actuelle.'}
              </span>
            </article>
          </div>

          {data.candidates?.length > 0 && (
            <details>
              <summary>
                Autres correspondances possibles (
                {data.candidates.length})
              </summary>

              <div className="candidates">
                {data.candidates.map(
                  (candidate: any) => (
                    <div
                      key={`${candidate.platform}-${candidate.canonicalKey}`}
                    >
                      <b>
                        {candidate.canonicalKey}
                      </b>

                      <span>
                        {candidate.platform}
                        {' · '}
                        {euro(candidate.median)}
                        {' · '}
                        {candidate.observations}{' '}
                        obs.
                      </span>
                    </div>
                  )
                )}
              </div>
            </details>
          )}
        </section>
      )}

      <footer>
        Source : Cerveau Collection / Neon + Collection ·
        lecture seule
      </footer>
    </main>
  );
}
