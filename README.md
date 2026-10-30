# Acque di Milano

Cartografia interattiva dell'acqua visibile e invisibile di Milano, realizzata per una tesi di Laurea Magistrale in Architettura al Politecnico di Milano.

Tre modi di leggere la mappa:

- **Racconto**: una narrazione a scorrimento, dai Navigli all'acqua sepolta fino all'acqua pubblica.
- **Esplora**: tutti i livelli da accendere e spegnere, con una scheda per ogni elemento.
- **Deriva**: un percorso a piedi generato a caso che salta da un'acqua all'altra, ispirato alla *dérive* situazionista e alla psicogeografia di Guy Debord.

Lingue: italiano (principale), spagnolo, inglese.

## Livelli

| Livello | Fonte | Elementi |
|---|---|---|
| Vedovelle | Comune di Milano, Open Data (ds502) | 724 |
| Case dell'acqua | Comune di Milano, Open Data (ds625) | 54 |
| Piscine | Comune di Milano, impianti sportivi (ds34), filtrati per nuoto e attività subacquee | 30 |
| Fontane | fontanedimilano.it | 83 |
| Navigli, fiumi, rogge | Regione Lombardia, Reticolo Idrografico Regionale Unificato | 2.615 tratti |
| Navigli coperti | Tracciato indicativo ricostruito sulle strade attuali | 2 |
| Corsi d'acqua intubati | OpenStreetMap (dalla mappa di base) | — |

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

## Aggiornare i dati

```bash
pip install shapely
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
