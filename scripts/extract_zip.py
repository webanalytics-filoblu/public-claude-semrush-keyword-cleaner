#!/usr/bin/env python3
"""
Verifica ed estrae uno zip di CSV Semrush allegato direttamente in chat, come
alternativa a caricare i CSV uno per uno (vedi claude-skill/INSTRUCTIONS.md, Step 1).

Controlla il CRC32 interno di ogni file dello zip prima di estrarre
(zipfile.testzip()): un archivio con CRC non validi significa upload arrivato
incompleto/troncato, e in quel caso lo script si ferma senza estrarre nulla, invece
di lasciare in giro un CSV parziale.

L'estrazione e' "appiattita": ogni CSV finisce direttamente in --output-dir (basename,
niente sottocartelle), perche' semrush_cleaner.py scopre i file con una scansione non
recursiva della cartella di input. Se lo zip avvolge i CSV in una sottocartella
(comportamento predefinito di molti tool "comprimi cartella"), un extractall normale
li piazzerebbe un livello troppo in profondita'. Scarta anche i metadati che macOS
aggiunge comprimendo una cartella (__MACOSX/, ._nomefile, .DS_Store), altrimenti
indistinguibili da un CSV vero una volta appiattiti.

Uso:
    python scripts/extract_zip.py \
        --zip /mnt/user-data/uploads/semrush_export.zip \
        --output-dir work/input
"""

import argparse
import sys
import zipfile
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description="Verifica CRC ed estrae uno zip di CSV Semrush")
    parser.add_argument("--zip", required=True, help="path locale dello zip allegato in chat")
    parser.add_argument("--output-dir", required=True, help="cartella di destinazione (es. work/input)")
    args = parser.parse_args()

    zip_path = Path(args.zip)
    if not zip_path.exists():
        print(f"File non trovato: {zip_path}", file=sys.stderr)
        sys.exit(1)

    if not zipfile.is_zipfile(zip_path):
        print(f"Non è un archivio zip valido: {zip_path}", file=sys.stderr)
        sys.exit(1)

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(zip_path) as zf:
        names = zf.namelist()
        if not names:
            print(f"Zip vuoto: {zip_path}", file=sys.stderr)
            sys.exit(1)

        bad_file = zf.testzip()
        if bad_file is not None:
            print(
                f"CRC non valido per '{bad_file}': l'upload è arrivato incompleto o troncato. "
                "Chiedi all'utente di ricaricare lo zip, non procedere con un'estrazione parziale.",
                file=sys.stderr,
            )
            sys.exit(1)

        extracted = []
        seen_basenames = {}
        for info in zf.infolist():
            if info.is_dir():
                continue
            name = info.filename
            basename = Path(name).name
            if name.startswith("__MACOSX/") or basename.startswith("._") or basename == ".DS_Store":
                continue
            if not basename:
                continue
            if basename in seen_basenames:
                print(
                    f"Nome file duplicato dopo l'appiattimento: '{seen_basenames[basename]}' e '{name}' "
                    f"finirebbero entrambi in {output_dir / basename}. Rinomina i file nello zip ed evita "
                    "cartelle con lo stesso nome file, poi ricarica.",
                    file=sys.stderr,
                )
                sys.exit(1)
            seen_basenames[basename] = name
            with zf.open(info) as src, open(output_dir / basename, "wb") as dst:
                dst.write(src.read())
            extracted.append(basename)

    if not extracted:
        print(f"Nessun file utile nello zip dopo aver scartato cartelle/metadati: {zip_path}", file=sys.stderr)
        sys.exit(1)

    non_csv = [n for n in extracted if not n.lower().endswith(".csv")]
    if non_csv:
        print(f"Attenzione: nello zip ci sono file non CSV, estratti comunque: {non_csv}", file=sys.stderr)

    print(f"CRC verificati, {len(extracted)} file estratti in {output_dir}:")
    for name in extracted:
        print(f"  {name}")


if __name__ == "__main__":
    main()
