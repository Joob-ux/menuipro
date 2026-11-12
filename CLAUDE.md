# MenuiPro — consignes pour le développement

- Langue de l'interface et des commentaires : français. Utilisateurs : menuisiers sénégalais, souvent peu à l'aise avec la lecture → icônes, chiffres, gros boutons.
- Le moteur (`src/engine/`) ne touche jamais au DOM et reste couvert par `tests/moteur.test.js`. Lancer `npm test` avant chaque commit.
- Unités internes en millimètres ; cotes saisies en centimètres dans l'interface.
- Ne jamais intégrer de code sous licence GPL (OpenCutList, opcut) : référence uniquement.
- Budget d'hébergement : moins de 10 000 FCFA/mois.
