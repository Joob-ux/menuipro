# MenuiPro

Application pour les menuisiers du Sénégal : on choisit un meuble, on règle ses cotes, et l'application donne **le nombre exact de feuilles à acheter, le plan de découpe, les perçages, la liste d'achat chiffrée, la vue 3D et le devis du client**.

## Ce que fait l'application

| Fonction | Détail |
| --- | --- |
| 60 meubles paramétrables | Armoires, dressing, lits, mur TV, îlot de cuisine, vestiaire à casiers, poste de coiffure, déco murale (mur en tasseaux, claustra, panneau LED), bois massif… construits par un moteur à blocs (caisse, tiroirs, étagères, portes, plateaux) |
| Découpe | Optimisation en guillotine (coupes de bout en bout, comme à la scie à panneaux), trait de scie réglable, feuilles 2440 × 1220 |
| Perçages | Vis Ø4, tourillons Ø8, taquets Ø5, charnières Ø35, placés automatiquement aux assemblages |
| Export CNC | Un ZIP par meuble : DXF et SVG par feuille (calques découpe et perçages), liste de débit CSV |
| 3D | Rotation au doigt, portes et tiroirs qui s'ouvrent au toucher, perçages visibles |
| Achat | Liste chiffrée avec les prix de la quincaillerie, commande envoyée sur WhatsApp |
| Devis | Matériel + main-d'œuvre + pose + marge, image du devis à partager sur WhatsApp |
| Projets | Enregistrement, réouverture et suivi (devis, commandé, livré) |
| Hors-ligne | Application installable (PWA) : fonctionne sans réseau après la première visite |

## Démarrer

```bash
npm install
npm run dev      # serveur local
npm test         # tests du moteur (249) et des règles de sécurité (65)
npm run build    # version de production dans dist/
```

## Organisation du code

```
src/
  engine/          moteur de calcul, sans interface (testé)
    blocs.js       caisse, zones, tiroirs, portes, plateaux, lits
    recettes.js    les 60 meubles
    decoupe.js     optimisation guillotine
    percages.js    détection des assemblages et perçages
    outils.js      outils et visserie
  export/cnc.js    SVG, DXF, ZIP
  main.js          interface
  styles.css
public/            manifest, service worker, icônes
tests/             tests automatiques du moteur
docs/              architecture et décisions
```

## Hébergement

Site statique sur Render (offre gratuite), déployé automatiquement à chaque `push` sur `main`.

## Propriété

© 2026 Mouhamadou Moukhtar Diop / Xelkoom Valley. Tous droits réservés. Voir [LICENSE](LICENSE).
