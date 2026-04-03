"""
playlist_uploader.py

playlist_jobs 테이블 폴링 → 영상 렌더링 → YouTube 업로드 → 플레이리스트 등록 워커

실행 시 채널 선택:
  python playlist_uploader.py          → 대화형 선택 메뉴
  python playlist_uploader.py --ch1    → 1번 채널만
  python playlist_uploader.py --ch2    → 2번 채널만
  python playlist_uploader.py --both   → 두 채널 모두 (순서대로)

크레덴셜 파일:
  client_secrets.json / token.json
  client_secrets_ch2.json / token_ch2.json

테이블 구조 (playlist_jobs):
  id, status, title, description, tracks_data (JSONB), youtube_url,
  playlist_id, thumbnail_url, error_message, created_at, updated_at

환경변수 (.env):
  SUPABASE_URL, SUPABASE_KEY
  FFMPEG_PATH
  PLAYLIST_WORK_DIR
  PLAYLIST_POLL_SEC           (기본: 15)
  PLAYLIST_UPLOAD_INTERVAL    (기본: 1800)
  PLAYLIST_MAX_DAILY          (기본: 10)
  PLAYLIST_FONT
  YOUTUBE_DEFAULT_PLAYLIST_ID_CH1   ← 채널 1 기본 플레이리스트 ID
  YOUTUBE_DEFAULT_PLAYLIST_ID_CH2   ← 채널 2 기본 플레이리스트 ID
"""

import json
import os
import shutil
import subprocess
import sys
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import List, Optional, Dict, Any

from dotenv import load_dotenv
from supabase import create_client, Client

from batch_youtube_uploader import (
    get_ffmpeg_cmd,
    ensure_ffmpeg,
    safe_filename,
    download_file,
    make_square_cover,
)
from youtube_uploader import (
    upload_video,
    get_authenticated_service_for_channel,
)

load_dotenv(dotenv_path=Path(__file__).with_name(".env"))

# ── 환경변수 ──────────────────────────────────────────────────────────────────
SUPABASE_URL        = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_KEY        = os.getenv("SUPABASE_KEY", "").strip()
WORK_DIR            = Path(os.getenv("PLAYLIST_WORK_DIR", "./_playlist_work")).resolve()
POLL_SEC            = int(os.getenv("PLAYLIST_POLL_SEC",        "15"))
UPLOAD_INTERVAL_SEC = int(os.getenv("PLAYLIST_UPLOAD_INTERVAL", "1800"))
MAX_DAILY           = int(os.getenv("PLAYLIST_MAX_DAILY",        "10"))
FONT_PATH           = os.getenv("PLAYLIST_FONT", "")

# 채널별 기본 플레이리스트 ID
DEFAULT_PLAYLIST_IDS = {
    "ch1": os.getenv("YOUTUBE_DEFAULT_PLAYLIST_ID_CH1", "").strip(),
    "ch2": os.getenv("YOUTUBE_DEFAULT_PLAYLIST_ID_CH2", "").strip(),
}

WORK_DIR.mkdir(parents=True, exist_ok=True)


# ══════════════════════════════════════════════════════════════════════════════
#  🎨  썸네일 오버레이 설정  ─  여기서 폰트·크기·효과를 자유롭게 수정하세요
#      (drawtext 필터 사용 — ASS 자막 대비 알파/투명도 완벽 지원)
# ══════════════════════════════════════════════════════════════════════════════
OVERLAY_CONFIG = {
    # 표시할 텍스트
    "text": "Chillin",

    # 폰트 파일 경로 (절대경로 권장). None 이면 font_name 으로 시스템 폰트 탐색
    # 예: "C:/Windows/Fonts/malgun.ttf"
    "font_file": None,

    # 폰트 이름 — font_file 이 None 일 때만 사용
    "font_name": os.getenv("PLAYLIST_FONT_NAME", "Chonburi"),

    # 폰트 크기 (px). None 이면 HEIGHT 의 1/10 자동 적용
    "font_size": 128,

    # 폰트 색상  (FFmpeg 색상명 or "#RRGGBB")
    "color": "white",               # 흰색

    # 테두리 색상 및 두께 (px, 0=없음)
    "border_color": "black",        # 검정
    "border_size": 0,

    # 그림자 색상, 불투명도(0.0~1.0), 오프셋 (px)
    "shadow_color": "black",        # 그림자 색
    "shadow_opacity": 0.5,          # 그림자 투명도 (0=완전투명, 1=완전불투명)
    "shadow_x": 6,
    "shadow_y": 6,

    # 페이드 인/아웃 (초)
    "fade_in_sec":  0.6,
    "fade_out_sec": 0.6,
}
# ══════════════════════════════════════════════════════════════════════════════


# ── 유틸 ─────────────────────────────────────────────────────────────────────
def log(msg: str):
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


def now_iso() -> str:
    return datetime.utcnow().isoformat() + "Z"


# ── 채널 선택 ─────────────────────────────────────────────────────────────────
def select_channels() -> List[str]:
    args = sys.argv[1:]

    if "--both" in args:
        return ["ch1", "ch2"]
    if "--ch1" in args:
        return ["ch1"]
    if "--ch2" in args:
        return ["ch2"]

    print()
    print("=" * 48)
    print("  YouTube 채널 선택")
    print("=" * 48)
    print("  [1] 채널 1 (ch1) 만 업로드")
    print("  [2] 채널 2 (ch2) 만 업로드")
    print("  [3] 두 채널 모두 업로드")
    print("=" * 48)

    while True:
        choice = input("  선택 (1/2/3): ").strip()
        if choice == "1":
            return ["ch1"]
        if choice == "2":
            return ["ch2"]
        if choice == "3":
            return ["ch1", "ch2"]
        print("  1, 2, 3 중 하나를 입력하세요.")


# ── Quota / 업로드 제한 처리 ──────────────────────────────────────────────────
try:
    from googleapiclient.errors import HttpError
except ImportError:
    HttpError = Exception


def _http_error_lower(e: Exception) -> str:
    try:
        return (e.content.decode("utf-8", errors="ignore") + " " + str(e)).lower()
    except Exception:
        return str(e).lower()


def is_quota_error(e: Exception) -> bool:
    s = _http_error_lower(e)
    return any(k in s for k in ("quotaexceeded", "dailylimitexceeded", "userratelimitexceeded"))


def is_upload_limit_error(e: Exception) -> bool:
    s = _http_error_lower(e)
    return "uploadlimitexceeded" in s or "exceeded the number of videos" in s


def sleep_until_utc_reset():
    now           = datetime.now(timezone.utc)
    next_midnight = (now + timedelta(days=1)).replace(hour=0, minute=0, second=10, microsecond=0)
    sec           = max(60, int((next_midnight - now).total_seconds()))
    hh, mm        = sec // 3600, (sec % 3600) // 60
    log(f"[Quota] Sleeping until UTC reset: ~{hh}h {mm}m")
    time.sleep(sec)


# ── 일일 카운터 ───────────────────────────────────────────────────────────────
_uploaded_today    = 0
_uploaded_date_utc = None


def _reset_daily_if_needed():
    global _uploaded_today, _uploaded_date_utc
    today = datetime.now(timezone.utc).date()
    if _uploaded_date_utc != today:
        _uploaded_date_utc = today
        _uploaded_today    = 0


def _increment_daily():
    global _uploaded_today
    _uploaded_today += 1


def _is_daily_limit_reached() -> bool:
    _reset_daily_if_needed()
    return _uploaded_today >= MAX_DAILY


# ── 플레이리스트 등록 ─────────────────────────────────────────────────────────
def add_video_to_playlist(youtube, video_id: str, playlist_id: str) -> bool:
    if not playlist_id or not video_id:
        return False
    try:
        response = youtube.playlistItems().insert(
            part="snippet",
            body={
                "snippet": {
                    "playlistId": playlist_id,
                    "resourceId": {
                        "kind":    "youtube#video",
                        "videoId": video_id,
                    },
                }
            },
        ).execute()
        log(f"[Playlist] ✅ Added to '{playlist_id}' (item: {response.get('id', '')})")
        return True
    except Exception as e:
        log(f"[Playlist] ⚠️  Failed to add to '{playlist_id}': {e}")
        return False


# ── 오디오 유틸 ───────────────────────────────────────────────────────────────
def get_audio_duration(audio_path: Path) -> float:
    ffmpeg  = get_ffmpeg_cmd()
    ffprobe = str(Path(ffmpeg).parent / "ffprobe") + (".exe" if os.name == "nt" else "")
    if not Path(ffprobe).exists():
        ffprobe = "ffprobe"
    result = subprocess.run(
        [ffprobe, "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(audio_path)],
        capture_output=True, text=True,
    )
    try:
        return float(result.stdout.strip())
    except Exception:
        return 0.0


def seconds_to_timestamp(seconds: float) -> str:
    s = int(seconds)
    h, rem = divmod(s, 3600)
    m, sec = divmod(rem, 60)
    if h > 0:
        return f"{h}:{m:02d}:{sec:02d}"
    return f"{m}:{sec:02d}"


def replace_tracklist(description: str, track_assets: list, timestamps: List[str]) -> str:
    lines  = description.splitlines()
    result = []
    i      = 0
    while i < len(lines):
        line = lines[i]
        if line.strip() == "[Tracklist]":
            result.append(line)
            i += 1
            while i < len(lines) and lines[i].strip() != "":
                i += 1
            for idx, asset in enumerate(track_assets):
                ts     = timestamps[idx] if idx < len(timestamps) else "0:00"
                title  = asset.get("title",  f"Track {idx+1}")
                artist = asset.get("artist", "Unknown")
                result.append(f"{ts} {artist} - {title}")
        else:
            result.append(line)
            i += 1
    return "\n".join(result)


# ── drawtext 오버레이 헬퍼 ──────────────────────────────────────────────────
def _esc(s: str) -> str:
    """drawtext 필터 문자열 내 특수문자 이스케이프."""
    return s.replace("\\", "\\\\").replace("'", "\\\'").replace(":", "\\:")


def _font_arg(cfg: dict) -> str:
    ff  = cfg.get("font_file")
    if ff:
        ff_esc = _esc(str(ff))
        return f"fontfile='{ff_esc}'"
    return f"font='{_esc(cfg.get('font_name', 'Chonburi'))}'"


def build_playlist_drawtext(duration: float, custom_cfg: dict = None) -> str:
    """
    OVERLAY_CONFIG → FFmpeg drawtext 필터 문자열 반환.
    텍스트를 화면 정중앙에 배치하고 페이드 인/아웃을 적용합니다.

    색상 형식: FFmpeg 색상명("white","black") 또는 "#RRGGBB"
    투명도는 fontcolor_expr 의 @알파식(0.0~1.0)으로 처리합니다.
    """
    cfg       = OVERLAY_CONFIG.copy()
    if custom_cfg:
        cfg.update(custom_cfg)

    text      = _esc(cfg.get("text", "Chillin"))
    font_arg  = _font_arg(cfg)
    font_size = cfg.get("font_size") if cfg.get("font_size") else RENDER_HEIGHT // 10
    color     = cfg.get("color", "white")
    bcolor    = cfg.get("border_color", "black")
    bsize     = cfg.get("border_size", 0)
    scolor    = cfg.get("shadow_color", "black")
    s_opacity = float(cfg.get("shadow_opacity", 0.5))
    sx        = cfg.get("shadow_x", 6)
    sy        = cfg.get("shadow_y", 6)
    shadow_color_str = f"{scolor}@{s_opacity:.2f}"
    parts = [
        f"text='{text}'",
        font_arg,
        f"fontsize={font_size}",
        f"fontcolor={color}",
        f"borderw={bsize}",
        f"bordercolor={bcolor}",
        f"shadowx={sx}",
        f"shadowy={sy}",
        f"shadowcolor={shadow_color_str}",
        f"x=(w-text_w)/2",
        f"y=(h-text_h)/2",
    ]
    return "drawtext=" + ":".join(parts)


# ── 영상 해상도 (16:9) ───────────────────────────────────────────────────────
RENDER_WIDTH  = 1920
RENDER_HEIGHT = 1080


# ── 영상 렌더링 ───────────────────────────────────────────────────────────────
def render_playlist_video(
    thumbnail_path: Path,
    audio_path: Path,
    output_path: Path,
    custom_cfg: dict = None,
) -> None:
    """
    thumbnail_path 이미지 1장(16:9 letterbox) + 합쳐진 audio_path 오디오로
    'playlist' 텍스트 오버레이가 포함된 단일 영상(1920×1080)을 생성합니다.
    drawtext 필터 사용 → 알파/투명도 완벽 지원.
    """
    cfg        = OVERLAY_CONFIG
    duration   = get_audio_duration(audio_path)
    fade_in    = cfg.get("fade_in_sec", 0.6)
    fade_out   = cfg.get("fade_out_sec", 0.6)
    dt_filter  = build_playlist_drawtext(duration, custom_cfg)

    vf = (
        f"scale={RENDER_WIDTH}:{RENDER_HEIGHT}:force_original_aspect_ratio=decrease,"
        f"pad={RENDER_WIDTH}:{RENDER_HEIGHT}:(ow-iw)/2:(oh-ih)/2:black,"
        f"{dt_filter},"
        f"fade=t=in:st=0:d={fade_in},"
        f"fade=t=out:st={duration - fade_out:.3f}:d={fade_out}"
    )

    ffmpeg = get_ffmpeg_cmd()
    cmd    = [
        ffmpeg, "-y",
        "-loop", "1", "-framerate", "30",
        "-i", str(thumbnail_path),
        "-i", str(audio_path),
        "-vf", vf,
        "-c:v", "libx264", "-tune", "stillimage",
        "-c:a", "aac", "-b:a", "192k",
        "-pix_fmt", "yuv420p",
        "-shortest",
        str(output_path),
    ]
    subprocess.run(cmd, check=True)


def concat_audios(audio_paths: List[Path], output_path: Path) -> None:
    """여러 오디오 파일을 하나로 이어붙입니다."""
    ffmpeg    = get_ffmpeg_cmd()
    list_file = output_path.with_suffix(".txt")
    with open(list_file, "w", encoding="utf-8") as f:
        for ap in audio_paths:
            f.write(f"file '{str(ap).replace(chr(92), '/')}'\n")
    cmd = [
        ffmpeg, "-y",
        "-f", "concat", "-safe", "0",
        "-i", str(list_file),
        "-c", "copy",
        str(output_path),
    ]
    try:
        subprocess.run(cmd, check=True)
    finally:
        list_file.unlink(missing_ok=True)


# ── Supabase ──────────────────────────────────────────────────────────────────
def claim_pending_job(sb: Client) -> Optional[Dict[str, Any]]:
    res = (
        sb.table("playlist_jobs")
        .select("*")
        .eq("status", "pending")
        .order("created_at", desc=False)
        .limit(1)
        .execute()
    )
    if not res.data:
        return None
    job = res.data[0]
    upd = (
        sb.table("playlist_jobs")
        .update({"status": "processing", "updated_at": now_iso()})
        .eq("id", job["id"])
        .eq("status", "pending")
        .execute()
    )
    if not upd.data:
        return None
    return job


def update_job(sb: Client, job_id: int, patch: Dict[str, Any]) -> None:
    patch["updated_at"] = now_iso()
    sb.table("playlist_jobs").update(patch).eq("id", job_id).execute()


# ── 단일 채널 업로드 ──────────────────────────────────────────────────────────
def _upload_to_channel(
    channel: str,
    final_video: Path,
    job_title: str,
    final_description: str,
    playlist_id: Optional[str],
    job_id: int,
    sb: Client,
    revert_on_quota: bool = True,
) -> Optional[str]:
    log(f"[Job #{job_id}] [{channel.upper()}] Authenticating...")
    youtube = get_authenticated_service_for_channel(channel)
    if not youtube:
        raise RuntimeError(f"[{channel}] YouTube authentication failed.")

    try:
        video_id, video_url = upload_video(
            file_path=str(final_video),
            title=job_title,
            description=final_description,
            privacy_status="public",
            youtube=youtube,
        )
    except Exception as yt_err:
        if is_quota_error(yt_err) or is_upload_limit_error(yt_err):
            if revert_on_quota:
                update_job(sb, job_id, {
                    "status":        "pending",
                    "error_message": f"[{channel}] Quota exceeded — retry after UTC reset: {yt_err}",
                })
                log(f"[Job #{job_id}] [{channel.upper()}] Quota exceeded — reverting to pending")
                sleep_until_utc_reset()
            return None
        raise

    _increment_daily()
    log(f"[Job #{job_id}] [{channel.upper()}] ✅ {video_url} (오늘 {_uploaded_today}/{MAX_DAILY})")

    if playlist_id:
        log(f"[Job #{job_id}] [{channel.upper()}] Adding to playlist '{playlist_id}'...")
        add_video_to_playlist(youtube, video_id, playlist_id)

    return video_url


# ── 메인 처리 ─────────────────────────────────────────────────────────────────
def process_job(sb: Client, job: Dict[str, Any], channels: List[str]) -> None:
    job_id        = job["id"]
    job_title     = (job.get("title")         or f"Playlist {job_id}").strip()
    description   = (job.get("description")   or "").strip()
    tracks_data   = job.get("tracks_data")    or []
    thumbnail_url = (job.get("thumbnail_url") or "").strip()
    overlay_config = job.get("overlay_config") or {}

    job_playlist_id = (job.get("playlist_id") or "").strip()

    if isinstance(tracks_data, str):
        tracks_data = json.loads(tracks_data)

    if not thumbnail_url:
        log(f"[Job #{job_id}] ❌ thumbnail_url is empty — skipping job.")
        update_job(sb, job_id, {
            "status":        "error",
            "error_message": "thumbnail_url is required but was empty.",
        })
        return

    log(f"[Job #{job_id}] '{job_title}' — {len(tracks_data)} tracks")
    log(f"[Job #{job_id}] Upload targets : {' + '.join(ch.upper() for ch in channels)}")
    for ch in channels:
        pid = job_playlist_id or DEFAULT_PLAYLIST_IDS.get(ch, "") or "(없음)"
        log(f"[Job #{job_id}] [{ch.upper()}] Playlist: {pid}")

    tmp_dir = WORK_DIR / safe_filename(f"{job_id}_{job_title}")
    tmp_dir.mkdir(parents=True, exist_ok=True)

    try:
        # ── 1. 썸네일 다운로드 ──────────────────────────────────────────────
        log(f"[Job #{job_id}] Downloading thumbnail...")
        thumb_raw  = tmp_dir / "thumbnail_raw"
        thumb_path = tmp_dir / "thumbnail.jpg"
        download_file(thumbnail_url, thumb_raw)
        make_square_cover(thumb_raw, thumb_path, size=1080)

        # ── 2. 오디오 다운로드 ──────────────────────────────────────────────
        log(f"[Job #{job_id}] Downloading audio tracks...")
        track_assets = []
        audio_paths  = []
        for i, track in enumerate(tracks_data):
            t_dir      = tmp_dir / f"track_{i:02d}"
            t_dir.mkdir(exist_ok=True)
            audio_path = t_dir / "audio"
            download_file((track.get("audio_url") or "").strip(), audio_path)
            audio_paths.append(audio_path)
            track_assets.append({
                "title":  (track.get("title")  or f"Track {i+1}").strip(),
                "artist": (track.get("artist") or "Unknown").strip(),
            })
            log(f"  [{i+1}/{len(tracks_data)}] {track_assets[-1]['artist']} — {track_assets[-1]['title']}")

        # ── 3. 타임스탬프 계산 ───────────────────────────────────────────────
        cumulative = 0.0
        timestamps = []
        for ap in audio_paths:
            timestamps.append(seconds_to_timestamp(cumulative))
            cumulative += get_audio_duration(ap)

        final_description = replace_tracklist(description, track_assets, timestamps)
        log(f"[Job #{job_id}] Timestamps: {timestamps}")

        # ── 4. 오디오 합치기 ────────────────────────────────────────────────
        merged_audio = tmp_dir / "merged_audio.m4a"
        if len(audio_paths) == 1:
            shutil.copy2(audio_paths[0], merged_audio)
        else:
            log(f"[Job #{job_id}] Merging {len(audio_paths)} audio tracks...")
            concat_audios(audio_paths, merged_audio)

        # ── 5. 썸네일 + 합쳐진 오디오로 단일 영상 렌더링 ────────────────────
        final_video = tmp_dir / "final.mp4"
        log(f"[Job #{job_id}] Rendering final video (thumbnail + overlay)...")
        render_playlist_video(
            thumbnail_path=thumb_path,
            audio_path=merged_audio,
            output_path=final_video,
            custom_cfg=overlay_config
        )

        log(f"[Job #{job_id}] Final: {final_video} ({final_video.stat().st_size/1024/1024:.1f} MB)")

        # ── 6. 채널별 업로드 ─────────────────────────────────────────────────
        uploaded_urls = {}
        for channel in channels:
            ch_playlist_id = job_playlist_id or DEFAULT_PLAYLIST_IDS.get(channel, "") or None
            url = _upload_to_channel(
                channel=channel,
                final_video=final_video,
                job_title=job_title,
                final_description=final_description,
                playlist_id=ch_playlist_id,
                job_id=job_id,
                sb=sb,
                revert_on_quota=(len(channels) == 1),
            )
            if url:
                uploaded_urls[channel] = url

        if not uploaded_urls:
            return

        # ── 7. DB 업데이트 ───────────────────────────────────────────────────
        primary_url = uploaded_urls.get("ch1") or uploaded_urls.get("ch2")
        update_job(sb, job_id, {
            "status":        "done",
            "youtube_url":   primary_url,
            "error_message": None,
        })
        log(f"[Job #{job_id}] ✅ Done. URLs: {uploaded_urls}")

        # ── 8. 사용된 썸네일 삭제 ───────────────────────────────────────────
        if thumbnail_url and "music_assets/" in thumbnail_url:
            try:
                storage_path = thumbnail_url.split("music_assets/")[-1].split("?")[0]
                if storage_path.startswith("playlist_thumbnails/"):
                    log(f"[Job #{job_id}] Cleaning up used thumbnail from storage: {storage_path}")
                    sb.storage.from_("music_assets").remove([storage_path])
            except Exception as e:
                log(f"[WARN] Failed to delete thumbnail from storage: {e}")

    except Exception as e:
        log(f"[Job #{job_id}] ❌ Error: {e}")
        import traceback
        traceback.print_exc()
        update_job(sb, job_id, {
            "status":        "error",
            "error_message": str(e)[:1000],
        })

    finally:
        try:
            shutil.rmtree(tmp_dir)
            log(f"[Job #{job_id}] Cleaned up {tmp_dir}")
        except Exception as e:
            log(f"[WARN] Cleanup failed: {e}")


# ── 워커 루프 ─────────────────────────────────────────────────────────────────
def run_playlist_worker(channels: List[str]):
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise RuntimeError("Missing SUPABASE_URL or SUPABASE_KEY in .env")

    ensure_ffmpeg()
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    log("🎵 Playlist Worker Started.")
    log(f"   Channels        : {' + '.join(ch.upper() for ch in channels)}")
    log(f"   Poll interval   : {POLL_SEC}s")
    log(f"   Upload interval : {UPLOAD_INTERVAL_SEC // 60} min")
    log(f"   Daily max       : {MAX_DAILY} uploads")
    log(f"   Work dir        : {WORK_DIR}")
    log(f"   CH1 playlist    : {DEFAULT_PLAYLIST_IDS['ch1'] or '(none)'}")
    log(f"   CH2 playlist    : {DEFAULT_PLAYLIST_IDS['ch2'] or '(none)'}")
    log(f"   Overlay text    : '{OVERLAY_CONFIG['text']}' / font={OVERLAY_CONFIG['font_name']} / size={OVERLAY_CONFIG['font_size'] or 'auto'}")

    while True:
        try:
            _reset_daily_if_needed()

            if _is_daily_limit_reached():
                log(f"[Limit] Daily limit {MAX_DAILY} reached. Sleeping until UTC reset...")
                sleep_until_utc_reset()
                continue

            job = claim_pending_job(sb)
            if not job:
                time.sleep(POLL_SEC)
                continue

            process_job(sb, job, channels)

            if _uploaded_today > 0:
                log(f"[Wait] Next upload in {UPLOAD_INTERVAL_SEC // 60} min...")
                time.sleep(UPLOAD_INTERVAL_SEC)

        except KeyboardInterrupt:
            log("Stopped.")
            break
        except Exception as e:
            log(f"[FATAL] {e}")
            time.sleep(30)


if __name__ == "__main__":
    channels = select_channels()
    print(f"\n  → {' + '.join(ch.upper() for ch in channels)} 로 업로드합니다.\n")
    run_playlist_worker(channels)