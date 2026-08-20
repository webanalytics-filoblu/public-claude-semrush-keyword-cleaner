---
name: semrush-keyword-cleaner
description: Pulisce, deduplica e raggruppa in un file Excel gli export "organic Positions" di Semrush caricati in chat (CSV per brand/mercato/data). Usa questa skill quando l'utente carica uno o più CSV Semrush e chiede di pulirli, deduplicarli, filtrarli per Brand/Not Brand o di trovare varianti di brand mancanti.
---

# SEMrush Keyword Cleaner (Claude Skill)

Skill proprietaria dell'organizzazione (ID `be71789f-9195-4df2-83ae-88e14cdb94ef`).

Questo file è solo un **bootstrap**: configura l'accesso al repo GitHub (fonte di verità del progetto) e da lì scarica sia lo script sia le istruzioni operative complete. Non contiene la logica del task, così non va mai più modificato quando qualcosa cambia — si aggiorna solo il repo.

Repo: `https://github.com/webanalytics-filoblu/app-script-semrush-keyword-cleaner`

Questa copia è **personalizzata per un singolo collega**: contiene il suo token GitHub (sotto) e ne dichiara i permessi. Non condividerla con altri colleghi — ognuno ha la propria copia con il proprio token.

## Step 0 — Setup e fetch (SEMPRE, a inizio sessione)

Il repo è **privato**. Ogni collega ha il proprio token: alcuni sono in sola lettura, altri anche in scrittura.

**Configurazione di questa copia** (valorizzata da chi ha generato il token per questo collega — se manca o non è presente in questa sessione, chiedi prima di procedere: _"Questa copia della skill non ha un token GitHub configurato: puoi fornirlo?"_):

```bash
export REPO="webanalytics-filoblu/app-script-semrush-keyword-cleaner"
export BRANCH="main"

PERMS=$(curl -sL -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/$REPO")
export WRITE_ACCESS=$(echo "$PERMS" | python3 -c "import json,sys; print(json.load(sys.stdin).get('permissions',{}).get('push', False))")
echo "Accesso in scrittura: $WRITE_ACCESS"

mkdir -p work/scripts
curl -sL -H "Authorization: token $GITHUB_TOKEN" -H "Accept: application/vnd.github.raw+json" \
  "https://api.github.com/repos/$REPO/contents/scripts/semrush_cleaner.py?ref=$BRANCH" \
  -o work/scripts/semrush_cleaner.py

curl -sL -H "Authorization: token $GITHUB_TOKEN" -H "Accept: application/vnd.github.raw+json" \
  "https://api.github.com/repos/$REPO/contents/claude-skill/INSTRUCTIONS.md?ref=$BRANCH" \
  -o work/INSTRUCTIONS.md

pip install -q openpyxl
```

Verifica prima di proseguire, senza dare per scontato che il fetch sia andato a buon fine:

- `work/scripts/semrush_cleaner.py` deve iniziare con `#!/usr/bin/env python3`
- `work/INSTRUCTIONS.md` deve iniziare con `#`

Se uno dei due file contiene invece un messaggio di errore JSON (token invalido, path errato, rate limit) o non rispetta questo formato, mostra l'errore all'utente invece di continuare.

## Step 1 — Segui `work/INSTRUCTIONS.md`

Leggi il contenuto di `work/INSTRUCTIONS.md` (es. `cat work/INSTRUCTIONS.md`) e seguilo per **tutto il resto della sessione**: contiene comportamento, colonne richieste nei CSV, pattern nome file, flusso di pulizia, gestione varianti brand, eventuale procedura di commit e limiti noti. Le variabili `$GITHUB_TOKEN`, `$REPO`, `$BRANCH`, `$WRITE_ACCESS` definite qui sopra restano valide e vanno riusate come indicato in quel file.
