"""Stato persistente del FilaDryer S4: impostazioni, preset e ciclo di asciugatura."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any

from homeassistant.core import CALLBACK_TYPE, HomeAssistant, callback
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.event import async_track_point_in_time
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import (
    DEFAULT_SETTINGS, EVENT_COMPLETED, HOURS_MAX, HOURS_MIN, LED_LABEL, LEDS, MATERIALS,
    MODES, RH_MAX, RH_MIN, SIGNAL_UPDATE, STATUS_DONE, STATUS_DRYING, STATUS_IDLE,
    STORAGE_KEY, STORAGE_VERSION, TEMP_MAX, TEMP_MIN, UNITS,
)

_LOGGER = logging.getLogger(__name__)


def build_steps(s: dict[str, Any]) -> list[dict[str, Any]]:
    """Sequenza di tasti da premere sul touchscreen (stessa logica del configuratore web)."""
    lcd, label, _t, note = MATERIALS[s["material"]]
    steps = [{"zone": None, "keys": ["pwr"], "text": "Accendi il dryer: 1 clic su ⏻",
              "detail": "Per spegnerlo a fine lavoro: doppio clic su ⏻."}]
    steps.append({"zone": "sv", "keys": ["set", "up", "down"],
                  "text": f"SET finché lampeggia SV, poi ▲/▼ fino a {s['temperature']} °{s['unit']}",
                  "detail": f"Temperatura target. Consigliato {note} per {label}."})
    if s["unit"] == "F":
        steps.append({"zone": "sv", "keys": ["set", "up", "down"],
                      "text": "SET: quando lampeggia °C, ▲/▼ per passare a °F",
                      "detail": "Cambia l'unità di misura del display."})
    if s["led"] != "flow":
        steps.append({"zone": "led", "keys": ["set", "up", "down"],
                      "text": f"SET: quando lampeggia SUNLU, ▲/▼ fino a LED {LED_LABEL[s['led']]}",
                      "detail": "Opzioni: scorrevole, sempre acceso, spento."})
    steps.append({"zone": "mat", "keys": ["set", "up", "down"],
                  "text": f"SET: quando lampeggia il filamento, ▲/▼ fino a {lcd}",
                  "detail": "Il dryer carica i parametri consigliati per il materiale."})
    steps.append({"zone": "time", "keys": ["set", "up", "down"],
                  "text": f"SET: quando lampeggia Time, ▲/▼ fino a {s['hours']:02d} h",
                  "detail": "Massimo 99 ore; 3–6 h vanno bene per quasi tutti i materiali."})
    if s["mode"] == "2":
        steps.append({"zone": "rh", "keys": ["set", "up", "down"],
                      "text": f"SET: quando lampeggia RH, ▲/▼ fino a {s['humidity']}%",
                      "detail": "In MO2 il dryer riparte da solo quando l'umidità risale a questa soglia e scalda fino al 25%."})
    steps.append({"zone": "mo", "keys": ["set", "up", "down"],
                  "text": f"SET: quando lampeggia MO, ▲/▼ fino a MO {s['mode']}",
                  "detail": "MO 1 = a tempo, si spegne a fine countdown." if s["mode"] == "1"
                  else "MO 2 = a umidità, dopo il countdown riparte da solo."})
    steps.append({"zone": None, "keys": [], "text": "Fatto ✔ avvia il countdown qui sotto",
                  "detail": "PV sale verso SV e il Time scende."})
    return steps


def validate(settings: dict[str, Any]) -> dict[str, Any]:
    s = dict(settings)
    if s["material"] not in MATERIALS:
        raise HomeAssistantError(f"Materiale non valido: {s['material']}")
    if s["unit"] not in UNITS or s["mode"] not in MODES or s["led"] not in LEDS:
        raise HomeAssistantError("Unità, modalità o LED non validi")
    s["temperature"] = int(s["temperature"])
    s["hours"] = int(s["hours"])
    s["humidity"] = int(s["humidity"])
    if not TEMP_MIN <= s["temperature"] <= TEMP_MAX:
        raise HomeAssistantError(f"Temperatura fuori range ({TEMP_MIN}–{TEMP_MAX})")
    if not HOURS_MIN <= s["hours"] <= HOURS_MAX:
        raise HomeAssistantError(f"Ore fuori range ({HOURS_MIN}–{HOURS_MAX})")
    if not RH_MIN <= s["humidity"] <= RH_MAX:
        raise HomeAssistantError(f"Umidità fuori range ({RH_MIN}–{RH_MAX})")
    return s


class FilaDryer:
    """Contiene tutto lo stato e lo salva in .storage/filadryer."""

    def __init__(self, hass: HomeAssistant, notify_service: str | None) -> None:
        self.hass = hass
        self.notify_service = notify_service
        self._store: Store = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self.settings: dict[str, Any] = dict(DEFAULT_SETTINGS)
        self.presets: dict[str, dict[str, Any]] = {}
        self.status = STATUS_IDLE
        self.started: datetime | None = None
        self.ends: datetime | None = None
        self.run: dict[str, Any] | None = None  # impostazioni del ciclo in corso
        self.last_done: datetime | None = None
        self._unsub: CALLBACK_TYPE | None = None

    # ---------- persistenza ----------
    async def async_load(self) -> None:
        data = await self._store.async_load() or {}
        self.settings.update(data.get("settings", {}))
        self.presets = data.get("presets", {})
        self.status = data.get("status", STATUS_IDLE)
        self.run = data.get("run")
        self.started = dt_util.parse_datetime(data["started"]) if data.get("started") else None
        self.ends = dt_util.parse_datetime(data["ends"]) if data.get("ends") else None
        self.last_done = dt_util.parse_datetime(data["last_done"]) if data.get("last_done") else None
        if self.status == STATUS_DRYING and self.ends:
            if self.ends <= dt_util.utcnow():
                await self._async_finish(notify=True, late=True)
            else:
                self._schedule()

    @callback
    def _save(self) -> None:
        self._store.async_delay_save(lambda: {
            "settings": self.settings,
            "presets": self.presets,
            "status": self.status,
            "run": self.run,
            "started": self.started.isoformat() if self.started else None,
            "ends": self.ends.isoformat() if self.ends else None,
            "last_done": self.last_done.isoformat() if self.last_done else None,
        }, 1)

    @callback
    def _changed(self) -> None:
        self._save()
        async_dispatcher_send(self.hass, SIGNAL_UPDATE)

    # ---------- impostazioni e preset ----------
    @callback
    def set(self, **changes: Any) -> None:
        new = {**self.settings, **{k: v for k, v in changes.items() if v is not None}}
        if "material" in changes and changes["material"] and "temperature" not in changes:
            new["temperature"] = MATERIALS[changes["material"]][2]
        self.settings = validate(new)
        self._changed()

    @callback
    def save_preset(self, name: str) -> None:
        name = name.strip()
        if not name or len(name) > 80:
            raise HomeAssistantError("Nome preset mancante o troppo lungo (max 80)")
        self.presets[name] = dict(self.settings)
        self._changed()

    @callback
    def load_preset(self, name: str) -> None:
        if name not in self.presets:
            raise HomeAssistantError(f"Preset non trovato: {name}")
        self.settings = validate({**DEFAULT_SETTINGS, **self.presets[name]})
        self._changed()

    @callback
    def delete_preset(self, name: str) -> None:
        if self.presets.pop(name, None) is None:
            raise HomeAssistantError(f"Preset non trovato: {name}")
        self._changed()

    # ---------- ciclo ----------
    @callback
    def _schedule(self) -> None:
        if self._unsub:
            self._unsub()
        self._unsub = async_track_point_in_time(self.hass, self._async_timer_done, self.ends)

    async def _async_timer_done(self, _now: datetime) -> None:
        self._unsub = None
        await self._async_finish(notify=True)

    async def async_start(self, hours: int | None = None) -> None:
        if hours is not None:
            self.set(hours=hours)
        self.run = dict(self.settings)
        self.started = dt_util.utcnow()
        self.ends = self.started + timedelta(hours=self.settings["hours"])
        self.status = STATUS_DRYING
        self._schedule()
        self._changed()

    async def async_stop(self) -> None:
        if self._unsub:
            self._unsub()
            self._unsub = None
        self.status = STATUS_IDLE
        self.ends = None
        self.started = None
        self.run = None
        self._changed()

    async def _async_finish(self, notify: bool, late: bool = False) -> None:
        run = self.run or self.settings
        self.status = STATUS_DONE
        self.last_done = self.ends or dt_util.utcnow()
        self.ends = None
        self._changed()
        label = MATERIALS[run["material"]][1]
        msg = f"Asciugatura {label} completata ({run['hours']} h a {run['temperature']} °{run['unit']}, MO{run['mode']})."
        if late:
            msg += " Terminata mentre Home Assistant era spento."
        self.hass.bus.async_fire(EVENT_COMPLETED, {"material": run["material"], "hours": run["hours"], "message": msg})
        if notify and self.notify_service:
            domain, _, service = self.notify_service.partition(".")
            if not service:
                domain, service = "notify", domain
            try:
                await self.hass.services.async_call(
                    domain, service, {"title": "FilaDryer S4", "message": msg}, blocking=False)
            except Exception as err:  # noqa: BLE001 - la notifica non deve bloccare
                _LOGGER.warning("Notifica FilaDryer non inviata tramite %s: %s", self.notify_service, err)

    @callback
    def async_unload(self) -> None:
        if self._unsub:
            self._unsub()
            self._unsub = None

    # ---------- dati per entità e card ----------
    @property
    def remaining(self) -> int | None:
        if self.status != STATUS_DRYING or not self.ends:
            return None
        return max(0, int((self.ends - dt_util.utcnow()).total_seconds()))

    def as_attributes(self) -> dict[str, Any]:
        lcd, label, _t, note = MATERIALS[self.settings["material"]]
        return {
            **self.settings,
            "material_label": label,
            "material_lcd": lcd,
            "material_note": note,
            "started": self.started.isoformat() if self.started else None,
            "ends": self.ends.isoformat() if self.ends else None,
            "duration": (self.run or self.settings)["hours"] * 3600,
            "run": self.run,
            "last_done": self.last_done.isoformat() if self.last_done else None,
            "presets": sorted(self.presets),
            "preset_values": self.presets,
            "materials": {k: {"lcd": v[0], "label": v[1], "temp": v[2], "note": v[3]} for k, v in MATERIALS.items()},
            "steps": build_steps(self.settings),
        }
