# /pulisci-keyword — Pulisci ed elabora export Semrush

Quando questo comando viene invocato, esegui `scripts/semrush_cleaner.py` sui CSV indicati e presenta il risultato all'utente. Nessuna API key richiesta.

## Utilizzo

```
/pulisci-keyword
/pulisci-keyword --brand-varianti "falconeri, falco neri"
/pulisci-keyword --tipo-query brand --brand-varianti "falconeri"
/pulisci-keyword --raggruppamento per-data
/pulisci-keyword --trova-varianti-brand --brand-varianti "falconeri"
```

## Flusso

### Step 1 — Verifica i CSV in `input/`
I file devono rispettare il pattern `[brand]-organic.Positions-[cc]-[YYYYMMDD][suffisso].csv` (es. `falconeri.com-organic.Positions-it-20260615-2026-06-15T08_02_07Z.csv`). File con nome diverso vengono ignorati dallo script (loggati come `⏭ Ignorato`).

Ogni CSV deve contenere le colonne Keyword, Position, Search Volume, URL (alias accettati in `COLUMN_ALIASES` dentro `scripts/semrush_cleaner.py`, case-insensitive). Un CSV con colonne mancanti viene **saltato** (non blocca gli altri file) — controlla sempre il log e segnala all'utente eventuali file saltati.

### Step 2 — Chiedi solo i parametri rilevanti alla richiesta
- **Raggruppamento**: `consolidato` (default, un foglio per brand+mercato) o `per-data` (un foglio per ogni data di export)
- **Tipo query**: `tutte` (default), `brand`, `not-brand`
- **URL esclusi** / **URL di confronto**: opzionali, chiedi solo se pertinenti

### Step 3 — Conferma il nome brand rilevato
```bash
python scripts/semrush_cleaner.py --mode detect-brand --input-dir input
```
Per ogni brand distinto rilevato (log `🏷 Brand rilevato: '...' (chiave: ...) — N file`), chiedi conferma all'utente (es. con opzioni Sì / No + nome corretto):

> Ho rilevato il brand **"Yamamay"** dal nome dei file. È corretto?

- Se conferma: usa il nome così com'è.
- Se corregge: annota la coppia `chiave=NomeCorretto` (la chiave è quella tra parentesi nel log) da passare poi come `--brand-nome-override "chiave=NomeCorretto"` (più coppie separate da virgola se ci sono più brand).

### Step 4 — Conferma le varianti/misspelling del brand confermato
```bash
python scripts/semrush_cleaner.py --mode detect-varianti --input-dir input --brand-nome-override "chiave=NomeCorretto"
```
(ometti `--brand-nome-override` se il nome non è stato corretto allo Step 3). Presenta le varianti auto-rilevate per ogni brand (log `🏷 Brand '...': varianti auto-rilevate: ...`) e chiedi conferma:

> Ho rilevato queste varianti/misspelling di "Yamamay": iamamai, jamamai, yamaha, ... Sono corrette?

- Se conferma: usa la lista così com'è (nessun parametro aggiuntivo necessario, verrà ricalcolata automaticamente in fase di pulizia).
- Se corregge: chiedi la lista corretta e passa poi allo Step 5 `--brand-varianti "lista corretta separata da virgola"` insieme a `--salta-rilevamento-varianti` (disattiva il ricalcolo automatico e usa solo la lista fornita).

Se non viene rilevata nessuna variante aggiuntiva, salta questa conferma e passa direttamente allo Step 5.

### Step 5 — Esegui la pulizia
```bash
python scripts/semrush_cleaner.py \
  --mode clean \
  --input-dir input \
  --output output/Report.xlsx \
  --raggruppamento consolidato \
  --tipo-query tutte \
  --brand-nome-override "chiave=NomeCorretto" \
  --brand-varianti "falconeri, falco neri" \
  --salta-rilevamento-varianti \
  --url-esclusi "" \
  --url-confronto ""
```
Ometti `--brand-nome-override` e/o `--salta-rilevamento-varianti` se non necessari (nome/varianti già corrette dallo script).

### Step 6 — Presenta il riepilogo
Leggi il log stampato in console (file elaborati, righe valide/scartate, gruppi creati dopo dedup) e presenta una mini tabella:

```
📊 Riepilogo pulizia

| Metrica                        | Valore |
|----------------------------------|--------|
| File CSV elaborati                | ...    |
| File saltati (pattern/colonne)    | ...    |
| Gruppi (fogli) creati              | ...    |
| Righe totali (dopo dedup)          | ...    |
| Varianti brand auto-rilevate       | ...    |
```

Elenca sempre esplicitamente eventuali file saltati, non limitarti al conteggio. Indica il percorso del file `.xlsx` generato ed elenca le varianti/misspelling auto-rilevate per brand (dal log `🏷 Brand '...': varianti auto-rilevate: ...`).

### Step 7 (opzionale) — Trova varianti brand mancanti
Se invocato con `--trova-varianti-brand`, esegui invece:
```bash
python scripts/semrush_cleaner.py \
  --mode find-missing-brands \
  --input-dir input \
  --brand-varianti "falconeri, falco neri"
```
e presenta la lista di varianti trovate.

## Argomenti

| Argomento | Default | Descrizione |
|---|---|---|
| `--raggruppamento` | `consolidato` | `consolidato` oppure `per-data` |
| `--tipo-query` | `tutte` | `tutte`, `brand`, `not-brand` |
| `--brand-nome-override` | — | Correzione nome brand confermata dall'utente (Step 3), formato `chiave=NomeCorretto` separato da virgola |
| `--brand-varianti` | — | Varianti manuali (aggiuntive, o sostitutive se combinato con `--salta-rilevamento-varianti`), lista separata da virgola |
| `--salta-rilevamento-varianti` | — | Disattiva il rilevamento automatico varianti/misspelling: usa solo `--brand-varianti` (Step 4, quando l'utente corregge la lista) |
| `--url-esclusi` | — | Sottostringhe URL da escludere, separate da virgola |
| `--url-confronto` | — | Sottostringhe URL di confronto (solo dedup), separate da virgola |
| `--trova-varianti-brand` | — | Esegue `--mode find-missing-brands` invece della pulizia |
