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

        async def _check_lovelace_resources_loaded(now: datetime.datetime) -> None:
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

        # First, clean up any duplicate or malformed registrations
        await self._async_cleanup_duplicate_registrations()

        # Then, remove stale TaskTracker resources that no longer exist in JSMODULES
        await self._async_remove_stale_resources()

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
                resource_url = resource["url"]  # type: ignore[report-type-mismatch]
                if self._get_resource_path(resource_url) == url:
                    card_registered = True
                    # check version
                    if self._get_resource_version(resource_url) != module.get(
                        "version"
                    ):
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
            else:
                _LOGGER.debug(
                    "Skipping %s as it is already registered as version %s",
                    module.get("name"),
                    module.get("version"),
                )

    def _get_resource_path(self, url: str) -> str:
        return url.split("?")[0]

    def _get_resource_version(self, url: str) -> str:
        if "?" in url and "v=" in url:
            # Split by ? and get the query parameters
            query_params = url.split("?", 1)[1]
            # Look for v= parameter in the query string
            if "v=" in query_params:
                # Extract just the version part after v=
                # Handle cases where there might be other parameters after
                version_part = query_params.split("v=", 1)[1]
                # Get just the version value, split on both & and ? to handle malformed URLs
                version = version_part.split("&")[0].split("?")[0]
                return version  # noqa: RET504
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
        path = Path(__file__).parent

        gzip_files = [
            filename for filename in path.iterdir() if filename.suffix == ".gz"
        ]

        for file in gzip_files:
            try:
                if (path / file).stat().st_mtime < (
                    path / f"{file.with_suffix('')}.gz"
                ).stat().st_mtime:
                    _LOGGER.debug("Removing older gzip file - %s", file)
                    (path / file).unlink()
            except OSError:
                pass

    async def _async_cleanup_duplicate_registrations(self) -> None:
        """Clean up duplicate or malformed TaskTracker resource registrations."""
        _LOGGER.debug("Cleaning up duplicate TaskTracker resource registrations")

        # Get all TaskTracker resources
        all_tasktracker_resources = [
            resource
            for resource in self.lovelace.resources.async_items()
            if resource["url"].startswith(URL_BASE)
        ]

        if not all_tasktracker_resources:
            return

        # Group resources by base filename
        resources_by_file = {}
        for resource in all_tasktracker_resources:
            resource_url = resource["url"]
            base_path = self._get_resource_path(resource_url)

            if base_path not in resources_by_file:
                resources_by_file[base_path] = []
            resources_by_file[base_path].append(resource)

        # Clean up each file group
        total_removed = 0
        for base_path, resource_list in resources_by_file.items():
            if len(resource_list) <= 1:
                continue  # No duplicates for this file

            _LOGGER.debug(
                "Found %d registrations for %s, cleaning up duplicates",
                len(resource_list),
                base_path,
            )

            # Find the best registration (prefer clean version format)
            best_resource = None
            resources_to_remove = []

            for resource in resource_list:
                resource_url = resource["url"]

                # Check if this is a clean version format (single ?v=)
                is_clean = "?v=" in resource_url and resource_url.count("?v=") == 1

                if best_resource is None or (
                    is_clean and not best_resource.get("_is_clean", False)
                ):
                    if best_resource is not None:
                        resources_to_remove.append(best_resource)
                    best_resource = resource
                    best_resource["_is_clean"] = is_clean
                else:
                    resources_to_remove.append(resource)

            # Remove duplicate/malformed resources
            for resource in resources_to_remove:
                try:
                    await self.lovelace.resources.async_delete_item(resource.get("id"))
                    total_removed += 1
                except Exception as e:  # noqa: BLE001
                    _LOGGER.warning(
                        "Failed to remove duplicate resource %s: %s",
                        resource.get("url"),
                        e,
                    )

        if total_removed > 0:
            _LOGGER.info(
                "Cleaned up %d duplicate TaskTracker resource registrations",
                total_removed,
            )

    async def _async_remove_stale_resources(self) -> None:
        """Remove TaskTracker resources that are no longer in JSMODULES."""
        if self.lovelace.mode != "storage":
            return

        allowed_paths = {f"{URL_BASE}/{m.get('filename')}" for m in JSMODULES}

        stale = [
            resource
            for resource in self.lovelace.resources.async_items()
            if str(resource["url"]).startswith(URL_BASE)
            and self._get_resource_path(str(resource["url"])) not in allowed_paths
        ]

        if not stale:
            return

        _LOGGER.info("Removing %d stale TaskTracker resources", len(stale))
        for resource in stale:
            try:
                await self.lovelace.resources.async_delete_item(resource.get("id"))
            except Exception as e:  # noqa: BLE001
                _LOGGER.warning(
                    "Failed to remove stale resource %s: %s",
                    resource.get("url"),
                    e,
                )
