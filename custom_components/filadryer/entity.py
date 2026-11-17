"""Entità base del FilaDryer S4."""
from __future__ import annotations

from homeassistant.core import callback
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity import Entity

from .const import DOMAIN, NAME, SIGNAL_UPDATE, VERSION
from .core import FilaDryer


class FilaDryerEntity(Entity):
    _attr_has_entity_name = True
    _attr_should_poll = False

    def __init__(self, dryer: FilaDryer, key: str) -> None:
        self.dryer = dryer
        self._attr_translation_key = key
        self._attr_unique_id = f"{DOMAIN}_{key}"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, "s4")}, name=NAME, manufacturer="SUNLU",
            model="FilaDryer S4", sw_version=VERSION,
        )

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(async_dispatcher_connect(self.hass, SIGNAL_UPDATE, self._refresh))

    @callback
    def _refresh(self) -> None:
        self.async_write_ha_state()
