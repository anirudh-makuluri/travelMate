from __future__ import annotations

import asyncio
import math
from typing import Iterable

from app.clients.base import BaseGoogleClient, GoogleAPIError
from app.models.planning import CandidatePlace, PlaceLocation, TransportMode, TravelStep


PRICE_LEVEL_MAP = {
    "PRICE_LEVEL_FREE": 0,
    "PRICE_LEVEL_INEXPENSIVE": 1,
    "PRICE_LEVEL_MODERATE": 2,
    "PRICE_LEVEL_EXPENSIVE": 3,
    "PRICE_LEVEL_VERY_EXPENSIVE": 4,
}


class PlacesClient(BaseGoogleClient):
    async def search_text(
        self,
        *,
        text_query: str,
        language_code: str,
        region_code: str,
        max_results: int,
    ) -> list[CandidatePlace]:
        if not self.settings.planner_enable_google_calls:
            raise GoogleAPIError("Google calls are disabled by configuration.")

        headers = {
            "X-Goog-Api-Key": self.require_maps_api_key(),
            "X-Goog-FieldMask": ",".join(
                [
                    "places.id",
                    "places.displayName",
                    "places.formattedAddress",
                    "places.location",
                    "places.primaryType",
                    "places.rating",
                    "places.userRatingCount",
                    "places.priceLevel",
                    "places.googleMapsUri",
                    "places.editorialSummary",
                ]
            ),
        }
        payload = {
            "textQuery": text_query,
            "languageCode": language_code,
            "regionCode": region_code,
            "maxResultCount": max_results,
        }
        data = await self.post_json(
            f"{self.settings.places_base_url}/places:searchText",
            json_payload=payload,
            headers=headers,
        )

        places: list[CandidatePlace] = []
        for raw_place in data.get("places", []):
            location = raw_place.get("location") or {}
            if "latitude" not in location or "longitude" not in location:
                continue
            places.append(
                CandidatePlace(
                    place_id=raw_place["id"],
                    name=(raw_place.get("displayName") or {}).get("text", "Unknown place"),
                    address=raw_place.get("formattedAddress"),
                    location=PlaceLocation(
                        lat=location["latitude"],
                        lng=location["longitude"],
                    ),
                    primary_type=raw_place.get("primaryType"),
                    rating=raw_place.get("rating"),
                    user_rating_count=raw_place.get("userRatingCount"),
                    price_level=PRICE_LEVEL_MAP.get(raw_place.get("priceLevel")),
                    google_maps_uri=raw_place.get("googleMapsUri"),
                    editorial_summary=(raw_place.get("editorialSummary") or {}).get("text"),
                    source_query=text_query,
                )
            )

        return places


class RoutesClient(BaseGoogleClient):
    async def compute_route_maps_for_modes(
        self,
        *,
        places: Iterable[CandidatePlace],
        modes: Iterable[TransportMode],
        language_code: str,
    ) -> dict[TransportMode, dict[tuple[str, str], TravelStep]]:
        mode_list = list(dict.fromkeys(modes))
        tasks = [
            self.compute_route_map(
                places=places,
                mode=mode,
                language_code=language_code,
            )
            for mode in mode_list
        ]
        results = await asyncio.gather(*tasks)
        return {
            mode: route_map
            for mode, route_map in zip(mode_list, results, strict=True)
        }

    async def compute_route_map(
        self,
        *,
        places: Iterable[CandidatePlace],
        mode: TransportMode,
        language_code: str,
    ) -> dict[tuple[str, str], TravelStep]:
        place_list = list(places)
        if len(place_list) < 2:
            return {}

        route_map: dict[tuple[str, str], TravelStep] = {}
        tasks = [
            self.compute_route(
                origin=origin,
                destination=destination,
                mode=mode,
                language_code=language_code,
            )
            for origin in place_list
            for destination in place_list
            if origin.place_id != destination.place_id
        ]
        results = await asyncio.gather(*tasks)

        index = 0
        for origin in place_list:
            for destination in place_list:
                if origin.place_id == destination.place_id:
                    continue
                route_map[(origin.place_id, destination.place_id)] = results[index]
                index += 1

        return route_map

    async def compute_route(
        self,
        *,
        origin: CandidatePlace,
        destination: CandidatePlace,
        mode: TransportMode,
        language_code: str,
    ) -> TravelStep:
        if not self.settings.planner_enable_google_calls or not self.settings.maps_api_key_value:
            return self._heuristic_route(origin, destination, mode)

        payload = {
            "origin": self._waypoint(origin),
            "destination": self._waypoint(destination),
            "travelMode": self._route_mode(mode),
            "languageCode": language_code,
        }
        headers = {
            "X-Goog-Api-Key": self.require_maps_api_key(),
            "X-Goog-FieldMask": ",".join(
                [
                    "routes.duration",
                    "routes.distanceMeters",
                    "routes.travelAdvisory",
                ]
            ),
        }
        data = await self.post_json(
            f"{self.settings.routes_base_url}/directions/v2:computeRoutes",
            json_payload=payload,
            headers=headers,
        )
        routes = data.get("routes") or []
        if not routes:
            return self._heuristic_route(origin, destination, mode)

        route = routes[0]
        duration_seconds = self._duration_to_seconds(route.get("duration", "0s"))
        advisory = route.get("travelAdvisory") or {}
        note = None
        if advisory.get("tollInfo"):
            note = "Route may include tolls."
        cost_estimate = self._estimate_cost(
            mode=mode,
            distance_meters=route.get("distanceMeters"),
        )

        return TravelStep(
            mode=mode,
            duration_minutes=max(1, round(duration_seconds / 60)),
            distance_meters=route.get("distanceMeters"),
            cost_estimate=cost_estimate,
            note=note,
        )

    def _waypoint(self, place: CandidatePlace) -> dict[str, object]:
        return {
            "location": {
                "latLng": {
                    "latitude": place.location.lat,
                    "longitude": place.location.lng,
                }
            }
        }

    def _route_mode(self, mode: TransportMode) -> str:
        mapping = {
            TransportMode.WALK: "WALK",
            TransportMode.TRANSIT: "TRANSIT",
            TransportMode.DRIVE: "DRIVE",
            TransportMode.BICYCLE: "BICYCLE",
        }
        return mapping[mode]

    def _duration_to_seconds(self, raw_duration: str) -> int:
        cleaned = raw_duration.removesuffix("s")
        try:
            return int(float(cleaned))
        except ValueError:
            return 0

    def _heuristic_route(
        self,
        origin: CandidatePlace,
        destination: CandidatePlace,
        mode: TransportMode,
    ) -> TravelStep:
        distance_meters = self._haversine_distance(origin.location, destination.location)
        speeds_kmh = {
            TransportMode.WALK: 4.5,
            TransportMode.TRANSIT: 20.0,
            TransportMode.DRIVE: 28.0,
            TransportMode.BICYCLE: 14.0,
        }
        speed = speeds_kmh[mode]
        duration_minutes = max(1, round((distance_meters / 1000) / speed * 60))
        return TravelStep(
            mode=mode,
            duration_minutes=duration_minutes,
            distance_meters=round(distance_meters),
            cost_estimate=self._estimate_cost(mode=mode, distance_meters=round(distance_meters)),
            note="Estimated locally because Google routing was unavailable.",
        )

    def _estimate_cost(
        self,
        *,
        mode: TransportMode,
        distance_meters: int | float | None,
    ) -> float | None:
        if distance_meters is None:
            return None

        distance_km = distance_meters / 1000
        if mode == TransportMode.DRIVE:
            return round(max(2.5, distance_km * 0.22), 2)
        if mode == TransportMode.TRANSIT:
            return round(max(2.0, 1.5 + distance_km * 0.08), 2)
        if mode in {TransportMode.WALK, TransportMode.BICYCLE}:
            return 0.0
        return None

    def _haversine_distance(self, a: PlaceLocation, b: PlaceLocation) -> float:
        radius = 6_371_000
        lat1 = math.radians(a.lat)
        lat2 = math.radians(b.lat)
        delta_lat = math.radians(b.lat - a.lat)
        delta_lng = math.radians(b.lng - a.lng)

        haversine = (
            math.sin(delta_lat / 2) ** 2
            + math.cos(lat1) * math.cos(lat2) * math.sin(delta_lng / 2) ** 2
        )
        return 2 * radius * math.asin(math.sqrt(haversine))
