import asyncio

from termcolor import colored

import config
import downloader
import internal_player
from utils import safe_input, select_one, select_range, put_color, keyboard_inter
from anime_sama import AnimeSama


async def main():
    catalogues = await AnimeSama(config.URL).search(
        safe_input("Anime name: " + put_color("blue"), str)
    )
    catalogue = select_one(catalogues)

    seasons = await catalogue.seasons()
    season = select_one(seasons)

    episodes = await season.episodes()
    print(
        colored(
            f"\n{season.serie_name} - {season.name}",
            "cyan",
            attrs=["bold", "underline"],
        )
    )
    selected_episodes = select_range(
        episodes, msg="Choose episode(s)", print_choices=True
    )

    for episode in selected_episodes:
        episode.languages.prefer_languages = config.PREFER_LANGUAGES
        episode.languages.set_best(config.PLAYERS["prefer"], config.PLAYERS["ban"])
        
        # Display available streaming links
        print(f"\nStreaming links for {colored(episode.name, 'cyan')}:")
        for lang, players in episode.languages.players.items():
            print(f"\n{colored(lang.upper(), 'yellow')}:")
            for link in players.availables:
                print(f"  • {colored('Link', 'green')}: {link}")

    # Comment out the download and player section as we're just showing links
    # if config.DOWNLOAD:
    #     downloader.multi_download(
    #         selected_episodes, config.DOWNLOAD_PATH, config.CONCURRENT_DOWNLOADS
    #     )
    # else:
    #     internal_player.play_episode(selected_episodes[0]).wait()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, asyncio.exceptions.CancelledError, EOFError):
        keyboard_inter()
