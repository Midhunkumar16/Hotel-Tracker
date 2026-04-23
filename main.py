from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
import httpx
import asyncio
import os
import json
import random
from dotenv import load_dotenv
from math import radians, sin, cos, sqrt, atan2

load_dotenv()

app = FastAPI(title="Hotel Rate Tracker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
PLACES_URL = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"

# In-memory store for your hotel profile (persists while server is running)
MY_HOTEL_STORE = {}

ROOM_TYPES = ["single", "double", "twin", "suite", "family"]

EXCLUDED_KEYWORDS = [
    "airbnb", "basement", "bedroom", "townhouse", "apartment",
    "suite rental", "home", "house", "cottage", "condo", "room for rent",
    "retreat", "guest room"
]


# ── Models ────────────────────────────────────────────────────────────────────

class RoomRates(BaseModel):
    single: float
    double: float
    twin: float
    suite: float
    family: float


class MyHotel(BaseModel):
    name: str
    address: str
    lat: float
    lng: float
    star_rating: int
    room_rates: RoomRates


# ── Helpers ───────────────────────────────────────────────────────────────────

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


def estimate_base_price(price_level, rating: float = 3.0) -> int:
    if price_level is not None:
        mapping = {0: 75, 1: 110, 2: 170, 3: 280, 4: 480}
        return mapping.get(int(price_level), 170)
    if rating >= 4.5: return 300
    elif rating >= 4.0: return 200
    elif rating >= 3.5: return 140
    elif rating >= 3.0: return 100
    return 80


def simulate_booking_room_rates(base_price: int, rating: float) -> dict:
    """
    Simulate Booking.com room rates per category based on base price.
    Room type multipliers reflect typical industry pricing ratios.
    Small random variance added to simulate real market fluctuation.
    Replace this function body with real Booking.com API call when key is ready.
    """
    multipliers = {
        "single": 0.75,
        "double": 1.0,
        "twin":   1.0,
        "suite":  1.85,
        "family": 1.45,
    }
    rates = {}
    for room, multiplier in multipliers.items():
        # Add ±8% market variance to simulate real pricing
        variance = 1 + (random.uniform(-0.08, 0.08))
        rates[room] = round(base_price * multiplier * variance)
    return rates


def haversine(lat1, lng1, lat2, lng2) -> float:
    R = 6371
    d_lat = radians(lat2 - lat1)
    d_lng = radians(lng2 - lng1)
    a = sin(d_lat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(d_lng / 2) ** 2
    return round(R * 2 * atan2(sqrt(a), sqrt(1 - a)), 2)


async def fetch_all_nearby(client, lat, lng, radius) -> list:
    all_results = []
    params = {
        "location": f"{lat},{lng}",
        "radius": radius,
        "type": "lodging",
        "key": GOOGLE_API_KEY,
    }
    for page in range(3):
        resp = await client.get(PLACES_URL, params=params)
        data = resp.json()
        status = data.get("status")
        if status not in ("OK", "ZERO_RESULTS"):
            break
        all_results.extend(data.get("results", []))
        next_token = data.get("next_page_token")
        if not next_token:
            break
        await asyncio.sleep(2)
        params = {"pagetoken": next_token, "key": GOOGLE_API_KEY}
    return all_results


async def fetch_hotel_details(client, place, lat, lng) -> dict:
    place_id = place.get("place_id")
    details_resp = await client.get(DETAILS_URL, params={
        "place_id": place_id,
        "fields": "name,rating,user_ratings_total,price_level,geometry,formatted_address",
        "key": GOOGLE_API_KEY,
    })
    details = details_resp.json().get("result", {})

    price_level = (
        details.get("price_level")
        if details.get("price_level") is not None
        else place.get("price_level")
    )
    rating = details.get("rating") or place.get("rating") or 3.0
    base_price = estimate_base_price(price_level, rating)
    room_rates = simulate_booking_room_rates(base_price, rating)

    hotel_lat = place["geometry"]["location"]["lat"]
    hotel_lng = place["geometry"]["location"]["lng"]

    return {
        "id": place_id,
        "name": details.get("name", place.get("name")),
        "address": details.get("formatted_address", ""),
        "rating": rating,
        "user_ratings_total": details.get("user_ratings_total", place.get("user_ratings_total", 0)),
        "price_level": price_level,
        "estimated_price_usd": base_price,
        "room_rates": room_rates,         # Booking.com simulated rates per room type
        "rate_source": "booking_mock",    # Change to "booking_live" when API is ready
        "distance_km": haversine(lat, lng, hotel_lat, hotel_lng),
        "lat": hotel_lat,
        "lng": hotel_lng,
    }


# ── Routes ────────────────────────────────────────────────────────────────────

@app.post("/my-hotel")
async def save_my_hotel(hotel: MyHotel):
    """Save your hotel profile as the reference property."""
    MY_HOTEL_STORE["hotel"] = hotel.dict()
    return {"status": "saved", "hotel": MY_HOTEL_STORE["hotel"]}


@app.get("/my-hotel")
async def get_my_hotel():
    """Get your saved hotel profile."""
    if "hotel" not in MY_HOTEL_STORE:
        raise HTTPException(status_code=404, detail="No hotel profile saved yet")
    return MY_HOTEL_STORE["hotel"]


@app.get("/competitors")
async def get_competitors(
    lat: float = Query(..., description="Your hotel latitude"),
    lng: float = Query(..., description="Your hotel longitude"),
    radius: int = Query(5000, description="Search radius in meters"),
):
    """
    Fetch nearby competitor hotels with room-level rate comparison.
    Returns each competitor's Booking.com rates alongside your hotel's rates.
    """
    if not GOOGLE_API_KEY:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY not set in environment")

    my_hotel = MY_HOTEL_STORE.get("hotel")

    async with httpx.AsyncClient(timeout=30) as client:
        all_results = await fetch_all_nearby(client, lat, lng, radius)

        filtered = [p for p in all_results if is_real_hotel(p)]

        seen = set()
        unique = []
        for p in filtered:
            pid = p.get("place_id")
            if pid not in seen:
                seen.add(pid)
                unique.append(p)

        tasks = [fetch_hotel_details(client, place, lat, lng) for place in unique]
        competitors = await asyncio.gather(*tasks)

    competitors = sorted(competitors, key=lambda h: h["distance_km"])

    # Add rate comparison vs your hotel for each room type
    if my_hotel:
        my_rates = my_hotel["room_rates"]
        for comp in competitors:
            comparison = {}
            for room in ROOM_TYPES:
                my_rate = my_rates.get(room, 0)
                comp_rate = comp["room_rates"].get(room, 0)
                diff = comp_rate - my_rate
                comparison[room] = {
                    "my_rate": my_rate,
                    "competitor_rate": comp_rate,
                    "diff": round(diff),
                    "status": "cheaper" if diff < 0 else "expensive" if diff > 0 else "same"
                }
            comp["rate_comparison"] = comparison

    return {
        "my_hotel": my_hotel,
        "competitors": competitors,
        "count": len(competitors)
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
        all_results = await fetch_all_nearby(client, lat, lng, radius)
        filtered = [p for p in all_results if is_real_hotel(p)]
        seen = set()
        unique = []
        for p in filtered:
            pid = p.get("place_id")
            if pid not in seen:
                seen.add(pid)
                unique.append(p)
        tasks = [fetch_hotel_details(client, place, lat, lng) for place in unique]
        hotels = await asyncio.gather(*tasks)

    hotels = sorted(hotels, key=lambda h: h["distance_km"])
    return {"hotels": hotels, "count": len(hotels)}


@app.get("/health")
async def health():
    return {"status": "ok", "api_key_set": bool(GOOGLE_API_KEY)}
