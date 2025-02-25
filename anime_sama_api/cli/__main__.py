import asyncio
import logging

import httpx
from rich import get_console
from rich.logging import RichHandler

from . import config, downloader, internal_player
from .utils import safe_input, select_one, select_range

from ..top_level import AnimeSama

console = get_console()
console._highlight = False
logging.basicConfig(format="%(message)s", datefmt="[%X]", handlers=[RichHandler()])


def spinner(text: str):
    return console.status(text, spinner_style="cyan")


async def async_main():
    query = safe_input("Anime name: \033[0;34m", str)

    with spinner(f"Searching for [blue]{query}"):
        catalogues = await AnimeSama(config.URL, httpx.AsyncClient()).search(query)
    catalogue = select_one(catalogues)

    with spinner(f"Getting season list for [blue]{catalogue.name}"):
        seasons = await catalogue.seasons()
    season = select_one(seasons)

    with spinner(f"Getting episode list for [blue]{season.name}"):
        episodes = await season.episodes()

    console.print(f"\n[cyan bold underline]{season.serie_name} - {season.name}")
    selected_episodes = select_range(
        episodes, msg="Choose episode(s)", print_choices=True
    )

    if config.DOWNLOAD:
        downloader.multi_download(
            selected_episodes,
            config.DOWNLOAD_PATH,
            config.CONCURRENT_DOWNLOADS,
            config.PREFER_LANGUAGES,
        )
    else:
        command = internal_player.play_episode(
            selected_episodes[0], config.PREFER_LANGUAGES
        )
        if command is not None:
            command.wait()


def main() -> int:
    try:
        asyncio.run(async_main())
    except (KeyboardInterrupt, asyncio.exceptions.CancelledError, EOFError):
        console.print("\n[red]Exiting...")

    return 0


if __name__ == "__main__":
    main()
