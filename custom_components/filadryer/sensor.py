"""Sensori: stato del ciclo e fine prevista."""
from __future__ import annotations

from datetime import datetime

from homeassistant.components.sensor import SensorDeviceClass, SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN, STATUS_DONE, STATUS_DRYING, STATUS_IDLE
from .entity import FilaDryerEntity


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, add: AddEntitiesCallback) -> None:
    dryer = hass.data[DOMAIN]
    add([StatusSensor(dryer), EndSensor(dryer)])


class StatusSensor(FilaDryerEntity, SensorEntity):
    _attr_device_class = SensorDeviceClass.ENUM
    _attr_options = [STATUS_IDLE, STATUS_DRYING, STATUS_DONE]
    _attr_icon = "mdi:printer-3d-nozzle-heat"
    # attributi grandi: non servono nello storico
    _unrecorded_attributes = frozenset({"steps", "materials", "preset_values", "presets", "run"})

    def __init__(self, dryer) -> None:
        super().__init__(dryer, "status")

    @property
    def native_value(self) -> str:
        return self.dryer.status

    @property
    def extra_state_attributes(self) -> dict:
        return self.dryer.as_attributes()


class EndSensor(FilaDryerEntity, SensorEntity):
    _attr_device_class = SensorDeviceClass.TIMESTAMP
    _attr_icon = "mdi:timer-sand"

    def __init__(self, dryer) -> None:
        super().__init__(dryer, "end")

    @property
    def native_value(self) -> datetime | None:
        return self.dryer.ends
