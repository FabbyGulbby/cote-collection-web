# Cote Collection Web

V1 mobile-first en lecture seule du Cerveau Collection Neon.

## Démarrage
1. `npm install`
2. Copier `.env.example` vers `.env.local`
3. Renseigner `DATABASE_URL` avec un rôle Neon lecture seule
4. `npm run dev`

Le navigateur ne reçoit jamais la chaîne de connexion. Toutes les requêtes Neon passent par `/api/search` côté serveur.

Déploiement actualisé.
