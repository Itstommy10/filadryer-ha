"""Config flow: un solo FilaDryer, con il servizio notify da usare a fine ciclo."""
from __future__ import annotations

import voluptuous as vol

from homeassistant.config_entries import ConfigEntry, ConfigFlow, OptionsFlow
from homeassistant.core import callback
from homeassistant.helpers import selector

from .const import CONF_NOTIFY, DOMAIN, NAME


def _schema(hass, default: str = "") -> vol.Schema:
    services = sorted(f"notify.{s}" for s in hass.services.async_services().get("notify", {}))
    return vol.Schema({
        vol.Optional(CONF_NOTIFY, description={"suggested_value": default}): selector.SelectSelector(
            selector.SelectSelectorConfig(options=services, custom_value=True,
                                          mode=selector.SelectSelectorMode.DROPDOWN)),
    })


class FilaDryerConfigFlow(ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input=None):
        await self.async_set_unique_id(DOMAIN)
        self._abort_if_unique_id_configured()
        if user_input is not None:
            return self.async_create_entry(title=NAME, data=user_input)
        return self.async_show_form(step_id="user", data_schema=_schema(self.hass))

    @staticmethod
    @callback
    def async_get_options_flow(entry: ConfigEntry) -> OptionsFlow:
        return FilaDryerOptionsFlow()


class FilaDryerOptionsFlow(OptionsFlow):
    async def async_step_init(self, user_input=None):
        if user_input is not None:
            return self.async_create_entry(data=user_input)
        current = self.config_entry.options.get(CONF_NOTIFY, self.config_entry.data.get(CONF_NOTIFY, ""))
        return self.async_show_form(step_id="init", data_schema=_schema(self.hass, current or ""))
