# Anime-Sama API

A FastAPI-based REST API for accessing anime content from anime-sama.fr

## Features

- Search for anime series
- Get season information
- Get episode streaming links
- Built-in caching system
- CORS support
- Rate limiting
- Error handling

## Requirements

- Python 3.12 or higher
- FastAPI
- Uvicorn
- Other dependencies (see pyproject.toml)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/Sky-NiniKo/anime-sama_downloader.git
cd anime-sama_downloader
```

2. Install dependencies using Poetry:
```bash
poetry install
```

## Running the API

Start the server:
```bash
poetry run uvicorn anime_sama.api:app --host 0.0.0.0 --port 8000 --reload
```

The API will be available at `http://localhost:8000`

## API Documentation

After starting the server, visit:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

### Endpoints

#### Search Anime
```http
GET /search/{query}
```

Query Parameters:
- `query` (string, required): The search term
- `include_seasons` (boolean, optional): Include season information
- `include_episodes` (boolean, optional): Include episode information

Example Response:
```json
[
  {
    "name": "One Piece",
    "url": "https://anime-sama.fr/anime/one-piece",
    "seasons": [
      {
        "name": "Season 1",
        "serie_name": "One Piece",
        "url": "https://anime-sama.fr/anime/one-piece/season-1",
        "episodes": [
          {
            "name": "Episode 1",
            "serie_name": "One Piece",
            "season_name": "Season 1",
            "index": 1,
            "streaming_links": [
              {
                "language": "vostfr",
                "players": [
                  "https://player1.com/embed/123",
                  "https://player2.com/embed/456"
                ]
              }
            ]
          }
        ]
      }
    ]
  }
]
```

### Caching

The API implements two levels of caching:
1. Global request cache (1 hour TTL)
2. Episode-specific cache (1 hour TTL)

Cache files are stored in `.episode_cache` directory.

### Error Handling

The API returns standard HTTP status codes:
- 200: Success
- 400: Bad Request
- 404: Not Found
- 500: Internal Server Error

Error Response Format:
```json
{
  "detail": "Error message description"
}
```

### CORS Configuration

By default, the API allows:
- Origin: `http://localhost:3000`
- Methods: All
- Headers: All
- Credentials: True

## Development

### Project Structure
```
anime_sama/
├── api.py           # Main API implementation
├── episode_cache.py # Caching system
└── ...             # Other modules
```

### Adding New Endpoints

1. Define new Pydantic models in `api.py`
2. Create new endpoint functions with appropriate decorators
3. Add error handling
4. Update documentation

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the GPL-3.0 License - see the LICENSE file for details.