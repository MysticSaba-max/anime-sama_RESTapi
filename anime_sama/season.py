from ast import literal_eval
import re
import asyncio

import httpx
from termcolor import colored
from yaspin import yaspin

from langs import lang_ids
from custom_client import CustomAsyncClient
from episode import Episode, Players, Languages
from utils import zip_varlen, split_and_strip, remove_quotes


class Season:
    def __init__(
        self,
        url: str,
        name="",
        serie_name="",
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self.pages = [url + lang + "/" for lang in lang_ids]
        self.site_url = "/".join(url.split("/")[:3]) + "/"

        self.name = name or url.split("/")[-2]
        self.serie_name = serie_name or url.split("/")[-3]

        self.client = client or CustomAsyncClient()

    async def _get_players_links_from(self, page: str) -> list[list[str]]:
        response = await self.client.get(page)

        if not response.is_success:
            return []

        match_url = re.search(r"episodes\.js\?filever=\d+", response.text)
        if not match_url:
            return []
        episodes_url = page + match_url.group(0)
        episodes_js = await self.client.get(episodes_url)

        players_list = episodes_js.text.split("[")[1:]
        players_list_links = (re.findall(r"'(.+?)'", player) for player in players_list)

        return zip_varlen(*players_list_links)

    async def _get_episodes_names_index(
        self, page: str, episodes_in_season: int, number_of_episodes: int
    ) -> dict[str, int]:
        response = await self.client.get(page)

        if not response.is_success:
            return {}

        functions = re.findall(
            r"resetListe\(\); *[\n\r]+\t*(.*?)}",
            response.text,
            re.DOTALL,
        )[-1]
        functions_list = split_and_strip(functions, ";")[:-1]

        padding = len(str(episodes_in_season))

        def episode_name_range(*args):
            # In the long term, this shouldn't have padding, block by proper sort
            return [f"Episode {n:0{padding}}" for n in range(*args)]

        episodes_name = []
        for function in functions_list:
            call_start = function.find("(")
            function, args_sting = function[:call_start], function[call_start + 1 : -1]
            args = literal_eval(args_sting + ",")  # Warning: Can crash

            match function:
                case "creerListe":
                    episodes_name += episode_name_range(int(args[0]), int(args[1]) + 1)
                case "finirListe" | "finirListeOP":
                    episodes_name += episode_name_range(
                        int(args[0]),
                        int(args[0]) + number_of_episodes - len(episodes_name),
                    )
                    break
                case "newSP":
                    episodes_name.append("Episode " + remove_quotes(args[0]))
                case "newSPF":
                    episodes_name.append(remove_quotes(args[0]))
                case _:
                    raise NotImplementedError("Please report to the developer")

        return {
            episodes_name: index for index, episodes_name in enumerate(episodes_name)
        }

    async def episodes(self) -> list[Episode]:
        with yaspin(
            text=f"Getting episode list for {colored(self.name, 'blue')}", color="cyan"
        ):

            episodes_pages = await asyncio.gather(
                *(self._get_players_links_from(page) for page in self.pages),
            )

            episodes_in_season = max(
                len(episodes_page) for episodes_page in episodes_pages
            )
            episodes_names_index = await asyncio.gather(
                *(
                    self._get_episodes_names_index(
                        page, episodes_in_season, len(episodes_page)
                    )
                    for page, episodes_page in zip(self.pages, episodes_pages)
                )
            )

            names: set[str] = set().union(
                *(language.keys() for language in episodes_names_index)
            )
            episodes = {
                name: [
                    (
                        pages[names_index[name]]
                        if names_index.get(name) is not None
                        else []
                    )
                    for pages, names_index in zip(episodes_pages, episodes_names_index)
                ]
                for name in names
            }

            # TODO: Index: 1-last episode numbered. HS number after that.
            return [
                Episode(
                    Languages(
                        {
                            lang_id: Players(players)
                            for lang_id, players in zip(lang_ids, players_links)
                        }
                    ),
                    self.serie_name,
                    self.name,
                    name,
                    index,
                )
                for index, (name, players_links) in enumerate(
                    sorted(episodes.items()), start=1
                )
            ]

    def __repr__(self):
        return f"Season({self.vf_url[:-3]!r}, {self.name!r})"

    def __str__(self):
        return self.name

    def __add__(self, other):
        if not isinstance(other, str):
            raise TypeError(
                f"unsupported operand type(s) for +: 'Season' and '{type(other).__name__}'"
            )
        return str(self) + other
