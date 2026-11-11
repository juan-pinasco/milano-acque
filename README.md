# Acque di Milano

Cartografia interattiva dell'acqua visibile e invisibile di Milano, realizzata per la tesi di Laurea Magistrale in Architettura di **Ana Clara Pinasco**, Politecnico di Milano.

Tre modi di leggere la mappa:

- **Racconto**: una narrazione a scorrimento, dai Navigli all'acqua sepolta fino all'acqua pubblica.
- **Esplora**: tutti i livelli da accendere e spegnere, con una scheda per ogni elemento.
- **Deriva**: un percorso a piedi generato a caso che salta da un'acqua all'altra, ispirato alla *dérive* situazionista e alla psicogeografia di Guy Debord.

Lingue: italiano (principale), spagnolo, inglese.

## Livelli

Solo fonti ufficiali (Comune di Milano, Regione Lombardia) e fontanedimilano.it. I livelli seguono i tre cicli dell'acqua della tesi, dal più grande e naturale al più piccolo e quotidiano.

**1. L'acqua del territorio** · ciclo aperto, attraversa la città da nord a sud

| Livello | Fonte |
|---|---|
| Fiumi e torrenti | Regione Lombardia, RIRU: Reticolo Idrico Principale (RIP) |
| Fontanili e risorgive | Regione Lombardia, RIRU: corsi del RIB e del RIM chiamati "Fontanile…" |
| Navigli e rogge | Regione Lombardia, RIRU: Reticolo di Bonifica (RIB, con i tre navigli) e Minore (RIM) |
| Navigli coperti | Tracciato indicativo, non ufficiale (spento all'avvio, da confermare) |

**2. L'acqua contenuta in città** · ciclo chiuso

| Livello | Fonte |
|---|---|
| Laghetti e cave | Regione Lombardia, Database Topografico (specchi d'acqua); nomi dei parchi dal Comune (ds89) |
| Fontane ornamentali | fontanedimilano.it |
| Piscine comunali all'aperto | Comune di Milano, centri balneari (ds32) e impianti sportivi (ds34); stato nell'estate 2026 dalla tesi |

**3. L'acqua di consumo urbano** · ciclo integrato

| Livello | Fonte |
|---|---|
| Case dell'acqua | Comune di Milano, Open Data (ds625) |
| Vedovelle | Comune di Milano, Open Data (ds502) |

La mappa di base usa l'immagine satellitare Esri e, solo come riferimento, strade e nomi di OpenStreetMap.

## Struttura

```
index.html          pagina
css/style.css       stile
js/app.js           logica principale (mappa, modalità, schede)
js/layers.js        configurazione dei livelli e colori
js/basemap.js       stile della mappa di base
js/i18n.js          testi nelle tre lingue, racconto e consegne della deriva
js/deriva.js        generatore della deriva
data/               GeoJSON già elaborati
scripts/build_data.py   scarica le fonti ed elabora i dati
```

È un sito statico, senza build: basta servire la cartella.

```bash
python3 -m http.server 8000
```

Poi aprire http://localhost:8000.

## Pubblicare una modifica

I browser conservano CSS e JavaScript per 10 minuti. Dopo ogni modifica, aumentare il numero `?v=` in `index.html` (due volte) e negli `import` in cima a `js/app.js`, così tutti vedono subito la versione nuova.

## Versione su claude.ai (anteprima)

Le pagine di claude.ai non possono caricare risorse da altri siti. `scripts/build_artifact.py` prepara in `dist-artifact/` (esclusa da git) una versione con la mappa di base, i caratteri e lo stile di MapLibre già dentro, per l'area di Milano fino allo zoom 13:

```bash
python3 scripts/build_artifact.py
```

`dist-artifact/files.json` elenca i file da pubblicare accanto alla pagina.

## Aggiornare i dati

```bash
pip install shapely pyproj
python3 scripts/build_data.py
```

Lo script salva le fonti originali in `data-raw/` (esclusa da git) e rigenera `data/`. Per scaricarle di nuovo, cancellare `data-raw/`.

## Aggiungere un livello

1. Mettere il GeoJSON (coordinate WGS84) in `data/`.
2. Aggiungere una voce in `LAYERS` dentro `js/layers.js` (colore, stile, gruppo).
3. Aggiungere i testi `layer.<id>` e `desc.<id>` nelle tre lingue in `js/i18n.js`.
4. Aggiungere l'id in `DRAW_ORDER` in `js/app.js`.

## Crediti

Mappa di base © OpenStreetMap contributors, servita da OpenFreeMap. Rendering con MapLibre GL JS. I dati del Comune di Milano sono rilasciati con licenza CC BY 4.0.
