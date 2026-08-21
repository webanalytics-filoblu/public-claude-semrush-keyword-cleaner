---
name: semrush-keyword-cleaner
description: Pulisce, deduplica e raggruppa in un file Excel gli export "organic Positions" di Semrush caricati in chat (CSV per brand/mercato/data). Usa questa skill quando l'utente carica uno o più CSV Semrush e chiede di pulirli, deduplicarli, filtrarli per Brand/Not Brand o di trovare varianti di brand mancanti.
---

# SEMrush Keyword Cleaner (Claude Skill)

Questo file è solo un **bootstrap**: scarica lo script di pulizia e le istruzioni operative complete dal repo GitHub pubblico del progetto, poi segue quelle istruzioni per il resto della sessione. Non contiene la logica del task, così non va mai modificato quando qualcosa cambia — si aggiorna solo il repo.

Repo: `https://github.com/webanalytics-filoblu/public-claude-semrush-keyword-cleaner`

Il repo è **pubblico**: il fetch non richiede nessun token né altra credenziale. Questa copia di `SKILL.md` è identica per tutti i colleghi e può essere condivisa liberamente.

## Step 0 — Setup e fetch (SEMPRE, a inizio sessione)

```bash
export REPO="webanalytics-filoblu/public-claude-semrush-keyword-cleaner"
export BRANCH="main"

mkdir -p work/scripts
curl -sL "https://raw.githubusercontent.com/$REPO/$BRANCH/scripts/semrush_cleaner.py" \
  -o work/scripts/semrush_cleaner.py

curl -sL "https://raw.githubusercontent.com/$REPO/$BRANCH/scripts/extract_zip.py" \
  -o work/scripts/extract_zip.py

curl -sL "https://raw.githubusercontent.com/$REPO/$BRANCH/claude-skill/INSTRUCTIONS.md" \
  -o work/INSTRUCTIONS.md

pip install -q openpyxl
```

Verifica prima di proseguire, senza dare per scontato che il fetch sia andato a buon fine:

- `work/scripts/semrush_cleaner.py` deve iniziare con `#!/usr/bin/env python3`
- `work/scripts/extract_zip.py` deve iniziare con `#!/usr/bin/env python3`
- `work/INSTRUCTIONS.md` deve iniziare con `#`

Se uno dei tre file contiene invece un messaggio di errore (404, rate limit, path errato) o non rispetta questo formato, mostra l'errore all'utente invece di continuare.

## Step 1 — Segui `work/INSTRUCTIONS.md`

Leggi il contenuto di `work/INSTRUCTIONS.md` (es. `cat work/INSTRUCTIONS.md`) e seguilo per **tutto il resto della sessione**: contiene comportamento, colonne richieste nei CSV, pattern nome file, flusso di pulizia, gestione varianti brand ed eventuali limiti noti. Le variabili `$REPO` e `$BRANCH` definite qui sopra restano valide e vanno riusate come indicato in quel file.
