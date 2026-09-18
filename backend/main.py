import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests
from supabase import Client, create_client

load_dotenv(Path(__file__).with_name(".env"))

logger = logging.getLogger(__name__)

app = FastAPI(title="Pokemon Explorer API")

# CORS - allows our React frontend (on a different origin) to call this API.
# allow_origins=["*"] is fine for a classroom demo. In production you'd
# restrict this to your actual Vercel URL.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

POKEAPI_BASE_URL = "https://pokeapi.co/api/v2/pokemon"
POKEAPI_SPECIES_URL = "https://pokeapi.co/api/v2/pokemon-species"


class FavoriteCreate(BaseModel):
    pokemon_id: int
    pokemon_name: str
    pokemon_image: str


def get_supabase() -> Client:
    """Return a server-only Supabase client when favorites are requested."""
    url = os.getenv("SUPABASE_URL")
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not service_role_key:
        raise HTTPException(503, "Favorites are not configured on the server.")
    return create_client(url, service_role_key)


def favorites_unavailable() -> HTTPException:
    return HTTPException(503, "Favorites service is temporarily unavailable.")


@app.get("/")
def read_root():
    return {"message": "Pokemon Explorer API is running"}


@app.get("/pokemon/{name}")
def get_pokemon(name: str):
    try:
        response = requests.get(
            f"{POKEAPI_BASE_URL}/{name.lower().strip()}", timeout=10
        )
    except requests.RequestException:
        raise HTTPException(503, "Pokémon service is unavailable")

    if response.status_code != 200:
        raise HTTPException(status_code=404, detail="Pokemon not found")

    data = response.json()

    try:
        species_response = requests.get(
            f"{POKEAPI_SPECIES_URL}/{data['id']}", timeout=10
        )
        species_response.raise_for_status()
        generation = species_response.json().get("generation", {}).get("name")
    except requests.RequestException:
        generation = None

    stats = {
        stat["stat"]["name"].replace("-", "_"): stat["base_stat"]
        for stat in data["stats"]
    }

    return {
        "id": data["id"],
        "name": data["name"],
        "image": data["sprites"]["front_default"],
        "types": [item["type"]["name"] for item in data["types"]],
        "abilities": [
            item["ability"]["name"].replace("-", " ")
            for item in data["abilities"]
        ],
        "stats": stats,
        "total_stats": sum(stats.values()),
        "height": data["height"] / 10,  # decimeters -> meters
        "weight": data["weight"] / 10,  # hectograms -> kilograms
        "base_experience": data["base_experience"],
        "generation": generation,
    }


@app.get("/favorites")
def list_favorites():
    try:
        result = get_supabase().table("favorites").select(
            "id, pokemon_id, pokemon_name, pokemon_image, chosen_at"
        ).order("chosen_at", desc=True).execute()
        return result.data
    except HTTPException:
        raise
    except Exception:
        logger.exception("Supabase favorites request failed")
        raise favorites_unavailable()


@app.post("/favorites")
def add_favorite(favorite: FavoriteCreate):
    try:
        supabase = get_supabase()
        existing = supabase.table("favorites").select(
            "id, pokemon_id, pokemon_name, pokemon_image, chosen_at"
        ).eq("pokemon_id", favorite.pokemon_id).execute()
        if existing.data:
            return {"favorite": existing.data[0], "already_exists": True}

        created = supabase.table("favorites").insert(favorite.model_dump()).execute()
        return {"favorite": created.data[0], "already_exists": False}
    except HTTPException:
        raise
    except Exception:
        logger.exception("Supabase favorites request failed")
        raise favorites_unavailable()


@app.delete("/favorites/{pokemon_id}")
def remove_favorite(pokemon_id: int):
    try:
        get_supabase().table("favorites").delete().eq("pokemon_id", pokemon_id).execute()
        return {"removed": True}
    except HTTPException:
        raise
    except Exception:
        logger.exception("Supabase favorites request failed")
        raise favorites_unavailable()




