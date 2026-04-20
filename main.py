from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import httpx
import asyncio
import os
from dotenv import load_dotenv
from math import radians, sin, cos, sqrt, atan2

load_dotenv()

app = FastAPI(title="Hotel Rate Tracker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
PLACES_URL = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"

EXCLUDED_KEYWORDS = [
    "airbnb", "basement", "bedroom", "townhouse", "apartment",
    "suite rental", "home", "house", "cottage", "condo", "room for rent",
    "retreat", "guest room"
]


def is_real_hotel(place):
    name = place.get("name", "").lower()
    types = set(place.get("types", []))
    if any(kw in name for kw in EXCLUDED_KEYWORDS):
        return False
    if place.get("user_ratings_total", 0) < 10:
        return False
    if "lodging" not in types and "hotel" not in types:
        return False
    return True


def estimate_price(price_level, rating: float = 3.0) -> int:
    """
    Single source of truth for price estimation.
    Uses Google price_level when available, otherwise derives from rating.
    price_level 0=budget, 1=inexpensive, 2=moderate, 3=expensive, 4=very expensive
    """
    if price_level is not None:
        mapping = {0: 75, 1: 110, 2: 170, 3: 280, 4: 480}
        return mapping.get(int(price_level), 170)
    # Fallback: derive from rating
    if rating >= 4.5:
        return 300
    elif rating >= 4.0:
        return 200
    elif rating >= 3.5:
        return 140
    elif rating >= 3.0:
        return 100
    return 80


def haversine(lat1, lng1, lat2, lng2) -> float:
    R = 6371
    d_lat = radians(lat2 - lat1)
    d_lng = radians(lng2 - lng1)
    a = sin(d_lat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(d_lng / 2) ** 2
    return round(R * 2 * atan2(sqrt(a), sqrt(1 - a)), 2)


async def fetch_all_nearby(client, lat, lng, radius) -> list:
    """
    Fetch up to 3 pages of Google Places results (max 60 total).
    Google only supports pagination via next_page_token with a delay between calls.
    """
    all_results = []
    params = {
        "location": f"{lat},{lng}",
        "radius": radius,
        "type": "lodging",
        "key": GOOGLE_API_KEY,
    }

    for page in range(3):  # Max 3 pages from Google
        resp = await client.get(PLACES_URL, params=params)
        data = resp.json()

        status = data.get("status")
        if status not in ("OK", "ZERO_RESULTS"):
            break

        all_results.extend(data.get("results", []))

        next_token = data.get("next_page_token")
        if not next_token:
            break

        # Google requires a short delay before the next_page_token becomes valid
        await asyncio.sleep(2)
        params = {"pagetoken": next_token, "key": GOOGLE_API_KEY}

    return all_results


async def fetch_hotel_details(client, place, lat, lng) -> dict:
    """Fetch details for a single hotel and build the response object."""
    place_id = place.get("place_id")

    details_resp = await client.get(DETAILS_URL, params={
        "place_id": place_id,
        "fields": "name,rating,user_ratings_total,price_level,geometry,formatted_address",
        "key": GOOGLE_API_KEY,
    })
    details = details_resp.json().get("result", {})

    # Prefer details price_level, fall back to nearby search price_level
    price_level = (
        details.get("price_level")
        if details.get("price_level") is not None
        else place.get("price_level")
    )
    rating = details.get("rating") or place.get("rating") or 3.0
    estimated_price = estimate_price(price_level, rating)

    hotel_lat = place["geometry"]["location"]["lat"]
    hotel_lng = place["geometry"]["location"]["lng"]

    return {
        "id": place_id,
        "name": details.get("name", place.get("name")),
        "address": details.get("formatted_address", ""),
        "rating": rating,
        "user_ratings_total": details.get("user_ratings_total", place.get("user_ratings_total", 0)),
        "price_level": price_level,
        "estimated_price_usd": estimated_price,
        "distance_km": haversine(lat, lng, hotel_lat, hotel_lng),
        "lat": hotel_lat,
        "lng": hotel_lng,
    }


@app.get("/hotels/nearby")
async def get_nearby_hotels(
    lat: float = Query(..., description="User latitude"),
    lng: float = Query(..., description="User longitude"),
    radius: int = Query(5000, description="Search radius in meters"),
):
    if not GOOGLE_API_KEY:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY not set in environment")

    async with httpx.AsyncClient(timeout=30) as client:
        # Fetch all pages from Google Places
        all_results = await fetch_all_nearby(client, lat, lng, radius)

        # Filter to real hotels only
        filtered = [p for p in all_results if is_real_hotel(p)]

        # Remove duplicates by place_id
        seen = set()
        unique = []
        for p in filtered:
            pid = p.get("place_id")
            if pid not in seen:
                seen.add(pid)
                unique.append(p)

        # Fetch details concurrently for all hotels
        tasks = [fetch_hotel_details(client, place, lat, lng) for place in unique]
        hotels = await asyncio.gather(*tasks)

    # Sort by actual distance (consistent regardless of radius or sort chosen in frontend)
    hotels = sorted(hotels, key=lambda h: h["distance_km"])

    return {"hotels": hotels, "count": len(hotels)}


@app.get("/health")
async def health():
    return {"status": "ok", "api_key_set": bool(GOOGLE_API_KEY)}