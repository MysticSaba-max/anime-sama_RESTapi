import os
import sys
import subprocess
from pathlib import Path

from termcolor import colored

from episode import Episode
from config import INTERNAL_PLAYER_COMMAND


def open_silent_process(command: list[str]) -> subprocess.Popen:
    try:

        if os.name in ("nt", "dos"):
            return subprocess.Popen(command)
        else:
            return subprocess.Popen(
                command, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL
            )

    except FileNotFoundError as e:
        sys.exit(colored(f"Error: {e}", "red"))


def play_episode(
    episode: Episode, args: list[str] | None = None
) -> subprocess.Popen | None:
    if episode.languages.best is None:
        print(colored("No player available", "red"))
        return None

    player_command = INTERNAL_PLAYER_COMMAND + [episode.languages.best]
    if args is not None:
        player_command += args

    # Check by the caller
    # if isinstance(self._sub_proc, sp.Popen):
    #     self.kill_player()

    return open_silent_process(player_command)

    # self._write_hist(entry)
    # self._start_dc_presence(entry)


def play_file(path: Path, args: list[str] | None = None) -> subprocess.Popen:
    player_command = INTERNAL_PLAYER_COMMAND + [str(path)]
    if args is not None:
        player_command += args

    return open_silent_process(player_command)
