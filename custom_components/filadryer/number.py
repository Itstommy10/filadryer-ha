"""Number: temperatura, ore, umidità di riavvio."""
from __future__ import annotations

from homeassistant.components.number import NumberEntity, NumberMode
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import PERCENTAGE, UnitOfTime
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN, HOURS_MAX, HOURS_MIN, RH_MAX, RH_MIN, TEMP_MAX, TEMP_MIN
from .entity import FilaDryerEntity


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, add: AddEntitiesCallback) -> None:
    d = hass.data[DOMAIN]
    add([
        SettingNumber(d, "temperature", TEMP_MIN, TEMP_MAX, None, "mdi:thermometer"),
        SettingNumber(d, "hours", HOURS_MIN, HOURS_MAX, UnitOfTime.HOURS, "mdi:timer-outline"),
        SettingNumber(d, "humidity", RH_MIN, RH_MAX, PERCENTAGE, "mdi:water-percent"),
    ])


class SettingNumber(FilaDryerEntity, NumberEntity):
    _attr_mode = NumberMode.BOX
    _attr_native_step = 1

    def __init__(self, dryer, key, lo, hi, unit, icon) -> None:
        super().__init__(dryer, key)
        self._key = key
        self._attr_native_min_value = lo
        self._attr_native_max_value = hi
        self._attr_native_unit_of_measurement = unit
        self._attr_icon = icon

    @property
    def native_unit_of_measurement(self):
        if self._key == "temperature":
            return "°" + self.dryer.settings["unit"]
        return self._attr_native_unit_of_measurement

    @property
    def native_value(self) -> float:
        return self.dryer.settings[self._key]

    async def async_set_native_value(self, value: float) -> None:
        self.dryer.set(**{self._key: int(value)})
