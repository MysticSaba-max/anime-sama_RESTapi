from typing import Literal


LANG = Literal["VA", "VCN", "VF", "VJ", "VKR", "VQC", "VO"]

LANG_ID = Literal["va", "vcn", "vf", "vf1", "vf2", "vj", "vkr", "vqc", "vostfr"]

lang2ids: dict[LANG, list[LANG_ID]] = {
    "VO": ["vostfr"],
    "VA": ["va"],
    "VCN": ["vcn"],
    "VF": ["vf", "vf1", "vf2"],
    "VJ": ["vj"],
    "VKR": ["vkr"],
    "VQC": ["vqc"],
}

flags: dict[LANG | LANG_ID, str] = {
    "VO": "",
    "VA": "🇬🇧",
    "VCN": "🇨🇳",
    "VF": "🇫🇷",
    "VJ": "🇯🇵",
    "VKR": "🇰🇷",
    "VQC": "🇲🇶",
}

id2lang: dict[LANG_ID, LANG] = {
    lang_id: lang for lang, langs_id in lang2ids.items() for lang_id in langs_id
}

lang_ids = list(id2lang.keys())

for language, language_ids in lang2ids.items():
    for lang_id in language_ids:
        flags[lang_id] = flags[language]


if __name__ == "__main__":
    import re
    from pprint import pprint

    import httpx

    url = "https://anime-sama.fr/js/contenu/script_videos.js"
    page = httpx.get(url).text
    langs = {}

    matchs = re.findall(r"if\((.+)\){langue = \"(.+)\";}", page)
    for match in matchs:
        langs[match[1]] = match[0].split('"')[1::2]

    pprint(langs)
