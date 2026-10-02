# Cote Collection Web

Application mobile-first de consultation du Cerveau Collection.

## Architecture

- Le moteur de cote commun reste dans Neon (`brain.market_quotes_product_v3` + observations).
- L'authentification et les collections personnelles sont gérées par Supabase Auth.
- Chaque utilisateur importe son propre CSV MyGameDB ; les inventaires sont séparés côté base.
- Les recherches ne comparent la possession qu'avec la collection de l'utilisateur connecté.
- Le navigateur ne reçoit jamais la chaîne de connexion Neon ni les secrets Supabase.

## Variables Vercel existantes

- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

Aucune variable supplémentaire n'est nécessaire pour la V1 multi-utilisateur.

## Déploiement

Le développement multi-utilisateur doit être validé sur une Preview Vercel avant fusion dans `main`.
