# Architecture de MenuiPro

## Principes

1. **Tout se calcule sur le téléphone.** Pièces, découpe, perçages, 3D et prix fonctionnent sans réseau.
2. **Une seule source de vérité : les pièces.** La 3D, le plan de découpe, les perçages, la liste d'achat et l'export CNC sont tous produits à partir de la même liste de pièces. Ce que voit le client est ce qui sera fabriqué.
3. **Un meuble = une recette.** Une recette assemble des blocs (caisse, colonnes, zones de tiroirs ou d'étagères, portes, plateaux). Ajouter un meuble ne demande pas de nouveau code de calcul.

## Repère et unités

Millimètres. x = largeur, y = hauteur, z = profondeur (fond → façade). Une pièce a une `box = [x, y, z, sx, sy, sz]`, une matière (`caisson` ou `dos`), un chant et des perçages.

## Flux

recette + cotes + options → `buildRecipe` → pièces (+ quincaillerie, + perçages)
→ `pack` (guillotine) → feuilles → plan, export CNC
→ prix du catalogue → liste d'achat → devis

## Données

Version de lancement : catalogue, réglages de l'atelier et projets enregistrés sur le téléphone (localStorage).
Étape suivante : comptes (numéro + code PIN) et sauvegarde en ligne (Supabase puis Render PostgreSQL).

## Hébergement

Render, site statique gratuit. Budget d'hébergement total visé : moins de 10 000 FCFA/mois.

## Comptes et données en ligne (v0.2)

- **Supabase** : PostgreSQL + authentification. Migration : `supabase/migrations/20261112000000_init.sql`.
- **Connexion** : numéro de téléphone + code PIN de 6 chiffres. Supabase exigeant un e-mail, l'application utilise `<numéro>@menuipro.app` (aucun e-mail envoyé). Réglage obligatoire côté Supabase : désactiver « Confirm email ».
- **Tables** : `profils` (créé à l'inscription), `quincailleries` (catalogue partagé en JSON, code d'invitation à 6 caractères), `projets`, `commandes`.
- **Sécurité (RLS)** : chacun ne voit que ses projets ; les menuisiers lisent le catalogue de leur quincaillerie sans pouvoir le modifier ; une commande ne part que vers sa propre quincaillerie ; la quincaillerie ne change que le statut. Le rôle et la quincaillerie d'un profil ne changent que par `creer_quincaillerie` / `rejoindre_quincaillerie`.
- **Tests** : `npm run test:db` rejoue 33 scénarios sur un vrai PostgreSQL (PGlite).
- **Sans configuration**, l'application reste 100 % locale.
