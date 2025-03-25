from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from pydantic import BaseModel
from anime_sama import AnimeSama
from custom_client import CustomAsyncClient
from episode_cache import EpisodeCache
import config
import asyncio
import hishel
import logging

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Anime-Sama API")

# Configuration du CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration du cache global
cache_client = CustomAsyncClient(
    storage=hishel.AsyncFileStorage(ttl=3600)  # Cache d'une heure
)

# Configuration du cache des épisodes
episode_cache = EpisodeCache(ttl=3600)  # Cache d'une heure

# Pydantic models pour la sérialisation
class StreamingLink(BaseModel):
    language: str
    players: List[str]

class EpisodeModel(BaseModel):
    name: str
    serie_name: str
    season_name: str
    index: int
    streaming_links: List[StreamingLink]

class SeasonModel(BaseModel):
    name: str
    serie_name: str
    url: str
    episodes: Optional[List[EpisodeModel]] = None

class CatalogueModel(BaseModel):
    name: str
    url: str
    seasons: Optional[List[SeasonModel]] = None

@app.get("/search/{query}", response_model=List[CatalogueModel])
async def search_anime(
    query: str,
    include_seasons: bool = Query(False, description="Inclure les saisons dans la réponse"),
    include_episodes: bool = Query(False, description="Inclure les épisodes dans la réponse")
):
    try:
        logger.info(f"Recherche de l'anime: {query}")
        
        client = AnimeSama(config.URL)
        client.client = cache_client
        
        results = await client.search(query)
        if not results:
            logger.info(f"Aucun résultat trouvé pour: {query}")
            return []

        catalogues = []
        for cat in results:
            try:
                catalogue_data = {
                    "name": cat.name,
                    "url": cat.url,
                    "seasons": None
                }

                if include_seasons:
                    logger.info(f"Récupération des saisons pour: {cat.name}")
                    seasons = await cat.seasons()
                    seasons_data = []

                    for season in seasons:
                        try:
                            season_data = {
                                "name": season.name,
                                "serie_name": season.serie_name,
                                "url": season.pages[0].replace("/vostfr/", ""),
                                "episodes": None
                            }

                            if include_episodes:
                                # Vérifier d'abord le cache
                                cached_episodes = episode_cache.get_episodes(
                                    season.serie_name,
                                    season.name
                                )
                                
                                if cached_episodes:
                                    logger.info(f"Utilisation du cache pour les épisodes de: {season.name}")
                                    season_data["episodes"] = cached_episodes
                                else:
                                    logger.info(f"Récupération des épisodes pour: {season.name}")
                                    episodes = await season.episodes()
                                    episodes_data = [
                                        {
                                            "name": episode.name,
                                            "serie_name": episode.serie_name,
                                            "season_name": episode.season_name,
                                            "index": episode.index,
                                            "streaming_links": [
                                                {
                                                    "language": lang,
                                                    "players": players.availables
                                                }
                                                for lang, players in episode.languages.players.items()
                                            ]
                                        }
                                        for episode in episodes
                                    ]
                                    
                                    # Sauvegarder dans le cache
                                    episode_cache.save_episodes(
                                        season.serie_name,
                                        season.name,
                                        episodes_data
                                    )
                                    
                                    season_data["episodes"] = episodes_data

                            seasons_data.append(season_data)
                        except Exception as season_error:
                            logger.error(f"Erreur lors du traitement de la saison {season.name}: {str(season_error)}")
                            continue

                    catalogue_data["seasons"] = seasons_data

                catalogues.append(CatalogueModel(**catalogue_data))
            except Exception as cat_error:
                logger.error(f"Erreur lors du traitement du catalogue {cat.name}: {str(cat_error)}")
                continue

        return catalogues

    except Exception as e:
        logger.error(f"Erreur lors de la recherche: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Une erreur est survenue lors de la recherche: {str(e)}"
        )

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Fermeture de l'application")
    await cache_client.aclose()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")

