# chrono

CLI de suivi du temps et de tÃ¢ches. **ZÃ©ro dÃ©pendance**, 100 % local, Node â‰¥ 18.

Chrono Ã©vite le piÃ¨ge des timers pomodoro qui vous dÃ©tournent :
pas de compte, pas de cloud, pas de rÃ©seau. Un fichier JSON, et c'est tout.

```
  Aujourd hui      1h35 (3 sessions)
  7 derniers j     6h20 (11 sessions)
  Serie en cours   4 jour(s)
  Taches          2 ouverte(s) / 5 terminee(s)

  Activite sur 7 jours
  ven 2026-05-15 ###################     2h30
  sam 2026-05-16 #########                1h20
  auj 2026-05-18 #####                    35min
```

## Installation

```bash
git clone <votre-depot> chrono
cd chrono
npm link          # optionnel : installe la commande `chrono` globalement
```

Sans installation :

```bash
node bin/chrono.js stats
```

## Utilisation

### TÃ¢ches

```bash
chrono add "Ecrire le rapport trimestriel"
chrono ls                 # taches en cours
chrono ls done            # taches terminees
chrono ls all             # tout
chrono done 1             # par identifiant
chrono done rapport       # ou par fragment de titre (insensible a la casse)
chrono reopen 1
chrono rm 1
```

`add` refuse les doublons en cours : ajouter `Relire le code` deux fois ne crÃ©e
qu'une tÃ¢che.

### Sessions de concentration

```bash
chrono start              # dÃ©marre sans tÃ¢che
chrono start 1            # dÃ©marre sur la tÃ¢che #1
chrono start rapport      # ou sur la tÃ¢che dont le titre contient "rapport"
chrono stop               # enregistre la session et sa durÃ©e
```

- Une seule session Ã  la fois : `start` **ferme automatiquement** la prÃ©cÃ©dente.
- Une session de moins d'une minute n'est pas enregistrÃ©e (bruit inutile).
- `start`/`stop` marche aussi avec zÃ©ro tÃ¢che : les sessions restent tracÃ©es
  (`taskId: null`).

### Analyse

```bash
chrono status             # Ã©tat courant + session en cours
chrono today              # journal du jour, session par session
chrono stats              # rÃ©sumÃ© + graphique
chrono stats --days 30    # fenÃªtre plus large (1 Ã  90)
chrono log --limit 20     # historique des sessions
```

### Options

| Option | Effet |
| --- | --- |
| `-h`, `--help` | aide |
| `-v`, `--version` | version |
| `--json` | sortie JSON (pour scripts et pipelines) |
| `--no-color` | dÃ©sactive les couleurs |
| `--days N` | fenÃªtre d'analyse (bornÃ©e Ã  1â€“90) |
| `--limit N` | nombre de sessions renvoyÃ©es (bornÃ© Ã  1â€“200) |

## Automatiser

Toutes les commandes de lecture acceptent `--json`, ce qui rend `chrono`
utilisable dans un shell :

```bash
# alerte si moins de 2h de concentration aujourd'hui
MIN=$(chrono stats --json | node -pe "JSON.parse(require('fs').readFileSync(0)).todayMinutes")
[ "$MIN" -lt 120 ] && echo "Pense a te poser."

# exporter la semaine en CSV
chrono log --json --limit 200 | node -e "
  const s = JSON.parse(require('fs').readFileSync(0));
  console.log('jour;debut;minutes');
  for (const x of s) console.log([x.day, x.startedAt, x.minutes].join(';'));
"
```

## DonnÃ©es

- Emplacement : `~/.chrono/data.json` (Windows : `%USERPROFILE%\.chrono\data.json`)
- Surcharge : variable d'environnement `CHRONO_HOME`
- Format : lisible et versionnÃ©, Ã©crit de faÃ§on atomique (fichier temporaire
  puis `rename`, donc jamais de `data.json` Ã  moitiÃ© Ã©crit)
- RÃ©paration automatique au chargement : structure partielle, dates invalides
  et sessions orphelines sont tolÃ©rÃ©es au lieu de faire planter la commande

```bash
CHRONO_HOME=/tmp/essai chrono stats   # donnÃ©es jetables pour un test
```

## Architecture

```
bin/chrono.js     point d'entrÃ©e
src/cli.js        parsing des arguments, dispatch, rendu
src/logic.js      rÃ¨gles mÃ©tier (tÃ¢ches, sessions) â€” pur, sans E/S
src/stats.js      agrÃ©gations (jour, semaine, sÃ©rie, top tÃ¢ches) â€” pur
src/store.js      persistance JSON : load, save atomique, normalisation
src/dates.js      utilitaires de dates locales et de durÃ©es
src/format.js     couleurs et rendu terminal
```

Deux rÃ¨gles tenues :

1. **La logique ne fait pas d'E/S.** `logic.js` et `stats.js` reÃ§oivent un objet
   de donnÃ©es et le modifient ; c'est `store.js` qui touche le disque. C'est ce
   qui rend les tests possibles sans mocker quoi que ce soit.
2. **L'heure est injectÃ©e.** Chaque fonction mÃ©tier reÃ§oit `now = new Date()`,
   donc les tests sont dÃ©terministes.

## DÃ©veloppement

```bash
npm test                    # 57 tests, node:test natif
node --test test/stats.js   # un fichier
```

Les tests d'intÃ©gration CLI pointent `CHRONO_HOME` vers un dossier temporaire et
capturent stdout : aucun test ne touche vos vraies donnÃ©es.

## Licence

MIT
