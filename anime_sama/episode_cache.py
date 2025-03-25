import json
import os
from pathlib import Path
from typing import Optional, Dict, List
import time

class EpisodeCache:
    def __init__(self, cache_dir: str = ".episode_cache", ttl: int = 3600):
        self.cache_dir = Path(cache_dir)
        self.ttl = ttl
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def _get_cache_path(self, serie_name: str, season_name: str) -> Path:
        # Nettoyer les noms pour éviter les problèmes de caractères spéciaux
        safe_serie = "".join(c for c in serie_name if c.isalnum() or c in (' ', '-', '_')).strip()
        safe_season = "".join(c for c in season_name if c.isalnum() or c in (' ', '-', '_')).strip()
        return self.cache_dir / f"{safe_serie}_{safe_season}.json"

    def get_episodes(self, serie_name: str, season_name: str) -> Optional[List[Dict]]:
        cache_path = self._get_cache_path(serie_name, season_name)
        
        if not cache_path.exists():
            return None

        try:
            with open(cache_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                # Vérifier si le cache est expiré
                if time.time() - data['timestamp'] > self.ttl:
                    return None
                return data['episodes']
        except Exception:
            return None

    def save_episodes(self, serie_name: str, season_name: str, episodes_data: List[Dict]):
        cache_path = self._get_cache_path(serie_name, season_name)
        
        data = {
            'timestamp': time.time(),
            'episodes': episodes_data
        }
        
        try:
            with open(cache_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"Erreur lors de la sauvegarde du cache: {e}")