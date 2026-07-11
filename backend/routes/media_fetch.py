"""
routes/media_fetch.py
---------------------
POST /api/media-fetch  – scrape a webpage and return all media assets found.

Returns for each asset:
  url, type (image/gif/svg/ico/video/audio), ext,
  filename, width, height (for images), size_bytes
"""

import re
import logging
import random
import time
from urllib.parse import urljoin, urlparse, urlunparse

from flask import Blueprint, request, jsonify

logger = logging.getLogger("ytshort.routes.media_fetch")

media_fetch_bp = Blueprint("media_fetch", __name__)


IMAGE_EXTS  = {'.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff', '.tif', '.avif'}
GIF_EXTS    = {'.gif'}
SVG_EXTS    = {'.svg', '.svgz'}
ICO_EXTS    = {'.ico', '.cur'}
VIDEO_EXTS  = {'.mp4', '.webm', '.ogg', '.ogv', '.mov', '.avi', '.mkv', '.flv', '.m4v', '.3gp'}
AUDIO_EXTS  = {'.mp3', '.wav', '.ogg', '.oga', '.flac', '.aac', '.opus', '.m4a', '.wma'}

MIME_TYPE_MAP = {
    'image/jpeg':  'image',
    'image/jpg':   'image',
    'image/png':   'image',
    'image/webp':  'image',
    'image/bmp':   'image',
    'image/tiff':  'image',
    'image/avif':  'image',
    'image/gif':   'gif',
    'image/svg+xml': 'svg',
    'image/x-icon': 'ico',
    'image/vnd.microsoft.icon': 'ico',
    'video/mp4':   'video',
    'video/webm':  'video',
    'video/ogg':   'video',
    'video/x-msvideo': 'video',
    'video/quicktime':  'video',
    'audio/mpeg':  'audio',
    'audio/mp3':   'audio',
    'audio/wav':   'audio',
    'audio/ogg':   'audio',
    'audio/flac':  'audio',
    'audio/aac':   'audio',
    'audio/opus':  'audio',
    'audio/x-m4a': 'audio',
    'audio/mp4':   'audio',
}

# Multiple realistic user agents to rotate
USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15',
]


def _ext_to_type(ext: str) -> str | None:
    ext = ext.lower()
    if ext in IMAGE_EXTS:  return 'image'
    if ext in GIF_EXTS:    return 'gif'
    if ext in SVG_EXTS:    return 'svg'
    if ext in ICO_EXTS:    return 'ico'
    if ext in VIDEO_EXTS:  return 'video'
    if ext in AUDIO_EXTS:  return 'audio'
    return None


def _mime_to_type(mime: str) -> str | None:
    if not mime:
        return None
    base = mime.split(';')[0].strip().lower()
    return MIME_TYPE_MAP.get(base)


def _clean_url(url: str) -> str:
    """Remove query strings and fragments for deduplication."""
    try:
        p = urlparse(url)
        return urlunparse(p._replace(query='', fragment=''))
    except Exception:
        return url


def _filename_from_url(url: str) -> str:
    try:
        path = urlparse(url).path
        name = path.rstrip('/').split('/')[-1]
        return name or 'media'
    except Exception:
        return 'media'


def _make_session(page_url: str):
    """Create a requests Session with realistic browser-like headers."""
    import requests

    session = requests.Session()
    parsed = urlparse(page_url)
    origin = f"{parsed.scheme}://{parsed.netloc}"

    ua = random.choice(USER_AGENTS)
    session.headers.update({
        'User-Agent': ua,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate',
        'Cache-Control': 'max-age=0',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Upgrade-Insecure-Requests': '1',
        'Referer': origin,
        'Origin': origin,
        'Connection': 'keep-alive',
        'DNT': '1',
    })
    return session



def _extract_urls_from_srcset(srcset: str, base_url: str) -> list[str]:
    """Parse srcset attribute: 'url1 1x, url2 2x' → [url1, url2]"""
    urls = []
    for part in srcset.split(','):
        piece = part.strip().split()[0]
        if piece:
            urls.append(urljoin(base_url, piece))
    return urls


def _extract_from_css_content(text: str, base_url: str) -> list[str]:
    """Extract url(...) references from inline CSS / style attributes."""
    pattern = r'url\(["\']?([^"\')\s]+)["\']?\)'
    found = []
    for m in re.finditer(pattern, text):
        raw = m.group(1)
        if raw.startswith('data:'):
            continue
        found.append(urljoin(base_url, raw))
    return found


def _extract_urls_from_html_text(html_text: str, base_url: str) -> list[str]:
    """Scan raw HTML text for image/video/audio URL patterns even without proper tags."""
    found = []
    # JSON src patterns common in SPAs/lazy-load scripts
    patterns = [
        r'"(?:src|url|image|img|thumbnail|poster|href)"\s*:\s*"(https?://[^"]+\.(jpe?g|png|webp|gif|svg|mp4|webm|mp3|ico))',
        r"'(?:src|url|image|img|thumbnail|poster|href)'\s*:\s*'(https?://[^']+\.(jpe?g|png|webp|gif|svg|mp4|webm|mp3|ico))",
    ]
    for pattern in patterns:
        for m in re.finditer(pattern, html_text, re.IGNORECASE):
            url = m.group(1)
            if url:
                found.append(url)
    return found



def scrape_media(page_url: str) -> list[dict]:
    try:
        import requests
        from bs4 import BeautifulSoup
    except ImportError as e:
        raise RuntimeError(f"Missing dependency: {e}. Install requests and beautifulsoup4.")

    session = _make_session(page_url)

    # Try fetching the page — accept even 4xx responses and try to parse them
    try:
        resp = session.get(
            page_url,
            timeout=20,
            allow_redirects=True,
            verify=True,
        )
        # Raise an error for HTTP 4xx/5xx status codes indicating blocks or failures
        if resp.status_code >= 400:
            if resp.status_code in (401, 403, 407, 429, 503) or resp.status_code >= 500:
                is_cloudflare = "cloudflare" in resp.headers.get("Server", "").lower() or "just a moment..." in resp.text[:1000].lower()
                if is_cloudflare:
                    raise RuntimeError(
                        f"The website is protected by Cloudflare and blocked the request (HTTP {resp.status_code}). "
                        f"Scraping protected websites is not supported."
                    )
                raise RuntimeError(
                    f"Site blocked or failed the request (HTTP {resp.status_code}). "
                    f"This site may require authentication or actively blocks scrapers. "
                    f"Try a different URL."
                )
            raise RuntimeError(f"Failed to fetch page (HTTP {resp.status_code}).")

        html_text = resp.text
        if not html_text or len(html_text) < 50:
            raise RuntimeError(f"Empty response from server (HTTP {resp.status_code}).")

    except RuntimeError:
        raise
    except Exception as exc:
        raise RuntimeError(f"Could not fetch page: {exc}")

    soup = BeautifulSoup(html_text, 'html.parser')
    base_url = page_url

    base_tag = soup.find('base', href=True)
    if base_tag:
        base_url = urljoin(page_url, base_tag['href'])

    raw_assets: list[tuple[str, str | None]] = []

    for tag in soup.find_all('img'):
        for attr in ('src', 'data-src', 'data-lazy-src', 'data-original',
                     'data-image', 'data-lazyload', 'data-srcset'):
            val = tag.get(attr, '')
            if val and not val.startswith('data:'):
                raw_assets.append((urljoin(base_url, val), 'image'))
        if tag.get('srcset'):
            for u in _extract_urls_from_srcset(tag['srcset'], base_url):
                raw_assets.append((u, 'image'))

    for tag in soup.find_all('source'):
        parent_name = (tag.parent.name or '').lower() if tag.parent else ''
        implied = 'video' if parent_name in ('video', 'audio') else 'image'
        if tag.get('src'):
            raw_assets.append((urljoin(base_url, tag['src']), implied))
        if tag.get('srcset'):
            for u in _extract_urls_from_srcset(tag['srcset'], base_url):
                raw_assets.append((u, implied))

    for tag in soup.find_all(['video', 'audio']):
        tag_name = tag.name.lower()
        if tag.get('src'):
            raw_assets.append((urljoin(base_url, tag['src']), tag_name))
        if tag.get('poster'):
            raw_assets.append((urljoin(base_url, tag['poster']), 'image'))
        if tag.get('data-src'):
            raw_assets.append((urljoin(base_url, tag['data-src']), tag_name))

    for tag in soup.find_all('link', href=True):
        rel = ' '.join(tag.get('rel', [])).lower()
        href = urljoin(base_url, tag['href'])
        if any(r in rel for r in ('icon', 'apple-touch-icon', 'shortcut')):
            raw_assets.append((href, 'ico'))
        if tag.get('as') in ('image',):
            raw_assets.append((href, 'image'))

    for tag in soup.find_all(style=True):
        for u in _extract_from_css_content(tag['style'], base_url):
            raw_assets.append((u, 'image'))

    for tag in soup.find_all('meta'):
        prop = (tag.get('property', '') + tag.get('name', '')).lower()
        if 'image' in prop and tag.get('content'):
            val = tag['content']
            if val and not val.startswith('data:'):
                raw_assets.append((urljoin(base_url, val), 'image'))

    for tag in soup.find_all(True):
        for attr in ('data-bg', 'data-background', 'data-background-image',
                     'data-thumb', 'data-full', 'data-img', 'data-image-src',
                     'data-poster', 'data-cover'):
            val = tag.get(attr, '')
            if val and not val.startswith('data:'):
                raw_assets.append((urljoin(base_url, val), 'image'))

    for tag in soup.find_all('a', href=True):
        href = tag['href']
        raw_assets.append((urljoin(base_url, href), None))

    for script_tag in soup.find_all('script'):
        text = script_tag.get_text() or ''
        if len(text) > 100000:
            continue
        for u in _extract_urls_from_html_text(text, base_url):
            raw_assets.append((u, None))

    # ── Deduplicate and classify ──────────────────────────────────────────────
    seen: set[str] = set()
    assets: list[dict] = []
    MAX_ASSETS = 400

    for url, implied_type in raw_assets:
        if len(assets) >= MAX_ASSETS:
            break
        if not url or url.startswith('data:') or len(url) > 2000:
            continue

        clean = _clean_url(url)
        if clean in seen:
            continue
        seen.add(clean)

        path = urlparse(url).path.split('?')[0]
        last_seg = path.split('/')[-1]
        ext = ''
        if '.' in last_seg:
            ext = '.' + last_seg.rsplit('.', 1)[-1].lower()
            if len(ext) > 6:
                ext = ''

        media_type = _ext_to_type(ext)
        if not media_type:
            media_type = implied_type

        if not media_type:
            continue

        filename = _filename_from_url(url)

        asset: dict = {
            'url': url,
            'type': media_type,
            'ext': ext.lstrip('.'),
            'filename': filename,
            'width': None,
            'height': None,
            'size_bytes': None,
        }

        assets.append(asset)

    logger.info("scrape_media: %d raw assets → %d classified assets for %s", len(raw_assets), len(assets), page_url)

    # ── Probe image dimensions (best-effort, parallel) ─────────────────────────
    if assets:
        _probe_dimensions(assets, session)

    return assets


def _probe_dimensions(assets: list[dict], session) -> None:
    """For image-type assets, probe dimensions via Pillow (best-effort, parallel)."""
    try:
        from PIL import Image
        import io
        import concurrent.futures

        # Only probe a reasonable number of images
        image_assets = [a for a in assets if a['type'] in ('image', 'gif', 'ico')][:50]

        def probe_one(asset):
            url = asset['url']
            try:
                # HEAD request for size
                r = session.head(url, timeout=4, allow_redirects=True)
                cl = r.headers.get('Content-Length')
                if cl:
                    try:
                        asset['size_bytes'] = int(cl)
                    except ValueError:
                        pass

                # Skip SVGs — Pillow can't read them well
                if asset['type'] == 'svg':
                    return

                # GET first 48KB to read image header/dimensions
                r2 = session.get(url, timeout=6, stream=True)
                chunk = b''
                for c in r2.iter_content(49152):
                    chunk += c
                    break
                if chunk:
                    img = Image.open(io.BytesIO(chunk))
                    asset['width'], asset['height'] = img.size
                    if img.format:
                        detected_ext = img.format.lower()
                        if detected_ext == 'jpeg':
                            detected_ext = 'jpg'
                        if not asset['ext']:
                            asset['ext'] = detected_ext
                    # If we didn't get Content-Length from HEAD, estimate from file
                    if not asset['size_bytes']:
                        cl2 = r2.headers.get('Content-Length')
                        if cl2:
                            try:
                                asset['size_bytes'] = int(cl2)
                            except ValueError:
                                pass
            except Exception:
                pass  # Best-effort — silently skip failures

        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
            list(ex.map(probe_one, image_assets))

    except Exception:
        pass  # Pillow not installed — dimensions stay None



@media_fetch_bp.post("/media-fetch")
def media_fetch():
    """
    POST /api/media-fetch
    Body: { url: str }
    Returns: { success, data: [ { url, type, ext, filename, width, height, size_bytes } ] }
    """
    body = request.get_json(silent=True) or {}
    url: str = (body.get('url') or '').strip()

    if not url:
        return jsonify({'error': 'Missing URL', 'code': 'MISSING_URL'}), 400
    if not url.startswith(('http://', 'https://')):
        return jsonify({'error': 'URL must start with http:// or https://', 'code': 'INVALID_URL'}), 400

    try:
        assets = scrape_media(url)
        
        # Save scrape history to database
        import uuid
        import datetime
        import database
        
        media_count = len(assets)
        image_count = sum(1 for a in assets if a.get('type') in ('image', 'gif', 'svg'))
        video_count = sum(1 for a in assets if a.get('type') == 'video')
        audio_count = sum(1 for a in assets if a.get('type') == 'audio')
        favicon_count = sum(1 for a in assets if a.get('type') == 'ico')
        
        database.save_db_media_scrape_async({
            "id": str(uuid.uuid4()),
            "website_url": url,
            "media_count": media_count,
            "image_count": image_count,
            "video_count": video_count,
            "audio_count": audio_count,
            "favicon_count": favicon_count,
            "scanned_at": datetime.datetime.now().isoformat(timespec="seconds")
        })
        
        if not assets:
            return jsonify({
                'success': True,
                'data': [],
                'message': 'No media found. The page may use JavaScript rendering or blocked all requests.'
            }), 200
        logger.info("media-fetch: returning %d assets for %s", len(assets), url)
        return jsonify({'success': True, 'data': assets}), 200
    except RuntimeError as exc:
        logger.warning("media-fetch error for %s: %s", url, exc)
        return jsonify({'error': str(exc), 'code': 'FETCH_ERROR'}), 502
    except Exception as exc:
        logger.exception("media-fetch unexpected error for %s: %s", url, exc)
        return jsonify({'error': 'Internal error during media fetch', 'code': 'INTERNAL_ERROR'}), 500
