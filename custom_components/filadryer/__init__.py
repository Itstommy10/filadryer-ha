"""FilaDryer S4: preset, sequenza tasti e countdown di asciugatura in Home Assistant."""
from __future__ import annotations

from pathlib import Path

import voluptuous as vol

from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.exceptions import HomeAssistantError
import homeassistant.helpers.config_validation as cv

from .const import (
    CARD_URL, CONF_NOTIFY, DOMAIN, HOURS_MAX, HOURS_MIN, LEDS, MATERIALS, MODES, RH_MAX,
    RH_MIN, TEMP_MAX, TEMP_MIN, UNITS, VERSION,
)
from .core import FilaDryer

PLATFORMS = [Platform.SENSOR, Platform.SELECT, Platform.NUMBER, Platform.BUTTON]

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)

SET_SCHEMA = vol.Schema({
    vol.Optional("material"): vol.In(list(MATERIALS)),
    vol.Optional("temperature"): vol.All(vol.Coerce(int), vol.Range(TEMP_MIN, TEMP_MAX)),
    vol.Optional("unit"): vol.In(UNITS),
    vol.Optional("hours"): vol.All(vol.Coerce(int), vol.Range(HOURS_MIN, HOURS_MAX)),
    vol.Optional("mode"): vol.All(vol.Coerce(str), vol.In(MODES)),
    vol.Optional("humidity"): vol.All(vol.Coerce(int), vol.Range(RH_MIN, RH_MAX)),
    vol.Optional("led"): vol.In(LEDS),
})
NAME_SCHEMA = vol.Schema({vol.Required("name"): cv.string})
START_SCHEMA = vol.Schema({
    vol.Optional("hours"): vol.All(vol.Coerce(int), vol.Range(HOURS_MIN, HOURS_MAX)),
    vol.Optional("preset"): cv.string,
})


def _dryer(hass: HomeAssistant) -> FilaDryer:
    dryer = hass.data.get(DOMAIN)
    if dryer is None:
        raise HomeAssistantError("FilaDryer S4 non configurato")
    return dryer


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    # Card servita dall'integrazione e caricata automaticamente nel frontend
    await hass.http.async_register_static_paths([
        StaticPathConfig(CARD_URL, str(Path(__file__).parent / "www" / "filadryer-card.js"), True)
    ])
    add_extra_js_url(hass, f"{CARD_URL}?v={VERSION}")

    async def h_set(call: ServiceCall) -> None:
        _dryer(hass).set(**call.data)

    async def h_start(call: ServiceCall) -> None:
        d = _dryer(hass)
        if call.data.get("preset"):
            d.load_preset(call.data["preset"])
        await d.async_start(call.data.get("hours"))

    async def h_stop(call: ServiceCall) -> None:
        await _dryer(hass).async_stop()

    async def h_save(call: ServiceCall) -> None:
        _dryer(hass).save_preset(call.data["name"])

    async def h_load(call: ServiceCall) -> None:
        _dryer(hass).load_preset(call.data["name"])

    async def h_delete(call: ServiceCall) -> None:
        _dryer(hass).delete_preset(call.data["name"])

    hass.services.async_register(DOMAIN, "set", h_set, SET_SCHEMA)
    hass.services.async_register(DOMAIN, "start", h_start, START_SCHEMA)
    hass.services.async_register(DOMAIN, "stop", h_stop)

    async def h_extend(call: ServiceCall) -> None:
        await _dryer(hass).async_extend(call.data["minutes"])

    hass.services.async_register(DOMAIN, "extend", h_extend, vol.Schema({
        vol.Required("minutes"): vol.All(vol.Coerce(int), vol.Range(-5940, 5940)),
    }))
    hass.services.async_register(DOMAIN, "save_preset", h_save, NAME_SCHEMA)
    hass.services.async_register(DOMAIN, "load_preset", h_load, NAME_SCHEMA)
    hass.services.async_register(DOMAIN, "delete_preset", h_delete, NAME_SCHEMA)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    notify = entry.options.get(CONF_NOTIFY, entry.data.get(CONF_NOTIFY)) or None
    dryer = FilaDryer(hass, notify)
    await dryer.async_load()
    hass.data[DOMAIN] = dryer
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    entry.async_on_unload(entry.add_update_listener(_async_reload))
    return True


async def _async_reload(hass: HomeAssistant, entry: ConfigEntry) -> None:
    await hass.config_entries.async_reload(entry.entry_id)


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if ok:
        dryer: FilaDryer = hass.data.pop(DOMAIN)
        dryer.async_unload()
    return ok
