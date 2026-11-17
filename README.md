# FilaDryer S4 per Home Assistant

Integrazione e card per l'essiccatore di filamento **SUNLU FilaDryer S4**.

Il FilaDryer S4 non ha Wi-Fi né Bluetooth: l'integrazione non lo comanda direttamente, ma tiene in Home Assistant tutto quello che serve intorno all'asciugatura:

- impostazioni (materiale, temperatura SV, °C/°F, ore, modalità MO1/MO2, umidità di riavvio, LED);
- **sequenza dei tasti** da premere sul touchscreen per arrivare a quelle impostazioni;
- **preset** salvati in Home Assistant;
- **countdown** dell'asciugatura, che sopravvive ai riavvii, con notifica e evento `filadryer_completed` a fine ciclo;
- card Lovelace `custom:filadryer-card` con la replica del display.

## Installazione con HACS

1. HACS → menu ⋮ → **Repository personalizzati** → aggiungi `https://github.com/Itstommy10/filadryer-ha`, categoria **Integrazione**.
2. Installa **FilaDryer S4** e riavvia Home Assistant.
3. Impostazioni → Dispositivi e servizi → **Aggiungi integrazione** → *FilaDryer S4*. Scegli il servizio di notifica per la fine dell'asciugatura (facoltativo; si cambia dalle opzioni).
4. Aggiungi la card a una dashboard:

```yaml
type: custom:filadryer-card
layout: vertical      # oppure horizontal: larghezza piena, tre colonne
# title: FilaDryer S4
# show_steps: true    # sequenza tasti aperta (predefinito solo in orizzontale)
```

Le opzioni si possono impostare anche dall'editor visuale della card.

La card viene caricata automaticamente dall'integrazione: non serve aggiungere risorse.

## Entità

| Entità | Cosa fa |
|---|---|
| `sensor.filadryer_s4_stato` | `idle` / `drying` / `done`; negli attributi impostazioni, preset, passi |
| `sensor.filadryer_s4_fine_asciugatura` | orario di fine del ciclo |
| `select` materiale, modalità, unità, LED, preset | impostazioni |
| `number` temperatura, durata, umidità di riavvio | impostazioni |
| `button` avvia / ferma asciugatura | countdown |

## Servizi

- `filadryer.set` – cambia una o più impostazioni
- `filadryer.start` – avvia il countdown (facoltativi `hours`, `preset`)
- `filadryer.stop` – annulla il countdown
- `filadryer.save_preset` / `load_preset` / `delete_preset` – gestione preset (`name`)

## Automazioni

A fine ciclo l'integrazione emette l'evento `filadryer_completed` (`material`, `hours`, `message`). Esempio con una presa smart:

```yaml
triggers:
  - trigger: event
    event_type: filadryer_completed
actions:
  - action: switch.turn_off
    target:
      entity_id: switch.presa_essiccatore
```
