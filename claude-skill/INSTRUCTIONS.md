# Istruzioni operative — SEMrush Keyword Cleaner (Claude Skill)

Questo file viene scaricato a inizio sessione da `claude-skill/SKILL.md` insieme a `scripts/semrush_cleaner.py`, dal repo pubblico `https://github.com/webanalytics-filoblu/public-claude-semrush-keyword-cleaner`: è la **fonte di verità** per il comportamento della skill. Le variabili d'ambiente `$REPO` e `$BRANCH` sono già impostate dal fetch iniziale e restano valide per tutta la sessione.

Questo progetto esiste anche come **Google Apps Script legato a un Google Sheet** (`Codice.gs`, foglio "Configurazione" + cartella Drive) per chi preferisce lavorare dentro Google Sheets/Drive. Questa skill è un percorso alternativo pensato per chi vuole lo stesso risultato direttamente in chat, senza creare fogli Google né usare una cartella Drive: i CSV si caricano nella conversazione (uno per uno, o tutti insieme in un unico `.zip` — vedi Step 1) e il file pulito torna come download.

## Come ti comporti

- Parli italiano per default.
- Sei operativo: quando l'utente carica uno o più CSV, chiedi solo i parametri mancanti rilevanti alla richiesta e procedi.
- Il nome brand e le sue varianti/misspelling vengono identificati **automaticamente** dallo script, ma vanno sempre fatti confermare/correggere all'utente prima della pulizia definitiva (vedi Step 2 e 3 più sotto). Non inventare né dedurre invece URL da escludere o URL di confronto: se l'utente non li specifica e sono rilevanti per la richiesta, chiedili. Se l'utente vuole solo "pulire e deduplicare tutto" senza filtri, procedi con i default (`tutte`, nessun URL aggiuntivo).

## Colonne richieste nei CSV di input

Ogni CSV deve contenere (nomi alternativi accettati, case-insensitive):

| Colonna | Alias accettati |
|---|---|
| Keyword | `keyword`, `parola chiave`, `keywords`, `kw` |
| Position | `position`, `posizione`, `pos` |
| Search Volume | `search volume`, `volume`, `volume di ricerca`, `searches`, `sv` |
| URL | `url`, `landing page`, `pagina di destinazione`, `search result` |

Lo script verifica queste colonne **file per file**: se in un CSV mancano, quel singolo file viene **saltato** (loggato con `⚠ Colonne mancanti (...)`) mentre gli altri file proseguono — non è un errore bloccante per l'intera run. Dopo l'elaborazione, controlla sempre il log e segnala all'utente eventuali file saltati per colonne mancanti o CSV non parsabile.

## Nome file atteso

Lo script riconosce solo file che rispettano il pattern di export Semrush:

```
[brand]-organic.Positions-[cc]-[YYYYMMDD][suffisso opzionale].csv
```
Esempio: `falconeri.com-organic.Positions-it-20260615-2026-06-15T08_02_07Z.csv`

File con nome diverso vengono ignorati (loggati con `⏭ Ignorato (pattern non riconosciuto)`) — se l'utente carica CSV con nomi diversi, chiedi di rinominarli secondo questo pattern oppure indicane tu tu stesso brand/mercato/data se l'utente te li fornisce a voce (in tal caso rinomina i file scaricati prima di lanciare lo script, non modificare lo script per aggirare il pattern).

## Flusso di pulizia

### Step 1 — Raccogli CSV e parametri
Salva i CSV caricati dall'utente in `work/input/` (uno o più file, anche di brand/mercati diversi: vengono elaborati insieme in un'unica run).

**Se l'utente allega direttamente uno o più file `.csv`**: nessun passaggio aggiuntivo, sono già testo in chat — salvali in `work/input/` come sempre.

**Se l'utente allega invece un unico `.zip` contenente tutti i CSV** (comodo quando sono molti, es. più brand/mercati insieme): un archivio non è un formato "documento" che l'ambiente tenta di leggere come testo, quindi in un sandbox con esecuzione di codice (questo lo è: qui girano `pip install`/script Python) l'allegato dovrebbe finire su un percorso reale del filesystem, non nel contesto della conversazione. **Verificalo prima di usarlo** (non è una certezza in ogni sessione): cerca il file sul filesystem locale (es. `ls /mnt/user-data/uploads/` o il path equivalente di questo ambiente) prima di fare qualunque altra cosa.
- **Se lo trovi lì, integro**: estrailo con
  ```bash
  python work/scripts/extract_zip.py --zip "<path del file allegato>" --output-dir work/input
  ```
  Si ferma con errore esplicito (senza estrarre nulla) se lo zip non è valido o se un file interno ha un CRC non valido — in quel caso l'upload è arrivato incompleto: chiedi all'utente di ricaricarlo. Se va a buon fine, appiattisce automaticamente eventuali sottocartelle e scarta i metadati che macOS aggiunge comprimendo una cartella (`__MACOSX/`, `._*`, `.DS_Store`), così `work/input/` contiene solo i CSV veri, pronti per gli step successivi.
- **Se invece non trovi alcun file** (il contenuto ti è arrivato solo come testo/base64 nella conversazione): l'ipotesi non vale in questa sessione. Chiedi all'utente di allegare i CSV singolarmente (non zippati) invece di tentare di ricostruire lo zip a mano dal testo in chat — rischio di troncamento silenzioso, un archivio corrotto è più difficile da diagnosticare di un CSV troncato.

Chiedi solo i parametri necessari alla richiesta specifica:

- **Raggruppamento**: `consolidato` (un foglio per brand+mercato, default) oppure `per-data` (un foglio separato per ogni data di export)
- **Tipo query**: `tutte` (default), `brand` (solo keyword classificate come brand), `not-brand` (solo keyword NON brand)
- **URL da escludere**: sottostringhe URL da scartare a priori (es. pagine di test, categorie irrilevanti)
- **URL di confronto**: sottostringhe URL usate solo in fase di deduplicazione per non fondere righe della stessa keyword/data che puntano a landing page "concorrenti" tra loro (es. dominio brand vs dominio outlet) — non diventano una colonna nell'output, servono solo a mantenere separate le righe quando serve confrontare due URL sulla stessa keyword.

### Step 2 — Conferma il nome brand rilevato
```bash
python work/scripts/semrush_cleaner.py --mode detect-brand --input-dir work/input
```
Per ogni brand distinto rilevato (log `🏷 Brand rilevato: '...' (chiave: ...) — N file`) chiedi conferma all'utente, es.: *"Ho rilevato il brand 'Yamamay' dal nome dei file. È corretto?"* (Sì / No + nome corretto). Se corregge, annota la coppia `chiave=NomeCorretto` (la chiave è quella tra parentesi nel log).

### Step 3 — Conferma le varianti/misspelling del brand confermato
```bash
python work/scripts/semrush_cleaner.py --mode detect-varianti --input-dir work/input --brand-nome-override "chiave=NomeCorretto"
```
(ometti `--brand-nome-override` se il nome non è stato corretto allo Step 2). Presenta le varianti auto-rilevate per ogni brand (log `🏷 Brand '...': varianti auto-rilevate: ...`, typo a distanza di Levenshtein 1-2 dal nome brand) e chiedi conferma, es.: *"Ho rilevato queste varianti/misspelling: iamamai, jamamai, yamaha, ... Sono corrette?"* (Sì / No + lista corretta). Se non viene rilevata nessuna variante aggiuntiva, salta questa conferma.

- Se conferma: nessun parametro aggiuntivo, verrà ricalcolata automaticamente allo Step 4.
- Se corregge: passa allo Step 4 `--brand-varianti "lista corretta separata da virgola"` insieme a `--salta-rilevamento-varianti` (disattiva il ricalcolo automatico e usa solo la lista fornita).

### Step 4 — Esegui la pulizia
```bash
python work/scripts/semrush_cleaner.py \
  --mode clean \
  --input-dir work/input \
  --output work/output/Report.xlsx \
  --raggruppamento consolidato \
  --tipo-query tutte \
  --brand-nome-override "" \
  --brand-varianti "" \
  --url-esclusi "" \
  --url-confronto ""
```
Ometti `--brand-nome-override` e/o `--brand-varianti --salta-rilevamento-varianti` se non necessari (nome/varianti confermati così com'erano agli Step 2-3).

Lo script stampa un log dettagliato (file letti, righe valide/scartate per file, varianti brand auto-rilevate, deduplicazione per gruppo, fogli creati) e produce un `.xlsx` con:
- foglio **"Tutti i Dati"** con tutte le righe deduplicate, colonna **"Brand"** (nome brand rilevato dal file) e colonna **"Brand/Not Brand"** (classificazione automatica)
- un foglio per ciascun gruppo brand/mercato (o brand/mercato/data se `per-data`)
- foglio **"LOG"** in fondo con la cronologia dell'elaborazione, incluse le varianti/misspelling auto-rilevate per ogni brand

### Step 5 — Presenta il risultato
Fornisci sempre all'utente il file `.xlsx` generato come download. Presenta anche una mini tabella di riepilogo letta dal log dello script:

```
📊 Riepilogo pulizia

| Metrica                  | Valore |
|---------------------------|--------|
| File CSV elaborati        | ...    |
| File saltati (pattern/colonne) | ... |
| Gruppi (fogli) creati      | ...    |
| Righe totali (dopo dedup)  | ...    |
| Varianti brand auto-rilevate | ... |
```

Se ci sono stati file saltati (pattern non riconosciuto o colonne mancanti), elencali sempre esplicitamente all'utente, non limitarti al conteggio. Elenca sempre anche le varianti/misspelling auto-rilevate per ogni brand (riga di log `🏷 Brand '...': varianti auto-rilevate: ...`), così l'utente può verificare che siano corrette prima di fidarsi della colonna Brand/Not Brand.

### Step 6 — Varianti di brand mancanti (opzionale)
Se l'utente chiede di individuare varianti di brand non ancora note (typo, sotto-domini, brand line) nei CSV caricati:

```bash
python work/scripts/semrush_cleaner.py \
  --mode find-missing-brands \
  --input-dir work/input \
  --brand-varianti "falconeri, falco neri"
```

Presenta la lista trovata all'utente in formato leggibile. Ricorda che il confronto è per token (parole singole ≥4 caratteri) via distanza di Levenshtein 1-2 dal nome brand noto, quindi varianti multi-parola molto diverse dal nome brand potrebbero non emergere: se l'utente sospetta una variante specifica non rilevata, verificala a mano leggendo le keyword del CSV.

## Migliorie allo script o a queste istruzioni (solo se durante la sessione modifichi la logica)

Se l'utente ti chiede di correggere un bug o aggiungere una funzionalità, modifica `work/scripts/semrush_cleaner.py` (logica di pulizia) e/o `work/INSTRUCTIONS.md` (comportamento della skill) e verifica la modifica rieseguendola sui CSV della sessione prima di dire che è pronta.

Questa skill non ha accesso in scrittura al repo GitHub (è pubblico e il fetch non usa nessuna credenziale): la modifica resta **locale a questa sessione**. Dillo esplicitamente all'utente: *"Questa modifica resta solo in questa sessione. Per renderla permanente per tutto il team, va aperta una modifica/PR sul repo pubblico `webanalytics-filoblu/public-claude-semrush-keyword-cleaner` da qualcuno con accesso al repo (es. modificando il file direttamente su GitHub, o via Claude Code)."* Non tentare di fare push o commit al repo da questa sessione.

## Limiti noti di questa modalità

- **Nessuna scrittura sul repo**: le modifiche proposte in sessione (bugfix, nuove opzioni) restano nella sandbox e vanno riportate a mano nel repo pubblico da chi ha accesso, se si vuole renderle permanenti.
- Nessuna persistenza tra conversazioni diverse: l'utente deve ricaricare i CSV a ogni nuova sessione.
- Su un numero molto elevato di CSV/righe, valuta di suddividere il lavoro in più run (es. per brand) per stare dentro ai limiti di tempo/esecuzione della sandbox.
- Se il fetch da GitHub fallisce (rate limit, repo/branch rinominato, path errato), fermati e segnalalo all'utente invece di procedere con una versione non verificata di script o istruzioni.
- Questa skill non crea né modifica Google Sheets/Drive: produce solo un file `.xlsx` scaricabile, fornito come download in chat. Per l'integrazione diretta con una cartella Drive e il menu di Google Sheets, usa `Codice.gs` (vedi README del repo).
- **Il canale "zip allegato in chat" (Step 1) non è verificato in modo esaustivo**: si basa sull'osservazione che questo sandbox esegue codice, non su una conferma diretta che ogni allegato zip finisca sempre su un percorso reale del filesystem in ogni sessione/versione dell'ambiente. Verificalo ad ogni run invece di darlo per scontato; se non funziona, i CSV singoli restano l'opzione già sempre valida.
