import re
from itertools import product
from dataclasses import dataclass, field

from termcolor import colored

from langs import flags, LANG, LANG_ID, id2lang, lang2ids


@dataclass
class Players:
    availables: list[str] = field(default_factory=list)
    _best: str | None = field(default=None, init=False)
    index: int = field(default=1, init=False)

    @property
    def best(self) -> str | None:
        if self._best is None:
            self.set_best()
        return self._best

    def set_best(
        self, prefers: list[str] | None = None, bans: list[str] | None = None
    ) -> None:
        if not self.availables:
            return
        if prefers is None:
            prefers = []
        if bans is None:
            bans = []
        for prefer, player in product(prefers, self.availables):
            if prefer in player:
                self._best = player
                return
        for i in range(self.index, len(self.availables) + self.index):
            candidate = self.availables[i % len(self.availables)]
            if all(ban not in candidate for ban in bans):
                self._best = candidate
                return
        print(
            colored(
                f"WARNING: No suitable player found. Defaulting to {self.availables[0]}",
                "yellow",
            )
        )
        self._best = self.availables[0]


@dataclass
class Languages:
    players: dict[LANG_ID, Players]
    prefer_languages: list[LANG] = field(default_factory=list)

    def __post_init__(self):
        to_delete = [
            lang_id for lang_id in self.players if not self.players[lang_id].availables
        ]
        for lang_id in to_delete:
            del self.players[lang_id]

        if not self.players:
            print(colored(f"WARNING: No player available for {self}", "yellow"))

        self.availables: dict[LANG, list[Players]] = {}
        for lang_id, player in self.players.items():
            if self.availables.get(id2lang[lang_id]) is None:
                self.availables[id2lang[lang_id]] = []
            self.availables[id2lang[lang_id]].append(player)

    @property
    def best(self) -> str | None:
        for prefer_language in self.prefer_languages:
            for player in self.availables[prefer_language]:
                if player.availables:
                    return player.best

        for language in lang2ids:
            for player in self.availables[language]:
                if player.availables:
                    print(
                        colored(
                            f"WARNING: Language preference not respected. Defaulting to {language}",
                            "yellow",
                        )
                    )
                    return player.best

        return None

    def set_best(self, *args, **kwargs):
        for players in self.players.values():
            players.set_best(*args, **kwargs)


@dataclass
class Episode:
    languages: Languages
    serie_name: str = ""
    season_name: str = ""
    episode_name: str = ""
    _index: int = 1

    def __post_init__(self) -> None:
        self.name = self.episode_name
        self.fancy_name = self.name
        for lang in self.languages.availables:
            self.fancy_name += f" {flags[lang]}"

        self.index = self._index
        match_season_number = re.search(r"\d+", self.season_name)
        self.season_number = (
            int(match_season_number.group(0)) if match_season_number else 0
        )
        self.long_name = f"{self.season_name} - {self.episode_name}"
        self.short_name = f"{self.serie_name} S{self.season_number:02}E{self.index:02}"

    @property
    def index(self) -> int:
        return self._index

    @index.setter
    def index(self, value: int):
        self._index = value
        for players in self.languages.players.values():
            players.index = self._index

    def __str__(self):
        return self.fancy_name
