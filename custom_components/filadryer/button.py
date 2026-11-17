"""Pulsanti: avvia e ferma il countdown."""
from __future__ import annotations

from homeassistant.components.button import ButtonEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN
from .entity import FilaDryerEntity


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, add: AddEntitiesCallback) -> None:
    d = hass.data[DOMAIN]
    add([StartButton(d), StopButton(d)])


class StartButton(FilaDryerEntity, ButtonEntity):
    _attr_icon = "mdi:play"

    def __init__(self, dryer) -> None:
        super().__init__(dryer, "start")

    async def async_press(self) -> None:
        await self.dryer.async_start()


class StopButton(FilaDryerEntity, ButtonEntity):
    _attr_icon = "mdi:stop"

    def __init__(self, dryer) -> None:
        super().__init__(dryer, "stop")

    async def async_press(self) -> None:
        await self.dryer.async_stop()
