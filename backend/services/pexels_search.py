import os
import requests

PEXELS_API_KEY = os.environ.get("PEXELS_API_KEY", "")
PEXELS_BASE = "https://api.pexels.com"


def search_pexels(query: str, per_page: int = 6, media_type: str = "videos") -> dict:
    headers = {"Authorization": PEXELS_API_KEY}

    if media_type == "videos":
        url = f"{PEXELS_BASE}/videos/search"
        params = {
            "query": query,
            "per_page": per_page,
            "size": "medium",
            "orientation": "landscape",  # 16:9 horizontal only
        }
        response = requests.get(url, headers=headers, params=params, timeout=10)

        if response.status_code != 200:
            return {"results": [], "error": f"Pexels API error: {response.status_code}"}

        data = response.json()
        results = []
        for video in data.get("videos", []):
            video_files = video.get("video_files", [])

            # Filter to only landscape/horizontal files (width > height)
            landscape_files = [
                f for f in video_files
                if f.get("width", 0) > f.get("height", 1)
            ]

            # Prefer HD landscape, then SD landscape
            hd_file = next((f for f in landscape_files if f.get("quality") == "hd"), None)
            sd_file = next((f for f in landscape_files if f.get("quality") == "sd"), None)
            best_file = hd_file or sd_file or (landscape_files[0] if landscape_files else None)

            # Skip vertical videos entirely
            if not best_file:
                continue

            # Skip videos that are clearly portrait (height > width)
            if video.get("height", 0) > video.get("width", 1):
                continue

            results.append({
                "id": video["id"],
                "type": "video",
                "thumbnail": video.get("image", ""),
                "preview_url": best_file.get("link", ""),
                "download_url": best_file.get("link", ""),
                "duration": video.get("duration", 0),
                "width": best_file.get("width", 0),
                "height": best_file.get("height", 0),
                "photographer": video.get("user", {}).get("name", "Unknown"),
                "pexels_url": video.get("url", ""),
            })

        return {"results": results, "total": data.get("total_results", 0)}

    else:  # photos — landscape only
        url = f"{PEXELS_BASE}/v1/search"
        params = {
            "query": query,
            "per_page": per_page,
            "orientation": "landscape",
        }
        response = requests.get(url, headers=headers, params=params, timeout=10)

        if response.status_code != 200:
            return {"results": [], "error": f"Pexels API error: {response.status_code}"}

        data = response.json()
        results = []
        for photo in data.get("photos", []):
            # Skip portrait photos
            if photo.get("height", 0) > photo.get("width", 1):
                continue
            results.append({
                "id": photo["id"],
                "type": "image",
                "thumbnail": photo.get("src", {}).get("medium", ""),
                "preview_url": photo.get("src", {}).get("large2x", ""),
                "download_url": photo.get("src", {}).get("original", ""),
                "duration": 0,
                "width": photo.get("width", 0),
                "height": photo.get("height", 0),
                "photographer": photo.get("photographer", "Unknown"),
                "pexels_url": photo.get("url", ""),
            })

        return {"results": results, "total": data.get("total_results", 0)}
