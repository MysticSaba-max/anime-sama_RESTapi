import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useLocation, useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Loader, User, Video, Star, Calendar, List, Check, FolderPlus, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import AddToListMenu from '../components/AddToListMenu';
import DetailsSkeleton from '../components/skeletons/DetailsSkeleton';
import { collection, query, where, getDocs, getDoc, updateDoc, setDoc, doc, collectionGroup } from 'firebase/firestore';
import { db } from '../config/firebase';
import { saveToHistory } from '../services/recommendationService';

const MAIN_API = import.meta.env.VITE_MAIN_API;
const BACKUP_API = import.meta.env.VITE_BACKUP_API;
const TMDB_API_KEY = 'f3d757824f08ea2cff45eb8f47ca3a1e';

interface TVShow {
  id?: string | number;
  name: string;
  overview: string;
  poster_path: string;
  first_air_date: string;
  vote_average: number;
  genres: { id: number; name: string }[];
}

interface EpisodeInfo {
  sa: string;
  epi: string;
  link: string;
}

interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
}

interface GroupedCrewMember {
  id: number;
  name: string;
  jobs: string[];
  profile_path: string | null;
}

interface CustomEpisode {
  episodeNumber: number;
  customStreamingUrl: string;
}

interface CustomSeason {
  seasonNumber: number;
  episodes: CustomEpisode[];
}

interface CustomTVShow {
  id: string;
  seasons: CustomSeason[];
}

interface WatchStatus {
  watchlist: boolean;
  favorite: boolean;
  watched: boolean;
  episodeWatchlist: { [key: string]: boolean };
  episodeWatched: { [key: string]: boolean };
}

interface CrewMember {
  id: number;
  name: string;
  job: string;
  profile_path: string | null;
}

interface Episode {
  sa: string | number;
  epi: string | number;
  link?: string;
}

const DEFAULT_IMAGE = 'https://via.placeholder.com/185x278/1F2937/FFFFFF?text=No+Image';

const groupCrewMembers = (crew: CrewMember[]): GroupedCrewMember[] => {
  const groupedMap = crew.reduce((acc, member) => {
    if (!acc.has(member.id)) {
      acc.set(member.id, {
        id: member.id,
        name: member.name,
        jobs: [member.job],
        profile_path: member.profile_path
      });
    } else {
      const existing = acc.get(member.id)!;
      if (!existing.jobs.includes(member.job)) {
        existing.jobs.push(member.job);
      }
    }
    return acc;
  }, new Map<number, GroupedCrewMember>());

  return Array.from(groupedMap.values());
};

const checkEpisodeAvailability = async (showId: string, seasonNumber: number, episodeNumber: number) => {
  try {
    // Vérifier d'abord dans Firebase
    const episodeRef = doc(db, 'series', showId, 'seasons', seasonNumber.toString(), 'episodes', episodeNumber.toString());
    const episodeDoc = await getDoc(episodeRef);
    
    if (episodeDoc.exists()) {
      return {
        isAvailable: true,
        customLinks: episodeDoc.data().customStreamingUrls || [],
        frembedAvailable: true
      };
    }

    // Vérifier Frembed
    const frembedResponse = await axios.get(`https://api.frembed.xyz/tv/check?id=${showId}&sa=${seasonNumber}&epi=${episodeNumber}`);
    const isFrembedAvailable = frembedResponse.data.status === 200 && frembedResponse.data.result.totalItems === "1";
    
    // Toujours disponible car on peut proposer VO/VOSTFR
    return {
      isAvailable: true,
      customLinks: [],
      frembedAvailable: isFrembedAvailable
    };
  } catch (error) {
    console.error('Error checking TV episode availability:', error);
    // Toujours disponible car on peut proposer VO/VOSTFR même en cas d'erreur
    return {
      isAvailable: true,
      customLinks: [],
      frembedAvailable: false
    };
  }
};

const fetchCustomTVLinks = async (showId: string, seasonNumber: number, episodeNumber: number) => {
  try {
    const availability = await checkEpisodeAvailability(showId, seasonNumber, episodeNumber);
    return {
      customLinks: availability.customLinks,
      frembedAvailable: availability.frembedAvailable,
      isAvailable: availability.isAvailable
    };
  } catch (error) {
    console.error('Error fetching TV custom links:', error);
    return { customLinks: [], frembedAvailable: false, isAvailable: false };
  }
};

const checkCustomTVLink = async (showId: string, seasonNumber: number, episodeNumber: number) => {
  return await fetchCustomTVLinks(showId, seasonNumber, episodeNumber);
};

const VideoPlayer = ({ showId, seasonNumber, episodeNumber }: { 
  showId: string;
  seasonNumber: number;
  episodeNumber: number;
}) => {
  const [videoSource, setVideoSource] = useState<string | null>(null);
  const [customSources, setCustomSources] = useState<string[]>([]);
  const [selectedSource, setSelectedSource] = useState<'primary' | 'vostfr' | number>('primary');
  const [frembedAvailable, setFrembedAvailable] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchVideoSources = async () => {
      try {
        setVideoSource(null);
        setCustomSources([]);
        setSelectedSource('primary');
        setIsLoading(true);
        
        // Vérifier la disponibilité
        const { customLinks, frembedAvailable, isAvailable } = await checkEpisodeAvailability(showId, seasonNumber, episodeNumber);
        
        setFrembedAvailable(frembedAvailable);
        
        if (frembedAvailable) {
          setVideoSource(`https://frembed.xyz/api/serie.php?id=${showId}&sa=${seasonNumber}&epi=${episodeNumber}`);
          setSelectedSource('primary');
        } else {
          // Si frembed non disponible, utiliser VO/VOSTFR
          setVideoSource(`https://vidsrc.wtf/api/3/tv/?id=${showId}&s=${seasonNumber}&e=${episodeNumber}`);
          setSelectedSource('vostfr');
        }

        if (customLinks.length > 0) {
          setCustomSources(customLinks);
        }
      } catch (error) {
        console.error('Error fetching video sources:', error);
        setFrembedAvailable(false);
        setVideoSource(`https://vidsrc.wtf/api/3/tv/?id=${showId}&s=${seasonNumber}&e=${episodeNumber}`);
        setSelectedSource('vostfr');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchVideoSources();
  }, [showId, seasonNumber, episodeNumber]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[500px] bg-gray-800 rounded-lg">
        <Loader className="w-8 h-8 animate-spin text-red-600" />
      </div>
    );
  }

  if (!frembedAvailable && customSources.length === 0 && !videoSource) {
    return (
      <div className="flex items-center justify-center h-[500px] bg-gray-800 rounded-lg">
        <p className="text-gray-400">Cet épisode n'est pas encore disponible</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!frembedAvailable && (
        <div className="bg-yellow-800/30 border border-yellow-600 p-4 rounded-lg mb-6">
          <p className="text-yellow-200 text-sm">
            Cet épisode n'est pas disponible sur la source principale, mais vous pouvez peut-être le regarder en version originale (VO/VOSTFR).
            Si malgrès tout, aucun lecteur fonctionne, vous pouvez nous contacter sur le discord.
          </p>
        </div>
      )}
    
      <div className="flex justify-center gap-4 mb-4 flex-wrap">
        {frembedAvailable && (
          <button
            onClick={() => setSelectedSource('primary')}
            className={`px-4 py-2 rounded ${
              selectedSource === 'primary' 
                ? 'bg-red-600 text-white' 
                : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            Lecteur VF
          </button>
        )}
        
        <button
          onClick={() => setSelectedSource('vostfr')}
          className={`px-4 py-2 rounded ${
            selectedSource === 'vostfr' 
              ? 'bg-red-600 text-white' 
              : 'bg-gray-700 hover:bg-gray-600'
          }`}
        >
          Lecteur VO/VOSTFR
        </button>
        
        {customSources.map((_, index) => (
          <button
            key={index}
            onClick={() => setSelectedSource(index)}
            className={`px-4 py-2 rounded ${
              selectedSource === index
                ? 'bg-red-600 text-white'
                : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            Lecteur {frembedAvailable ? index + 2 : index + 1}
          </button>
        ))}
      </div>
      
      <iframe
        src={
          selectedSource === 'primary' 
            ? videoSource || "" 
            : selectedSource === 'vostfr'
              ? `https://vidsrc.wtf/api/3/tv/?id=${showId}&s=${seasonNumber}&e=${episodeNumber}`
              : customSources[selectedSource as number]
        }
        className="w-full h-[calc(100vh-180px)] mb-32 pb-20"
        allowFullScreen
      />
    </div>
  );
};

const TVDetails: React.FC = () => {
  const [show, setShow] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const [tvShow, setTVShow] = useState<TVShow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [availableEpisodes, setAvailableEpisodes] = useState<Episode[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [selectedEpisode, setSelectedEpisode] = useState<number | null>(null);
  const [showVideo, setShowVideo] = useState(false);
  const [trailerVideoId, setTrailerVideoId] = useState<string | null>(null);
  const [cast, setCast] = useState<CastMember[]>([]);
  const [crew, setCrew] = useState<GroupedCrewMember[]>([]);
  const [showCast, setShowCast] = useState(false);
  const [showCrew, setShowCrew] = useState(false);
  const [watchProgress, setWatchProgress] = useState(0);
  const [lastWatched, setLastWatched] = useState<{ season: number; episode: number } | null>(null);
  const [frembedAvailable, setFrembedAvailable] = useState(true);
  const [watchStatus, setWatchStatus] = useState<WatchStatus>({
    watchlist: false,
    favorite: false,
    watched: false,
    episodeWatchlist: {},
    episodeWatched: {}
  });
  const [showAddToList, setShowAddToList] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean>(true);
  const [recommendations, setRecommendations] = useState<(TVShow & { isAvailable?: boolean })[]>([]);
  const [showSimilarModal, setShowSimilarModal] = useState(false);
  const [loadingSimilar, setLoadingSimilar] = useState(false);

  useEffect(() => {
    const savedSeason = searchParams.get('season');
    const savedEpisode = searchParams.get('episode');
    
    if (savedSeason && savedEpisode) {
      setSelectedSeason(Number(savedSeason));
      setSelectedEpisode(Number(savedEpisode));
    }
  }, [searchParams]);

  useEffect(() => {
    const loadWatchStatus = () => {
      const savedStatus = localStorage.getItem(`tv_${id}_status`);
      if (savedStatus) {
        setWatchStatus(JSON.parse(savedStatus));
      }
    };
    loadWatchStatus();
  }, [id]);

  const fetchTVShowDetails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tmdbResponse, customEpisodesSnapshot] = await Promise.all([
        axios.get(`https://api.themoviedb.org/3/tv/${id}`, {
          params: {
            api_key: TMDB_API_KEY,
            language: 'fr-FR',
            append_to_response: 'credits,videos'
          }
        }),
        getDocs(collectionGroup(db, 'episodes'))
      ]);

      setTVShow(tmdbResponse.data);
      
      // Récupérer le nombre de saisons depuis TMDB
      const numberOfSeasons = tmdbResponse.data.number_of_seasons;
      let allEpisodes = [];
      
      // Considérer toutes les séries comme disponibles sans vérification Frembed
      let hasContent = true;

      // Générer les épisodes pour toutes les saisons
      for (let season = 1; season <= numberOfSeasons; season++) {
        for (let episode = 1; episode <= 20; episode++) {
          allEpisodes.push({
            sa: season,
            epi: episode
          });
        }
      }

      // Ajouter les épisodes personnalisés
      customEpisodesSnapshot.forEach(doc => {
        const pathSegments = doc.ref.path.split('/');
        const seriesId = pathSegments[1];
        
        if (seriesId === id) {
          const seasonNumber = Number(pathSegments[3]);
          const episodeNumber = Number(pathSegments[5]);
          
          const exists = allEpisodes.some(ep => 
            ep.sa === seasonNumber && ep.epi === episodeNumber
          );
          
          if (!exists) {
            allEpisodes.push({
              sa: seasonNumber,
              epi: episodeNumber
            });
          }
        }
      });

      allEpisodes.sort((a, b) => {
        if (a.sa !== b.sa) {
          return a.sa - b.sa;
        }
        return a.epi - b.epi;
      });

      setAvailableEpisodes(allEpisodes);
      setFrembedAvailable(true);
      setIsAvailable(true);
      
    } catch (error) {
      console.error('Error fetching TV show details:', error);
      setError('Une erreur est survenue lors du chargement des données.');
      setFrembedAvailable(true);
      setIsAvailable(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const checkAvailability = useCallback(async () => {
    if (!id) return;
    
    try {
      // Ne pas vérifier chaque épisode au chargement de la page pour des raisons de performance
      // La vérification se fera quand l'utilisateur sélectionne un épisode spécifique
      setIsAvailable(true);
    } catch (error) {
      console.error('Error checking series availability:', error);
      setIsAvailable(false);
    }
  }, [id]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        await Promise.all([
          fetchTVShowDetails(),
          checkAvailability()
        ]);
      } catch (error) {
        console.error('Error:', error);
        setError('Une erreur est survenue lors du chargement des données.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [id, fetchTVShowDetails, checkAvailability]);

  const availableSeasons = [...new Set(availableEpisodes.map((ep) => Number(ep.sa)))].sort((a, b) => a - b);
  const episodesForSeason = availableEpisodes
    .filter((ep) => Number(ep.sa) === selectedSeason)
    .sort((a, b) => Number(a.epi) - Number(b.epi));

  const handleSeasonChange = (season: number) => {
    setSelectedSeason(season);
    setSelectedEpisode(null);
    
    const episodes = availableEpisodes.filter(ep => Number(ep.sa) === season);
    
    if (episodes.length > 0) {
      const firstEpisode = episodes[0];
      setSelectedEpisode(Number(firstEpisode.epi));
    }
  };

  const handleEpisodeChange = (episodeNumber: number | string) => {
    const epNumber = Number(episodeNumber);
    setSelectedEpisode(epNumber);
    setLastWatched({
      season: selectedSeason!,
      episode: epNumber
    });
    
    if (tvShow) {
      const continueWatching = JSON.parse(localStorage.getItem('continueWatching') || '[]');
      const updatedList = [
        {
          id: Number(id),
          title: tvShow.name,
          poster_path: tvShow.poster_path,
          media_type: 'tv',
          lastWatched: {
            season: selectedSeason,
            episode: epNumber
          },
          lastWatchedDate: new Date().toISOString()
        },
        ...continueWatching.filter((item: any) => item.id !== Number(id))
      ].slice(0, 20);
      
      localStorage.setItem('continueWatching', JSON.stringify(updatedList));
    }
  };

  const scrollLeft = (elementId: string) => {
    const element = document.getElementById(elementId);
    if (element) {
      element.scrollBy({ left: -200, behavior: 'smooth' });
    }
  };

  const scrollRight = (elementId: string) => {
    const element = document.getElementById(elementId);
    if (element) {
      element.scrollBy({ left: 200, behavior: 'smooth' });
    }
  };

  const updateWatchProgress = useCallback((progress: number) => {
    if (!tvShow) return;
    
    setWatchProgress(progress);
    const now = new Date().toISOString();
    setLastWatched({
      season: selectedSeason || 0,
      episode: selectedEpisode || 0
    });

    const continueWatching = JSON.parse(localStorage.getItem('continueWatching') || '[]');
    const updatedList = [
      {
        id: Number(id),
        name: tvShow.name,
        poster_path: tvShow.poster_path,
        media_type: 'tv',
        progress: progress,
        lastWatched: now,
        currentEpisode: {
          season: Number(selectedSeason),
          episode: Number(selectedEpisode)
        }
      },
      ...continueWatching.filter((item: any) => item.id !== Number(id))
    ].slice(0, 20);
    
    localStorage.setItem('continueWatching', JSON.stringify(updatedList));
  }, [id, tvShow, selectedSeason, selectedEpisode]);

  useEffect(() => {
    if (tvShow && selectedSeason && selectedEpisode) {
      updateWatchProgress(0);
    }
  }, [tvShow, selectedSeason, selectedEpisode, updateWatchProgress]);

  const updateWatchStatus = (type: keyof WatchStatus, value: boolean, episodeKey?: string) => {
    setWatchStatus(prev => {
      let newStatus;
      
      const itemToSave = {
        id: Number(id),
        type: 'tv',
        title: tvShow?.name || '',
        poster_path: tvShow?.poster_path || '',
        addedAt: new Date().toISOString(),
        episodeInfo: episodeKey ? {
          season: selectedSeason,
          episode: selectedEpisode
        } : undefined
      };

      if (episodeKey) {
        const episodeField = type === 'episodeWatchlist' ? 'episodeWatchlist' : 'episodeWatched';
        newStatus = {
          ...prev,
          [episodeField]: {
            ...prev[episodeField],
            [episodeKey]: value
          }
        };

        const key = `${type}_tv_episodes`;
        const existingItems = JSON.parse(localStorage.getItem(key) || '[]');

        if (value) {
          const updatedItems = [
            itemToSave,
            ...existingItems.filter((item: any) => 
              item.id !== Number(id) || 
              item.episodeInfo?.season !== selectedSeason || 
              item.episodeInfo?.episode !== selectedEpisode
            )
          ];
          localStorage.setItem(key, JSON.stringify(updatedItems));
        } else {
          const filteredItems = existingItems.filter((item: any) => 
            item.id !== Number(id) || 
            item.episodeInfo?.season !== selectedSeason || 
            item.episodeInfo?.episode !== selectedEpisode
          );
          localStorage.setItem(key, JSON.stringify(filteredItems));
        }
      } else {
        newStatus = { ...prev, [type]: value };
        
        const key = `${type}_tv`;
        const existingItems = JSON.parse(localStorage.getItem(key) || '[]');

        if (value) {
          const updatedItems = [
            itemToSave,
            ...existingItems.filter((item: any) =>
              item.id !== Number(id) || 
              item.episodeInfo?.season !== selectedSeason || 
              item.episodeInfo?.episode !== selectedEpisode
            )
          ];
          localStorage.setItem(key, JSON.stringify(updatedItems));
        } else {
          const filteredItems = existingItems.filter((item: any) =>
            item.id !== Number(id) || 
            item.episodeInfo?.season !== selectedSeason || 
            item.episodeInfo?.episode !== selectedEpisode
          );
          localStorage.setItem(key, JSON.stringify(filteredItems));
        }
      }

      localStorage.setItem(`tv_${id}_status`, JSON.stringify(newStatus));
      return newStatus;
    });
  };

  const WatchButtons = () => (
    <div className="flex flex-wrap gap-3 mt-4">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => updateWatchStatus('watchlist', !watchStatus.watchlist)}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
          watchStatus.watchlist 
            ? 'bg-red-600 text-white' 
            : 'bg-gray-800 hover:bg-gray-700'
        }`}
      >
        <List className="w-4 h-4" />
        Watchlist
      </motion.button>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => updateWatchStatus('favorite', !watchStatus.favorite)}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
          watchStatus.favorite 
            ? 'bg-red-600 text-white' 
            : 'bg-gray-800 hover:bg-gray-700'
        }`}
      >
        <Star className="w-4 h-4" />
        Favoris
      </motion.button>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => updateWatchStatus('watched', !watchStatus.watched)}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
          watchStatus.watched 
            ? 'bg-red-600 text-white' 
            : 'bg-gray-800 hover:bg-gray-700'
        }`}
      >
        <Check className="w-4 h-4" />
        Vu
      </motion.button>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowAddToList(true)}
        className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg"
      >
        <FolderPlus className="w-4 h-4" />
        Ajouter à une liste
      </motion.button>

      {showAddToList && (
        <AddToListMenu
          mediaId={Number(id)}
          mediaType="tv"
          title={tvShow?.name || ''}
          posterPath={tvShow?.poster_path || ''}
          onClose={() => setShowAddToList(false)}
        />
      )}
    </div>
  );

  useEffect(() => {
    const fetchShow = async () => {
      setIsLoading(true);
      try {
        const response = await axios.get(
          `https://api.themoviedb.org/3/tv/${id}?api_key=${TMDB_API_KEY}&append_to_response=credits,videos`
        );
        setShow(response.data);
      } catch (error) {
        console.error('Error fetching TV show:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchShow();
  }, [id]);

  const checkFrembedAvailability = async () => {
    setLoadingSimilar(true);
    try {
      // Simplement définir tous les shows comme disponibles
      const availableShows = recommendations.map(show => ({ ...show, isAvailable: true }));
      setRecommendations(availableShows);
    } catch (error) {
      console.error('Error checking availability:', error);
    } finally {
      setLoadingSimilar(false);
    }
  };

  const fetchRecommendations = async () => {
    setLoadingSimilar(true);
    try {
      const response = await axios.get(
        `https://api.themoviedb.org/3/tv/${id}/recommendations?api_key=${TMDB_API_KEY}&language=fr-FR`
      );
      setRecommendations(response.data.results.slice(0, 20));
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    } finally {
      setLoadingSimilar(false);
    }
  };

  const handleShowSimilar = async () => {
    // Charge les recommandations mais n'ouvre plus la modale
    if (recommendations.length === 0) {
      await fetchRecommendations();
      await checkFrembedAvailability();
    }
  };

  // Charger automatiquement les séries similaires lors du chargement de la page
  useEffect(() => {
    if (id && tvShow && recommendations.length === 0) {
      fetchRecommendations().then(() => checkFrembedAvailability());
    }
  }, [id, tvShow]);

  const handleEpisodeSelect = async (seasonNumber: number, episodeNumber: number) => {
    setSelectedSeason(seasonNumber);
    setSelectedEpisode(episodeNumber);
    setShowVideo(true);
    
    // Mettre à jour l'historique de visionnage
    if (tvShow) {
      const continueWatching = JSON.parse(localStorage.getItem('continueWatching') || '[]');
      const updatedList = [
        {
          id: Number(id),
          name: tvShow.name,
          poster_path: tvShow.poster_path,
          media_type: 'tv',
          currentEpisode: {
            season: seasonNumber,
            episode: episodeNumber
          },
          lastWatched: new Date().toISOString()
        },
        ...continueWatching.filter((item: any) => item.id !== Number(id))
      ].slice(0, 20);
      
      localStorage.setItem('continueWatching', JSON.stringify(updatedList));
    }
  };

  useEffect(() => {
    if (tvShow) {
      const year = tvShow.first_air_date ? new Date(tvShow.first_air_date).getFullYear() : '';
      const rating = tvShow.vote_average ? tvShow.vote_average.toFixed(1) : '';
      document.title = `${tvShow.name}`;
      
      const metaDescription = document.querySelector('meta[name="description"]');
      if (metaDescription) {
        metaDescription.setAttribute('content', 
          `Regarder ${tvShow.name} en streaming. ${tvShow.overview ? tvShow.overview.slice(0, 150) + '...' : 'Aucune description disponible.'}`
        );
      }

      let metaOgTitle = document.querySelector('meta[property="og:title"]');
      let metaOgDescription = document.querySelector('meta[property="og:description"]');
      let metaOgImage = document.querySelector('meta[property="og:image"]');

      if (!metaOgTitle) {
        metaOgTitle = document.createElement('meta');
        metaOgTitle.setAttribute('property', 'og:title');
        document.head.appendChild(metaOgTitle);
      }
      if (!metaOgDescription) {
        metaOgDescription = document.createElement('meta');
        metaOgDescription.setAttribute('property', 'og:description');
        document.head.appendChild(metaOgDescription);
      }
      if (!metaOgImage) {
        metaOgImage = document.createElement('meta');
        metaOgImage.setAttribute('property', 'og:image');
        document.head.appendChild(metaOgImage);
      }

      metaOgTitle.setAttribute('content', `${tvShow.name} (${year}) - Note: ${rating}/10`);
      metaOgDescription.setAttribute('content', 
        tvShow.overview ? tvShow.overview.slice(0, 150) + '...' : 'Aucune description disponible.'
      );
      metaOgImage.setAttribute('content', 
        tvShow.poster_path ? `https://image.tmdb.org/t/p/w500${tvShow.poster_path}` : ''
      );
    }

    return () => {
      document.title = 'Movix - Films et Séries';
      // Nettoyage des meta tags
      const tags = ['og:title', 'og:description', 'og:image'];
      tags.forEach(tag => {
        const element = document.querySelector(`meta[property="${tag}"]`);
        if (element) element.remove();
      });
    };
  }, [tvShow]);

  if (isLoading) {
    return <DetailsSkeleton />;
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader className="animate-spin h-8 w-8" />
      </div>
    );
  }

  if (error) {
    return <div className="text-center text-red-500">{error}</div>;
  }

  if (!tvShow) {
    return <div className="text-center">Série non trouvée.</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen bg-black text-white"
    >
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="relative h-[50vh] md:h-[80vh]"
      >
        <div className="absolute inset-0">
          <img
            src={`https://image.tmdb.org/t/p/original${tvShow.poster_path}`}
            alt={tvShow.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
        </div>
      </motion.div>

      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="relative -mt-48 px-4 md:px-8 lg:px-16 space-y-6"
      >
        <h1 className="text-4xl md:text-6xl font-bold animate-slide-up">{tvShow.name}</h1>
        
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="flex flex-wrap items-center gap-4 text-sm text-gray-300"
        >
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 text-yellow-500" />
            {tvShow.vote_average.toFixed(1)}
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="w-4 h-4 text-red-500" />
            {new Date(tvShow.first_air_date).getFullYear()}
          </div>
          <div className="flex flex-wrap gap-2">
            {tvShow.genres.map((genre) => (
              <span key={genre.id} className="px-2 py-1 bg-black/70 rounded-full text-xs">
                {genre.name}
              </span>
            ))}
          </div>
        </motion.div>

        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="text-lg max-w-2xl text-gray-300"
        >
          {tvShow.overview}
        </motion.p>

        <WatchButtons />

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="flex flex-wrap gap-4"
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="inline-flex items-center gap-2 bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors animate-float"
            onClick={() => setShowCast(!showCast)}
          >
            <User className="w-5 h-5" />
            {showCast ? 'Masquer les acteurs' : 'Voir les acteurs'}
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="inline-flex items-center gap-2 bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors animate-float"
            onClick={() => setShowCrew(!showCrew)}
          >
            <Video className="w-5 h-5" />
            {showCrew ? 'Masquer l\'équipe' : 'Voir l\'équipe'}
          </motion.button>
        </motion.div>

        {showCast && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mt-8"
          >
            <h2 className="text-2xl font-bold mb-4">Acteurs</h2>
            <div className="relative">
              <motion.button
                whileHover={{ scale: 1.1, backgroundColor: "rgba(0,0,0,0.75)" }}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-black/50 p-2 rounded-full"
                onClick={() => scrollLeft('cast-container')}
              >
                ←
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.1, backgroundColor: "rgba(0,0,0,0.75)" }}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-black/50 p-2 rounded-full"
                onClick={() => scrollRight('cast-container')}
              >
                →
              </motion.button>
              <div id="cast-container" className="overflow-x-auto pb-4 scrollbar-hide">
                <div className="flex space-x-4 w-max">
                  {cast.map((member, index) => (
                    <motion.div
                      key={member.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{ scale: 1.05 }}
                      className="flex-none w-32"
                    >
                      <img
                        src={member.profile_path 
                          ? `https://image.tmdb.org/t/p/w185${member.profile_path}` 
                          : DEFAULT_IMAGE}
                        alt={member.name}
                        className="w-full h-40 object-cover rounded-lg"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.onerror = null;
                          target.src = DEFAULT_IMAGE;
                        }}
                      />
                      <p className="mt-2 text-sm font-semibold">{member.name}</p>
                      <p className="text-xs text-gray-400">{member.character}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="mt-8 space-y-6"
      >
        <h2 className="text-2xl font-bold mb-4">Regarder</h2>
        
        {availableEpisodes.length > 0 && (
          <>
            <motion.div 
              initial={{ x: -20 }}
              animate={{ x: 0 }}
              className="flex flex-wrap gap-2 mb-32 pb-20"
            >
              {availableSeasons.map((season) => (
                <motion.button
                  key={season}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleSeasonChange(season)}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    selectedSeason === season
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  Saison {season}
                </motion.button>
              ))}
            </motion.div>

            <motion.div 
              initial={{ x: 20 }}
              animate={{ x: 0 }}
              className="flex flex-wrap gap-2 mb-32 pb-20"
            >
              {episodesForSeason.map((episode) => {
                const episodeKey = `s${selectedSeason}e${episode.epi}`;
                return (
                  <div key={episode.epi} className="flex flex-col gap-2">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleEpisodeChange(episode.epi)}
                      className={`px-4 py-2 rounded-lg transition-colors ${
                        selectedEpisode === episode.epi
                          ? 'bg-red-600 text-white'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      Episode {episode.epi}
                    </motion.button>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateWatchStatus('episodeWatchlist', 
                          !watchStatus.episodeWatchlist[episodeKey], 
                          episodeKey
                        )}
                        className={`p-1 rounded ${
                          watchStatus.episodeWatchlist[episodeKey] 
                            ? 'text-red-600' 
                            : 'text-gray-400'
                        }`}
                      >
                        <List className="w-4 h-4" />
                      </button>
                      
                      <button
                        onClick={() => updateWatchStatus('episodeWatched', 
                          !watchStatus.episodeWatched[episodeKey], 
                          episodeKey
                        )}
                        className={`p-1 rounded ${
                          watchStatus.episodeWatched[episodeKey] 
                            ? 'text-red-600' 
                            : 'text-gray-400'
                        }`}
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </motion.div>
          </>
        )}

        {selectedSeason && selectedEpisode && (
          <VideoPlayer 
            showId={id!} 
            seasonNumber={selectedSeason} 
            episodeNumber={selectedEpisode}
          />
        )}
        
        {/* Séries similaires carousel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
          className="mt-16 mb-20"
        >
          <h2 className="text-2xl font-bold mb-6">Séries similaires</h2>
          {loadingSimilar ? (
            <div className="flex items-center justify-center h-64 space-y-4 bg-black/50">
              <Loader className="animate-spin h-8 w-8" />
            </div>
          ) : recommendations.length > 0 ? (
            <div className="relative group">
              <button
                className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-black to-transparent px-5 z-30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center h-full"
                onClick={() => {
                  const container = document.getElementById('similar-shows-container');
                  if (container) {
                    container.scrollBy({ left: -400, behavior: 'smooth' });
                  }
                }}
              >
                <div className="bg-black/40 rounded-full p-2.5">
                  <ChevronLeft className="w-6 h-6 text-white" />
                </div>
              </button>

              <div 
                id="similar-shows-container" 
                className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth px-4 md:px-8 w-full"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {recommendations.map((show) => (
                  <div
                    key={show.id}
                    className="flex-none w-32 md:w-48 group/item"
                  >
                    <Link to={`/tv/${show.id}`} className="flex flex-col">
                      <div className="relative rounded-lg overflow-hidden">
                        <img
                          src={show.poster_path 
                            ? `https://image.tmdb.org/t/p/w500${show.poster_path}`
                            : DEFAULT_IMAGE
                          }
                          alt={show.name}
                          className="w-full h-full object-cover rounded-lg transition-transform duration-300 group-hover/item:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover/item:opacity-100 transition-opacity duration-300">
                          <div className="absolute bottom-0 left-0 right-0 p-4">
                            <h3 className="text-sm font-bold text-white line-clamp-2">
                              {show.name}
                            </h3>
                            <p className="text-xs text-gray-300 line-clamp-3 mt-1">
                              {show.overview}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex items-center gap-1">
                                <Star className="w-3 h-3 text-yellow-400" />
                                <span className="text-xs text-gray-300">
                                  {show.vote_average?.toFixed(1)}
                                </span>
                              </div>
                              {show.first_air_date && (
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3 text-gray-400" />
                                  <span className="text-xs text-gray-300">
                                    {new Date(show.first_air_date).getFullYear()}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </div>
                ))}
              </div>

              <button
                className="absolute right-0 top-0 bottom-0 bg-gradient-to-l from-black to-transparent px-5 z-30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center h-full"
                onClick={() => {
                  const container = document.getElementById('similar-shows-container');
                  if (container) {
                    container.scrollBy({ left: 400, behavior: 'smooth' });
                  }
                }}
              >
                <div className="bg-black/40 rounded-full p-2.5">
                  <ChevronRight className="w-6 h-6 text-white" />
                </div>
              </button>
            </div>
          ) : (
            <p className="text-center text-gray-400">
              Aucune série similaire disponible
            </p>
          )}
        </motion.div>
      </motion.div>
      
      {/* Garder la modale mais la cacher par défaut */}
      {showSimilarModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-black rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Séries similaires</h2>
              <button
                onClick={() => setShowSimilarModal(false)}
                className="p-2 hover:bg-black/80 rounded-lg transition-colors"
              >
                ✕
              </button>
            </div>
            {loadingSimilar ? (
              <div className="flex flex-col items-center justify-center h-64 space-y-4 bg-black/50">
                <Loader className="animate-spin h-8 w-8" />
                <p className="text-gray-400">Recherche des séries disponibles...</p>
              </div>
            ) : recommendations.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {recommendations.map((item) => (
                  <Link
                    key={item.id}
                    to={`/tv/${item.id}`}
                    onClick={() => setShowSimilarModal(false)}
                    className="block group/item relative rounded-lg overflow-hidden"
                  >
                    <img
                      src={`https://image.tmdb.org/t/p/w500${item.poster_path}`}
                      alt={item.name}
                      className="w-full aspect-[2/3] object-cover rounded-lg transition-transform duration-300 group-hover/item:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover/item:opacity-100 transition-opacity duration-300">
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <h3 className="text-sm font-bold text-white line-clamp-2">
                          {item.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-2">
                          <div className="flex items-center gap-1">
                            <Star className="w-3 h-3 text-yellow-400" />
                            <span className="text-xs text-gray-300">
                              {item.vote_average.toFixed(1)}
                            </span>
                          </div>
                          {item.first_air_date && (
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-gray-400" />
                              <span className="text-xs text-gray-300">
                                {new Date(item.first_air_date).getFullYear()}
                              </span>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-gray-300 line-clamp-2">
                          {item.overview || 'Aucun résumé disponible.'}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-400">
                Aucune série similaire trouvée.
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default TVDetails;