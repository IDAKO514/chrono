# chrono

CLI de suivi du temps et de tâches. **Zéro dépendance**, 100 % local, Node ≥ 18.

Chrono évite le piège des timers pomodoro qui vous détournent :
pas de compte, pas de cloud, pas de réseau. Un fichier JSON, et c'est tout.

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

### Tâches

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

`add` refuse les doublons en cours : ajouter `Relire le code` deux fois ne crée
qu'une tâche.

### Sessions de concentration

```bash
chrono start              # démarre sans tâche
chrono start 1            # démarre sur la tâche #1
chrono start rapport      # ou sur la tâche dont le titre contient "rapport"
chrono stop               # enregistre la session et sa durée
```

- Une seule session à la fois : `start` **ferme automatiquement** la précédente.
- Une session de moins d'une minute n'est pas enregistrée (bruit inutile).
- `start`/`stop` marche aussi avec zéro tâche : les sessions restent tracées
  (`taskId: null`).

### Analyse

```bash
chrono status             # état courant + session en cours
chrono today              # journal du jour, session par session
chrono stats              # résumé + graphique
chrono stats --days 30    # fenêtre plus large (1 à 90)
chrono log --limit 20     # historique des sessions
```

### Options

| Option | Effet |
| --- | --- |
| `-h`, `--help` | aide |
| `-v`, `--version` | version |
| `--json` | sortie JSON (pour scripts et pipelines) |
| `--no-color` | désactive les couleurs |
| `--days N` | fenêtre d'analyse (bornée à 1–90) |
| `--limit N` | nombre de sessions renvoyées (borné à 1–200) |

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

## Données

- Emplacement : `~/.chrono/data.json` (Windows : `%USERPROFILE%\.chrono\data.json`)
- Surcharge : variable d'environnement `CHRONO_HOME`
- Format : lisible et versionné, écrit de façon atomique (fichier temporaire
  puis `rename`, donc jamais de `data.json` à moitié écrit)
- Réparation automatique au chargement : structure partielle, dates invalides
  et sessions orphelines sont tolérées au lieu de faire planter la commande

```bash
CHRONO_HOME=/tmp/essai chrono stats   # données jetables pour un test
```

## Architecture

```
bin/chrono.js     point d'entrée
src/cli.js        parsing des arguments, dispatch, rendu
src/logic.js      règles métier (tâches, sessions) — pur, sans E/S
src/stats.js      agrégations (jour, semaine, série, top tâches) — pur
src/store.js      persistance JSON : load, save atomique, normalisation
src/dates.js      utilitaires de dates locales et de durées
src/format.js     couleurs et rendu terminal
```

Deux règles tenues :

1. **La logique ne fait pas d'E/S.** `logic.js` et `stats.js` reçoivent un objet
   de données et le modifient ; c'est `store.js` qui touche le disque. C'est ce
   qui rend les tests possibles sans mocker quoi que ce soit.
2. **L'heure est injectée.** Chaque fonction métier reçoit `now = new Date()`,
   donc les tests sont déterministes.

## Développement

```bash
npm test                    # 53 tests, node:test natif
node --test test/stats.js   # un fichier
```

Les tests d'intégration CLI pointent `CHRONO_HOME` vers un dossier temporaire et
capturent stdout : aucun test ne touche vos vraies données.

## Licence

MIT
