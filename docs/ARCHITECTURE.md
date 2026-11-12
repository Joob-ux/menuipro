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
