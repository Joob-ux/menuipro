# Appli Android de MenuiPro (Play Store)

L'appli Android est une « TWA » : MenuiPro (menuipro.onrender.com) dans une coque Android, sans barre d'adresse.
Paquet : `com.xelkoomvalley.menuipro` (définitif, ne jamais le changer). Réglages : `twa-manifest.json`.

## Fabriquer l'appli
GitHub → Actions → « Appli Android (Play Store) » → Run workflow. Après 2 minutes, dans Artifacts :
- `menuipro-android` : `app-release-bundle.aab` (pour le Play Store), `app-release-signed.apk` (à installer
  directement sur un téléphone), `assetlinks.json` (lien site ↔ appli).
- `cle-android-A-GARDER` : seulement tant que la clé n'est pas dans les secrets.

## La clé de signature (une seule fois)
1. Télécharger `cle-android-A-GARDER` de la dernière fabrication réussie. La garder en deux endroits sûrs.
   Perdue = plus de mise à jour possible de l'appli sur le Play Store.
2. Settings → Secrets and variables → Actions : `ANDROID_KEYSTORE_B64` = contenu de `ANDROID_KEYSTORE_B64.txt`,
   `ANDROID_KEYSTORE_PASSWORD` = contenu de `ANDROID_KEYSTORE_PASSWORD.txt`.
3. Relancer la fabrication : elle reprend cette clé (plus de nouvel artifact de clé).

## Nouvelle version
Augmenter `appVersionCode` (+1) et `appVersionName` dans `twa-manifest.json`, puis relancer la fabrication.
Le contenu de l'appli (meubles, écrans) se met à jour tout seul avec le site : une nouvelle version Android
n'est utile que pour changer l'icône, le nom, les couleurs ou l'adresse du site.

## Lien site ↔ appli (pour enlever la barre d'adresse)
Mettre dans `public/.well-known/assetlinks.json` l'empreinte de la clé ET celle de la clé de signature de
Google Play (Play Console → Intégrité de l'appli → Signature de l'appli), puis mettre le site à jour.
