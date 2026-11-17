"""Select: materiale, unità, modalità, LED, preset."""
from __future__ import annotations

from homeassistant.components.select import SelectEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import EntityCategory
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN, LEDS, MATERIALS, MODES, UNITS
from .entity import FilaDryerEntity


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, add: AddEntitiesCallback) -> None:
    d = hass.data[DOMAIN]
    add([
        SettingSelect(d, "material", list(MATERIALS), "mdi:printer-3d-nozzle"),
        SettingSelect(d, "mode", MODES, "mdi:water-percent"),
        SettingSelect(d, "unit", UNITS, "mdi:thermometer", EntityCategory.CONFIG),
        SettingSelect(d, "led", LEDS, "mdi:led-strip", EntityCategory.CONFIG),
        PresetSelect(d),
    ])


class SettingSelect(FilaDryerEntity, SelectEntity):
    def __init__(self, dryer, key, options, icon, category=None) -> None:
        super().__init__(dryer, key)
        self._key = key
        self._attr_options = options
        self._attr_icon = icon
        self._attr_entity_category = category

    @property
    def current_option(self) -> str:
        return str(self.dryer.settings[self._key])

    async def async_select_option(self, option: str) -> None:
        self.dryer.set(**{self._key: option})


class PresetSelect(FilaDryerEntity, SelectEntity):
    """Scegliere un preset carica le sue impostazioni."""

    _attr_icon = "mdi:bookmark-multiple"

    def __init__(self, dryer) -> None:
        super().__init__(dryer, "preset")

    @property
    def options(self) -> list[str]:
        return ["—", *sorted(self.dryer.presets)]

    @property
    def current_option(self) -> str:
        for name, values in self.dryer.presets.items():
            if all(str(values.get(k)) == str(v) for k, v in self.dryer.settings.items()):
                return name
        return "—"

    async def async_select_option(self, option: str) -> None:
        if option != "—":
            self.dryer.load_preset(option)
