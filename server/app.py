"""
İndir Gitsin - FastAPI Backend
YouTube / YouTube Music indirme sunucusu (yt-dlp tabanlı)
Çalıştır:  python server/app.py
Gereksinim: pip install -r server/requirements.txt
"""
import re
import os
import tempfile
from pathlib import Path
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

try:
    import yt_dlp
    HAS_YTDLP = True
except ImportError:
    HAS_YTDLP = False

app = FastAPI(title="İndir Gitsin API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve frontend static files if present (for single-server deploy)
ROOT = Path(__file__).resolve().parent.parent
if (ROOT / "assets").exists():
    app.mount("/assets", StaticFiles(directory=str(ROOT / "assets")), name="assets")

YOUTUBE_RE = re.compile(r"(https?://)?(www\.|music\.|m\.)?(youtube\.com|youtu\.be)/\S+")

# Preset selector mapping for MP4 + audio (guaranteed video via merging)
PRESET_MAP = {
    "mp4_1080": "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best[height<=1080]",
    "mp4_720": "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best[height<=720]",
    "mp4_480": "bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=480]+bestaudio/best[height<=480]",
    "mp4_360": "bestvideo[height<=360][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=360]+bestaudio/best[height<=360]",
    "m4a": "bestaudio[ext=m4a]/bestaudio/best",
    "mp3": "bestaudio/best",
}

def extract_id(url: str):
    m = re.search(r"(?:v=|\.be/|shorts/)([A-Za-z0-9_-]{6,11})", url)
    return m.group(1) if m else "unknown"

@app.get("/api/health")
def health():
    import shutil
    return {"ok": True, "yt_dlp": HAS_YTDLP, "ffmpeg": bool(shutil.which("ffmpeg")), "app": "İndir Gitsin"}

@app.get("/api/info")
def info(url: str = Query(..., description="YouTube URL")):
    if not YOUTUBE_RE.search(url):
        raise HTTPException(400, "Geçersiz YouTube linki")
    if not HAS_YTDLP:
        # fallback mock when yt_dlp not installed
        vid = extract_id(url)
        return {
            "id": vid,
            "title": "Demo Başlık (yt-dlp kurulu değil — pip install yt-dlp yapın)",
            "channel": "Demo Kanal",
            "duration": 212,
            "views": "1.2M",
            "thumbnail": f"https://img.youtube.com/vi/{vid}/hqdefault.jpg",
            "url": url,
            "formats": [
                {"id":"22","label":"MP4 720p","ext":"mp4","quality":"720p","type":"video","size":"~45 MB","hasAudio":True},
                {"id":"18","label":"MP4 360p","ext":"mp4","quality":"360p","type":"video","size":"~18 MB","hasAudio":True},
                {"id":"140","label":"M4A 128kbps","ext":"m4a","quality":"128kbps","type":"audio","size":"~3.5 MB"},
                {"id":"mp3","label":"MP3 320kbps","ext":"mp3","quality":"320kbps","type":"audio","size":"~5 MB"},
            ]
        }

    ydl_opts = {
        "quiet": True,
        "skip_download": True,
        "no_warnings": True,
        "extract_flat": False,
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            data = ydl.extract_info(url, download=False)
            # handle playlist: take first entry
            if "entries" in data and data["entries"]:
                data = list(data["entries"])[0]
            vid = data.get("id") or extract_id(url)
            title = data.get("title","Bilinmeyen Başlık")
            channel = data.get("uploader") or data.get("channel") or "YouTube"
            duration = data.get("duration") or 0
            views = data.get("view_count")
            views_str = f"{views:,}".replace(",",".") if views else ""
            thumb = data.get("thumbnail") or f"https://img.youtube.com/vi/{vid}/hqdefault.jpg"
            # Build format list: pick best per height + audio only + presets (MP4 merging)
            formats = []
            seen = set()
            fmts = data.get("formats") or []
            # Video with audio (direct combined)
            for f in fmts:
                ext = f.get("ext")
                h = f.get("height")
                acodec = f.get("acodec")
                vcodec = f.get("vcodec")
                fid = f.get("format_id")
                if vcodec != "none" and acodec != "none" and h and ext in ("mp4","webm"):
                    key = f"{h}_{ext}"
                    if key in seen: continue
                    seen.add(key)
                    size = f.get("filesize") or f.get("filesize_approx")
                    size_str = f"~{round(size/1024/1024)} MB" if size else ""
                    formats.append({"id":str(fid),"label":f"MP4 {h}p" if ext=="mp4" else f"{ext.upper()} {h}p","ext":ext,"quality":f"{h}p","type":"video","size":size_str,"hasAudio":True,"fps":f.get("fps")})
            # sort video descending
            formats.sort(key=lambda x: int(x["quality"].replace("p","").replace("kbps","")) if "p" in x["quality"] else 0, reverse=True)

            # Determine max height for preset filtering
            heights = [f.get("height") for f in fmts if f.get("height")]
            max_h = max(heights) if heights else 720

            # Add MP4 merge presets (guaranteed video via ffmpeg merge) if not already covered
            preset_defs = [
                ("mp4_1080", "MP4 1080p", "1080p", 1080),
                ("mp4_720", "MP4 720p", "720p", 720),
                ("mp4_480", "MP4 480p", "480p", 480),
                ("mp4_360", "MP4 360p", "360p", 360),
            ]
            existing_qualities = {x["quality"] for x in formats}
            for pid, label, qual, h in preset_defs:
                if h <= max_h + 180 and qual not in existing_qualities:  # allow one above max for fallback
                    formats.append({"id": pid, "label": f"{label} (MP4)", "ext": "mp4", "quality": qual, "type": "video", "size": "", "hasAudio": True})

            # Audio only
            audio_added=False
            for f in reversed(fmts):
                if f.get("vcodec")=="none" and f.get("acodec")!="none":
                    ext=f.get("ext"); fid=f.get("format_id"); abr=f.get("abr")
                    label = f"{ext.upper()} {int(abr)}kbps" if abr else ext.upper()
                    if not audio_added:
                        formats.append({"id":"m4a","label":"M4A (Ses)","ext":"m4a","quality":f"{int(abr)}kbps" if abr else "128kbps","type":"audio","size":""})
                        audio_added=True
                        break
            if not audio_added:
                formats.append({"id":"m4a","label":"M4A (Ses)","ext":"m4a","quality":"128kbps","type":"audio","size":""})
            # Always add mp3 convert option
            formats.append({"id":"mp3","label":"MP3 320kbps","ext":"mp3","quality":"320kbps","type":"audio","size":""})
            # Deduplicate by id and keep order video first
            uniq = {}
            for f in formats:
                if f["id"] not in uniq:
                    uniq[f["id"]] = f
            # Re-sort: video by height desc, then audio
            videos = [v for v in uniq.values() if v["type"]=="video"]
            audios = [v for v in uniq.values() if v["type"]=="audio"]
            def hval(x):
                try: return int(x["quality"].replace("p",""))
                except: return 0
            videos.sort(key=hval, reverse=True)
            formats = videos + audios
            if not formats:
                formats = [
                    {"id":"mp4_360","label":"MP4 360p (MP4)","ext":"mp4","quality":"360p","type":"video","size":""},
                    {"id":"m4a","label":"M4A (Ses)","ext":"m4a","quality":"128kbps","type":"audio","size":""},
                ]
            return {
                "id": vid,
                "title": title,
                "channel": channel,
                "duration": duration,
                "views": views_str,
                "thumbnail": thumb,
                "url": url,
                "formats": formats[:8],
            }
    except Exception as e:
        raise HTTPException(500, f"Video çözümlenemedi: {e}")

@app.get("/api/download")
def download(url: str = Query(...), format_id: str = Query("18"), ext: str = Query("mp4")):
    if not YOUTUBE_RE.search(url):
        raise HTTPException(400, "Geçersiz link")
    if not HAS_YTDLP:
        raise HTTPException(503, "Sunucuda yt-dlp kurulu değil. pip install yt-dlp")
    tmpdir = tempfile.mkdtemp()
    import shutil
    has_ffmpeg = bool(shutil.which("ffmpeg"))
    # map preset id -> yt-dlp selector
    if format_id in PRESET_MAP:
        if not has_ffmpeg and format_id == "mp3":
            raise HTTPException(500, "MP3 için ffmpeg gerekli. Lütfen ffmpeg kurun veya M4A seçin.")
        selector = PRESET_MAP[format_id]
        if format_id.startswith("mp4_"):
            ext = "mp4"
        elif format_id == "m4a":
            ext = "m4a"
        elif format_id == "mp3":
            ext = "mp3"
    else:
        selector = format_id
    # sanitize format
    is_mp3 = format_id == "mp3" or ext == "mp3"
    if is_mp3:
        ydl_opts = {
            "format": selector if selector not in ("mp3","") else "bestaudio/best",
            "outtmpl": os.path.join(tmpdir, "%(title).80s.%(ext)s"),
            "postprocessors": [{"key":"FFmpegExtractAudio","preferredcodec":"mp3","preferredquality":"192"}],
            "quiet": True,
        }
    else:
        # for mp4 presets ensure merging only if ffmpeg available
        ydl_opts = {
            "format": selector if selector else "best",
            "outtmpl": os.path.join(tmpdir, "%(title).80s.%(ext)s"),
            "merge_output_format": ext if ext in ("mp4","webm","mkv") else "mp4",
            "quiet": True,
        }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            # find downloaded file
            files = list(Path(tmpdir).glob("*"))
            if not files:
                raise HTTPException(500, "Dosya oluşturulamadı (ffmpeg gerekli olabilir)")
            fpath = max(files, key=lambda p: p.stat().st_size)
            # Clean filename for download
            filename = fpath.name
            return FileResponse(str(fpath), filename=filename, media_type="application/octet-stream", background=None)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"İndirme hatası: {e}")

@app.get("/")
def root():
    # serve index.html if exists
    idx = ROOT / "index.html"
    if idx.exists():
        return FileResponse(str(idx))
    return JSONResponse({"app":"İndir Gitsin","health":"/api/health","info":"/api/info?url=..."})

if __name__ == "__main__":
    import uvicorn
    print("İndir Gitsin sunucusu başlatılıyor...")
    print("Tarayıcı: http://localhost:8000")
    print("Sağlık:   http://localhost:8000/api/health")
    print("Önizleme: APK olmadan tarayıcıdan test edebilirsiniz!")
    uvicorn.run(app, host="0.0.0.0", port=8000)
