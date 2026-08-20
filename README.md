# app-script-semrush-keyword-cleaner

Pulisce, deduplica e raggruppa export CSV "organic Positions" di Semrush (filtro Brand/Not Brand, confronto URL, ricerca varianti brand mancanti). Disponibile in due modalità che condividono la stessa logica:

## 1. Google Apps Script (Google Sheets + Drive)

Lo script `Codice.gs` è legato a un Google Sheet e legge i CSV da una cartella Drive.

Configurable Master Launcher ID : 1PBfbuUJEpl6m5O0KrruyGY9WhaHzVvqdN4wgubGj_GI

Esempio in xlsx caricato come "SEMrush Keyword Cleaner - Configurable Master Launcher.xlsx"

## 2. Claude (Claude Code o skill claude.ai) — nessun Google Sheet/Drive richiesto

`scripts/semrush_cleaner.py` è un porting Python della stessa logica (parsing nome file, filtri, dedup, raggruppamento), pensato per girare in chat: i CSV si caricano direttamente nella conversazione e il risultato torna come file `.xlsx` scaricabile.

- **Claude Code (locale)**: apri il repo in VS Code, avvia Claude Code e usa `/pulisci-keyword` (vedi `.claude/commands/pulisci-keyword.md` e `CLAUDE.md`). Richiede `pip install -r requirements.txt`.
- **claude.ai (skill)**: `claude-skill/SKILL.md` è una Skill che scarica sempre l'ultima versione di `scripts/semrush_cleaner.py` da questo repo GitHub pubblico a inizio sessione (non porta con sé il codice), così tutti i membri del team usano sempre la versione più aggiornata. Il repo è pubblico, quindi il fetch non richiede nessun token: `SKILL.md` è identica per tutti i colleghi e può essere condivisa liberamente.

Le due implementazioni (Apps Script e Python) sono mantenute allineate a mano: un fix o una nuova funzionalità andrebbero applicati a entrambe se rilevanti.

### Comandi CLI (`scripts/semrush_cleaner.py`)

```bash
# Pulizia
python scripts/semrush_cleaner.py \
  --mode clean \
  --input-dir input \
  --output output/Report.xlsx \
  --raggruppamento consolidato \
  --tipo-query tutte \
  --brand-varianti "falconeri, falco neri" \
  --url-esclusi "" \
  --url-confronto ""

# Ricerca varianti brand mancanti
python scripts/semrush_cleaner.py \
  --mode find-missing-brands \
  --input-dir input \
  --brand-varianti "falconeri, falco neri"
```

I CSV devono rispettare il nome file `[brand]-organic.Positions-[cc]-[YYYYMMDD][suffisso].csv` e contenere le colonne Keyword, Position, Search Volume, URL (alias accettati case-insensitive — vedi `COLUMN_ALIASES` nello script).
