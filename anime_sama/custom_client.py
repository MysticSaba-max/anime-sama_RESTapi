import hishel


class CustomAsyncClient(hishel.AsyncCacheClient):
    def __init__(self, *args, **kwargs):
        customs = {
            "timeout": 180.0,
            "storage": hishel.AsyncFileStorage(ttl=3600),
        }
        customs.update(kwargs)

        super().__init__(*args, **customs)

    async def request(self, *args, **kwargs):
        if kwargs.get("extensions") is None:
            kwargs["extensions"] = {"force_cache": True}

        response = await super().request(*args, **kwargs)

        """if response.extensions["from_cache"]:
            print("Cache hit")"""

        return response