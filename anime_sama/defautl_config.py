from pathlib import Path
from langs import LANG

PREFER_LANGUAGES: list[LANG] = ["VO"]
INTERNAL_PLAYER_COMMAND = "mpv".split()
DOWNLOAD_PATH = Path("~/Downloads/Anime-Sama")
DOWNLOAD = True

URL = "https://anime-sama.fr/"

# fmt: off
PLAYERS = {
    "prefer": [],
    "ban": ["anime-sama"]
}

# fmt: off
CONCURRENT_DOWNLOADS = {
    "fragment": 3,
    "video": 5
}
