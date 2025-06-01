"""
TaskTracker Javascript module registration.

Credit goes to https://github.com/asantaga/wiserHomeAssistantPlatform/blob/master/custom_components/wiser/frontend/__init__.py
for figuring out how to register javascript modules automatically.

This is a modified version of the Wiser code to work with TaskTracker.
"""

import datetime
import logging
from pathlib import Path
from typing import TYPE_CHECKING

from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant
from homeassistant.helpers.event import async_call_later

from ..const import JSMODULES, URL_BASE  # noqa: TID252

if TYPE_CHECKING:
    from homeassistant.components.lovelace import LovelaceData

_LOGGER = logging.getLogger(__name__)


class JSModuleRegistration:
    """Register Javascript modules."""

    def __init__(self, hass: HomeAssistant) -> None:
        """Initialise."""
        self.hass = hass
        self.lovelace: LovelaceData = self.hass.data.get("lovelace")

    async def async_register(self) -> None:
        """Register view_assist path."""
        await self._async_register_path()
        if self.lovelace.mode == "storage":
            await self._async_wait_for_lovelace_resources()

    # install card resources
    async def _async_register_path(self) -> None:
        """Register resource path if not already registered."""
        try:
            await self.hass.http.async_register_static_paths(
                [
                    StaticPathConfig(
                        URL_BASE,
                        str(Path(__file__).parent),
                        cache_headers=False,
                    )
                ]
            )
            _LOGGER.debug("Registered resource path from %s", Path(__file__).parent)
        except RuntimeError:
            # Runtime error is likley this is already registered.
            _LOGGER.debug("Resource path already registered")

    async def _async_wait_for_lovelace_resources(self) -> None:
        """Wait for lovelace resources to have loaded."""

        async def _check_lovelace_resources_loaded(now: datetime.datetime) -> None:  # noqa: ARG001
            if self.lovelace.resources.loaded:
                await self._async_register_modules()
            else:
                _LOGGER.debug(
                    "Lovelace resources have not yet loaded.  Trying again in 5 seconds"
                )
                async_call_later(self.hass, 5, _check_lovelace_resources_loaded)

        await _check_lovelace_resources_loaded(datetime.datetime.now())  # noqa: DTZ005

    async def _async_register_modules(self) -> None:
        """Register modules if not already registered."""
        _LOGGER.debug("Installing javascript modules")

        # Get resources already registered
        resources = [
            resource
            for resource in self.lovelace.resources.async_items()
            if resource["url"].startswith(URL_BASE)
        ]

        for module in JSMODULES:
            url = f"{URL_BASE}/{module.get('filename')}"

            card_registered = False

            for resource in resources:
                url = resource["url"]  # type: ignore[report-type-mismatch]
                if self._get_resource_path(url) == url:
                    card_registered = True
                    # check version
                    if self._get_resource_version(url) != module.get("version"):
                        # Update card version
                        _LOGGER.debug(
                            "Updating %s to version %s",
                            module.get("name"),
                            module.get("version"),
                        )
                        await self.lovelace.resources.async_update_item(
                            resource.get("id"),
                            {
                                "res_type": "module",
                                "url": url + "?v=" + module.get("version", "0"),
                            },
                        )
                        # Remove old gzipped files
                        await self.async_remove_gzip_files()
                    else:
                        _LOGGER.debug(
                            "%s already registered as version %s",
                            module.get("name"),
                            module.get("version"),
                        )

            if not card_registered:
                _LOGGER.debug(
                    "Registering %s as version %s",
                    module.get("name"),
                    module.get("version"),
                )
                await self.lovelace.resources.async_create_item(
                    {
                        "res_type": "module",
                        "url": url + "?v=" + module.get("version", "0"),
                    }
                )

    def _get_resource_path(self, url: str) -> str:
        return url.split("?")[0]

    def _get_resource_version(self, url: str) -> str:
        if version := url.split("?")[1].replace("v=", ""):
            return version
        return "0"

    async def async_unregister(self) -> None:
        """Unload lovelace module resource."""
        if self.lovelace.mode == "storage":
            for module in JSMODULES:
                url = f"{URL_BASE}/{module.get('filename')}"
                tasktracker_resources = [
                    resource
                    for resource in self.lovelace.resources.async_items()
                    if str(resource["url"]).startswith(url)
                ]
                for resource in tasktracker_resources:
                    await self.lovelace.resources.async_delete_item(resource.get("id"))

    async def async_remove_gzip_files(self) -> None:
        """Remove cached gzip files."""
        await self.hass.async_add_executor_job(self.remove_gzip_files)

    def remove_gzip_files(self) -> None:
        """Remove cached gzip files."""
        path = self.hass.config.path("custom_components/tasktracker/www")

        gzip_files = [
            filename for filename in Path(path).iterdir() if filename.suffix == ".gz"
        ]

        for file in gzip_files:
            try:
                if (
                    Path(f"{path}/{file}").stat().st_mtime
                    < Path(f"{path}/{file.with_suffix('')}.gz").stat().st_mtime
                ):
                    _LOGGER.debug("Removing older gzip file - %s", file)
                    Path(f"{path}/{file}").unlink()
            except OSError:
                pass
