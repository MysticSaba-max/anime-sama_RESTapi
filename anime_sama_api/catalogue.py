import re

from httpx import AsyncClient

from .season import Season


class Catalogue:
    def __init__(self, url: str, name="", client: AsyncClient | None = None) -> None:
        self.url = url + "/" if url[-1] != "/" else url
        self.name = name or url.split("/")[-2]
        self.site_url = "/".join(url.split("/")[:3]) + "/"
        self.client = client or AsyncClient()

    async def seasons(self) -> list[Season]:
        response = await self.client.get(self.url)

        seasons = re.findall(
            r'panneauAnime\("(.+?)", *"(.+?)(?:vostfr|vf)"\);', response.text
        )

        seasons = [
            Season(
                url=self.url + link,
                name=name,
                serie_name=self.name,
                client=self.client,
            )
            for name, link in seasons
        ]

        # await asyncio.gather(*(asyncio.create_task(season.post_init()) for season in seasons))
        return seasons

    def __repr__(self):
        return f"Catalogue({self.url!r}, {self.name!r})"

    def __str__(self):
        return self.name

    def __add__(self, other):
        if not isinstance(other, str):
            raise TypeError(
                f"unsupported operand type(s) for +: 'Season' and '{type(other).__name__}'"
            )
        return str(self) + other
