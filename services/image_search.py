"""
Real image lookup via Wikimedia Commons — free, no API key required.

Used so Nova can show an actual photo instead of the model hallucinating
a fake image URL when someone asks "show me a picture of X".
"""

import re
import requests

COMMONS_API = "https://commons.wikimedia.org/w/api.php"

# Wikimedia asks API consumers to identify themselves with a descriptive User-Agent.
HEADERS = {
    "User-Agent": "NovaAI-Chatbot/1.0 (personal project; contact: not-provided)"
}

_TAG_RE = re.compile(r"<[^>]+>")


def _strip_html(value):
    if not value:
        return ""
    return _TAG_RE.sub("", value).strip()


def search_commons_image(query, timeout=6):
    """
    Search Wikimedia Commons for a real photo matching `query`.

    Returns a dict: {url, title, source_url, artist} or None if nothing
    was found / the request failed for any reason.
    """
    if not query or not query.strip():
        return None

    try:
        search_resp = requests.get(
            COMMONS_API,
            params={
                "action": "query",
                "format": "json",
                "list": "search",
                "srnamespace": 6,  # File: namespace
                "srlimit": 1,
                "srsearch": f"{query} filetype:bitmap",
            },
            headers=HEADERS,
            timeout=timeout,
        )
        search_resp.raise_for_status()
        results = search_resp.json().get("query", {}).get("search", [])
        if not results:
            return None

        title = results[0]["title"]  # e.g. "File:Ooty tea gardens.jpg"

        info_resp = requests.get(
            COMMONS_API,
            params={
                "action": "query",
                "format": "json",
                "prop": "imageinfo",
                "iiprop": "url|extmetadata",
                "iiurlwidth": 800,
                "titles": title,
            },
            headers=HEADERS,
            timeout=timeout,
        )
        info_resp.raise_for_status()
        pages = info_resp.json().get("query", {}).get("pages", {})
        page = next(iter(pages.values()), None)

        if not page or "imageinfo" not in page or not page["imageinfo"]:
            return None

        info = page["imageinfo"][0]
        url = info.get("thumburl") or info.get("url")
        if not url:
            return None

        artist = _strip_html(
            info.get("extmetadata", {}).get("Artist", {}).get("value", "")
        )

        display_title = title.replace("File:", "").rsplit(".", 1)[0]

        return {
            "url": url,
            "title": display_title,
            "source_url": info.get("descriptionurl", ""),
            "artist": artist,
        }

    except Exception:
        # Network error, timeout, unexpected response shape, etc.
        # Callers treat None as "no image available" and handle it gracefully.
        return None
