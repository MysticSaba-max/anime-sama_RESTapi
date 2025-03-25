import sys
from typing import Literal, TypeVar
from itertools import zip_longest
from collections.abc import Iterable

from termcolor import colored, RESET, COLORS

T = TypeVar("T")
Color = Literal[
    "black",
    "grey",
    "red",
    "green",
    "yellow",
    "blue",
    "magenta",
    "cyan",
    "light_grey",
    "dark_grey",
    "light_red",
    "light_green",
    "light_yellow",
    "light_blue",
    "light_magenta",
    "light_cyan",
    "white",
]


def put_color(color: Color):
    return f"\033[{COLORS[color]}m"


def safe_input(text: str, transform):
    while True:
        try:
            output = input(text)
            print(RESET, end="")
            return transform(output)
        except ValueError:
            pass


def print_selection(choices: list, print_choices=True) -> None:
    if len(choices) == 0:
        sys.exit(colored("No result", "red"))
    if len(choices) == 1:
        print(f"-> {colored(choices[0], 'blue')}")
        return
    if not print_choices:
        return

    for index, choice in enumerate(choices, start=1):
        line_colors: Color = "yellow" if index % 2 == 0 else "white"
        print(
            colored(f"[{index:{len(str(len(choices)))}}]", "green"),
            colored(choice, line_colors),
        )


def select_one(choices: list[T], msg="Choose a number", **_) -> T:
    print_selection(choices)
    if len(choices) == 1:
        return choices[0]

    return choices[safe_input(f"{msg}: " + put_color("blue"), int) - 1]


def select_range(choices: list[T], msg="Choose a range", print_choices=True) -> list[T]:
    print_selection(choices, print_choices)

    if len(choices) == 1:
        return [choices[0]]

    ints = safe_input(
        f"{msg} {colored(f'[1-{len(choices)}]', 'green')}: {put_color('blue')}",
        lambda string: tuple(map(int, string.split("-"))),
    )
    if len(ints) == 1:
        return [choices[ints[0] - 1]]

    return choices[ints[0] - 1 : ints[1]]


def keyboard_inter():
    print(colored("\nExiting...", "red"))
    sys.exit()


# By Mike Müller (https://stackoverflow.com/a/38059462)
def zip_varlen(*iterables: list[Iterable[T]], sentinel=object()) -> list[list[T]]:
    return [
        [entry for entry in iterable if entry is not sentinel]
        for iterable in zip_longest(*iterables, fillvalue=sentinel)
    ]


def split_and_strip(string: str, delimiter: str) -> list[str]:
    return [part.strip() for part in string.split(delimiter)]


def remove_quotes(string: str) -> str:
    if string[0] == string[-1] and string[0] in ["'", '"']:
        string = string[1:-1]
    return string
