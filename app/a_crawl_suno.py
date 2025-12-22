import csv
import os
import random
import re
import time
from dataclasses import dataclass
from typing import List, Dict, Any

import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import (
    TimeoutException,
    ElementClickInterceptedException,
    ElementNotInteractableException,
)


# =========================
# ✅ CONFIG
# =========================
CONSTANTS_TS_PATH = r"C:\Users\taewo\PycharmProjects\test_project\constants.ts"
OUTPUT_CSV_PATH   = r"C:\Users\taewo\PycharmProjects\test_project\tracks_seed.csv"

NUM_ROWS = 80

# ✅ 30~45초 랜덤 (30 + 0~15)
BASE_INTERVAL_SEC = 30
JITTER_MIN_SEC = 0
JITTER_MAX_SEC = 15

MAX_RETRIES = 3

PROGRESS_PATH = r"C:\Users\taewo\PycharmProjects\test_project\progress.txt"
RUN_LOG_PATH  = r"C:\Users\taewo\PycharmProjects\test_project\run_log.csv"

CHROME_PROFILE_DIR = r"C:\Temp\ChromeTest"
SUNO_URL = "https://suno.com/"
# =========================


# -------------------------
# LOG / PROGRESS
# -------------------------
def now_ts():
    return time.strftime("%Y-%m-%d %H:%M:%S")


def log_csv(index: int, title: str, status: str, message: str):
    file_exists = os.path.exists(RUN_LOG_PATH)
    with open(RUN_LOG_PATH, "a", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["ts", "index", "title", "status", "message"])
        if not file_exists:
            w.writeheader()
        w.writerow({
            "ts": now_ts(),
            "index": index,
            "title": title,
            "status": status,
            "message": (message or "")[:500],
        })


def load_progress(default_index=0) -> int:
    if not os.path.exists(PROGRESS_PATH):
        return default_index
    try:
        with open(PROGRESS_PATH, "r", encoding="utf-8") as f:
            return int((f.read() or "").strip() or default_index)
    except Exception:
        return default_index


def save_progress(next_index: int):
    with open(PROGRESS_PATH, "w", encoding="utf-8") as f:
        f.write(str(next_index))


def save_debug_artifacts(driver, prefix: str):
    try:
        driver.save_screenshot(f"{prefix}.png")
    except Exception:
        pass
    try:
        with open(f"{prefix}.html", "w", encoding="utf-8") as f:
            f.write(driver.page_source)
    except Exception:
        pass


# -------------------------
# HUMAN-LIKE (가볍게만)
# -------------------------
def human_pause(a=0.08, b=0.35):
    time.sleep(random.uniform(a, b))


def human_scroll(driver):
    try:
        amt = random.randint(120, 520) * random.choice([1, -1])
        driver.execute_script("window.scrollBy(0, arguments[0]);", amt)
    except Exception:
        pass
    human_pause(0.06, 0.22)


def human_move_to(driver, element):
    try:
        ActionChains(driver).move_to_element(element).pause(random.uniform(0.05, 0.18)).perform()
    except Exception:
        pass


def wait_interval_since(last_action_time: float):
    wait_sec = BASE_INTERVAL_SEC + random.uniform(JITTER_MIN_SEC, JITTER_MAX_SEC)
    elapsed = time.time() - last_action_time
    if elapsed < wait_sec:
        time.sleep(wait_sec - elapsed)


# -------------------------
# POPUP DISMISS (Not now / X)
# -------------------------
def try_click(driver, by, selector, timeout=1.0) -> bool:
    try:
        el = WebDriverWait(driver, timeout).until(EC.element_to_be_clickable((by, selector)))
        driver.execute_script("arguments[0].scrollIntoView({block:'center'});", el)
        human_move_to(driver, el)
        try:
            el.click()
        except ElementClickInterceptedException:
            driver.execute_script("arguments[0].click();", el)
        return True
    except Exception:
        return False


def dismiss_popups_best_effort(driver, tries=3):
    for _ in range(tries):
        closed = False
        closed |= try_click(driver, By.XPATH, "//button[.//span[normalize-space()='Not now'] or normalize-space()='Not now']", timeout=0.8)
        closed |= try_click(driver, By.CSS_SELECTOR, "button[aria-label='Close']", timeout=0.8)
        try:
            driver.switch_to.active_element.send_keys(Keys.ESCAPE)
        except Exception:
            pass
        if not closed:
            return
        human_pause(0.08, 0.25)


# -------------------------
# CAPTCHA (무한대기 금지)
# -------------------------
def is_visible_captcha_iframe(driver) -> bool:
    keywords = ["recaptcha", "hcaptcha", "turnstile", "arkoselabs", "captcha"]
    try:
        frames = driver.find_elements(By.TAG_NAME, "iframe")
    except Exception:
        return False

    for fr in frames:
        try:
            src = (fr.get_attribute("src") or "").lower()
            title = (fr.get_attribute("title") or "").lower()
            if not (any(k in src for k in keywords) or any(k in title for k in keywords)):
                continue
            if not fr.is_displayed():
                continue
            rect = fr.rect or {}
            if rect.get("width", 0) < 60 or rect.get("height", 0) < 60:
                continue
            return True
        except Exception:
            continue
    return False


def wait_captcha_if_present(driver, max_wait_sec=120):
    if not is_visible_captcha_iframe(driver):
        return

    print(f"[CAPTCHA] Visible captcha detected. Solve manually (up to {max_wait_sec}s)...")
    t0 = time.time()
    while time.time() - t0 < max_wait_sec:
        dismiss_popups_best_effort(driver, tries=1)
        if not is_visible_captcha_iframe(driver):
            print("[CAPTCHA] Cleared. Continuing.")
            return
        time.sleep(1.0)

    print("[CAPTCHA] Still present after max wait. Continuing anyway (may fail).")


# -------------------------
# ✅ 핵심: Create idle 대기 (짧게만, 멈춤 방지)
# -------------------------
def wait_until_create_idle(driver, timeout=25):
    """
    interactable 문제의 핵심 해결:
    - 이전 생성이 끝나고 다시 입력 가능한 상태(idle)인지 짧게 확인
    """
    end = time.time() + timeout
    while time.time() < end:
        dismiss_popups_best_effort(driver, tries=1)
        if is_visible_captcha_iframe(driver):
            wait_captcha_if_present(driver, max_wait_sec=120)

        try:
            btn = driver.find_element(By.CSS_SELECTOR, "button[aria-label='Create song']")
            aria_busy = (btn.get_attribute("aria-busy") or "").lower()
            disabled = btn.get_attribute("disabled")

            # busy도 아니고, disabled도 아니면 idle로 간주
            if btn.is_displayed() and (aria_busy != "true") and (disabled is None):
                return True
        except Exception:
            pass

        time.sleep(0.3)

    # timeout이면 그냥 넘어가되, 다음 단계에서 JS fallback으로 최대한 시도
    return False


# -------------------------
# DISCORD LOGIN -> SUNO
# -------------------------
def safe_click(driver, locator, timeout=20):
    wait = WebDriverWait(driver, timeout)
    el = wait.until(EC.element_to_be_clickable(locator))
    driver.execute_script("arguments[0].scrollIntoView({block:'center'});", el)
    human_move_to(driver, el)
    try:
        el.click()
    except ElementClickInterceptedException:
        driver.execute_script("arguments[0].click();", el)
    return el


def login_suno_with_discord(driver, email: str, password: str):
    wait = WebDriverWait(driver, 30)

    # 세션 남아있으면 스킵
    driver.get("https://suno.com/create")
    human_pause(0.8, 1.2)
    if "suno.com/create" in driver.current_url.lower():
        return

    driver.get(SUNO_URL)
    human_pause(0.5, 1.0)

    safe_click(
        driver,
        (By.XPATH, "//span[normalize-space()='Sign In' or normalize-space()='Sign in']/ancestor::button[1]"),
        timeout=30
    )

    wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "div.cl-modalBackdrop, div[class*='cl-modalBackdrop']")))
    human_pause(0.2, 0.5)

    safe_click(
        driver,
        (By.XPATH, "//button[contains(@class,'cl-socialButtonsIconButton__discord') or .//img[contains(@alt,'Discord')]]"),
        timeout=30
    )
    human_pause(1.0, 2.0)

    handles = driver.window_handles
    if len(handles) > 1:
        driver.switch_to.window(handles[-1])

    wait.until(EC.presence_of_element_located((By.NAME, "email")))

    driver.find_element(By.NAME, "email").clear()
    driver.find_element(By.NAME, "email").send_keys(email)
    human_pause(0.2, 0.6)

    driver.find_element(By.NAME, "password").clear()
    driver.find_element(By.NAME, "password").send_keys(password)
    human_pause(0.2, 0.6)

    safe_click(
        driver,
        (By.XPATH, "//button[@type='submit' and (contains(.,'로그인') or contains(.,'Log In') or contains(.,'Login'))]"),
        timeout=30
    )

    try:
        safe_click(
            driver,
            (By.XPATH, "//button[( @type='button' or @type='submit') and (contains(.,'승인') or contains(.,'Authorize'))]"),
            timeout=12
        )
    except Exception:
        pass

    WebDriverWait(driver, 60).until(lambda d: "suno.com" in d.current_url.lower())


# -------------------------
# constants.ts -> CSV
# -------------------------
@dataclass
class TrackSeed:
    title: str
    genre: str
    moods: List[str]
    context_tags: List[str]
    bpm: int
    description: str


def read_file(path: str) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def parse_ts_string_array(ts: str, const_name: str) -> List[str]:
    m = re.search(rf"export\s+const\s+{re.escape(const_name)}\s*=\s*\[(.*?)\]\s*;", ts, re.S)
    if not m:
        raise RuntimeError(f"constants.ts에서 {const_name} 배열을 못 찾음")
    block = m.group(1)
    items = re.findall(r"""["']([^"']+)["']""", block)
    return [x.strip() for x in items if x.strip()]


def parse_music_scenarios(ts: str) -> List[Dict[str, Any]]:
    scenarios = []
    for mm in re.finditer(
        r"\{\s*id:\s*'([^']+)'.*?title:\s*'([^']+)'.*?tags:\s*\[([^\]]*)\]",
        ts,
        re.S
    ):
        sid = mm.group(1).strip()
        title = mm.group(2).strip()
        tags_raw = mm.group(3)
        tags = [t.strip().strip("'\"") for t in tags_raw.split(",") if t.strip()]
        scenarios.append({"id": sid, "title": title, "tags": tags})
    if not scenarios:
        raise RuntimeError("constants.ts에서 MUSIC_SCENARIOS 파싱 실패")
    return scenarios


def choose_bpm(genre: str, scenario_id: str) -> int:
    g = genre.lower()
    if "lo-fi" in g or "lofi" in g:
        return random.randint(70, 92)
    if "house" in g or "techno" in g or "edm" in g:
        return random.randint(120, 132)
    if "trap" in g or "phonk" in g:
        return random.randint(130, 155)
    if "hip-hop" in g or "hip hop" in g:
        return random.randint(80, 105)
    if "r&b" in g or "rnb" in g:
        return random.randint(72, 98)
    if scenario_id in ("coding", "study", "sleep"):
        return random.randint(68, 92)
    if scenario_id in ("workout", "party"):
        return random.randint(120, 150)
    return random.randint(90, 125)


def slug_title(genre: str, moods: List[str], scenario_title: str) -> str:
    base = f"{genre} / {moods[0]} {moods[1]} - {scenario_title}"
    base = re.sub(r"\s+", " ", base).strip()
    return base[:70]


def build_prompt(seed: TrackSeed) -> str:
    moods = ", ".join(seed.moods)
    tags = ", ".join(seed.context_tags[:8])

    return (
        f'Title: "{seed.title}"\n'
        f"Language: English only\n"
        f"Genre: {seed.genre}\n"
        f"Mood: {moods}\n"
        f"Context tags: {tags}\n"
        f"BPM: {seed.bpm}\n\n"
        f"Instructions (English only):\n"
        f"- Emphasizing Bass.\n"
        f"- Write original English lyrics only (no other languages).\n"
        f"- Catchy hook, clear verse/chorus structure.\n"
        f"- Modern production, clean mix, strong low-end.\n"
        f"- No explicit content.\n"
    )


def generate_csv_from_constants(constants_path: str, out_csv: str, n_rows: int, seed: int = 42):
    random.seed(seed)
    ts = read_file(constants_path)

    genres = parse_ts_string_array(ts, "MUSIC_GENRES")
    moods_all = parse_ts_string_array(ts, "MUSIC_MOODS")
    tags_pool = parse_ts_string_array(ts, "MUSIC_TAGS")
    scenarios = parse_music_scenarios(ts)

    rows: List[TrackSeed] = []
    for _ in range(n_rows):
        genre = random.choice(genres)
        moods = random.sample(moods_all, k=2)
        scenario = random.choice(scenarios)

        ctx = list(dict.fromkeys(scenario["tags"] + random.sample(tags_pool, k=5)))
        bpm = choose_bpm(genre, scenario["id"])
        title = slug_title(genre, moods, scenario["title"])

        seed_row = TrackSeed(
            title=title,
            genre=genre,
            moods=moods,
            context_tags=ctx,
            bpm=bpm,
            description=""
        )
        seed_row.description = build_prompt(seed_row)
        rows.append(seed_row)

    with open(out_csv, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["title", "genre", "moods", "context_tags", "bpm", "description"])
        for r in rows:
            w.writerow([r.title, r.genre, "|".join(r.moods), "|".join(r.context_tags), r.bpm, r.description])

    print(f"✅ CSV generated: {out_csv} (rows={len(rows)})")


# -------------------------
# CREATE: textarea 선택을 "보이는 것만"으로
# -------------------------
def get_visible_textarea(driver, timeout=12):
    """
    //textarea 하나만 잡으면 숨김 textarea 잡는 경우가 있어서
    displayed + size 체크로 "진짜 입력용" textarea만 선택
    """
    end = time.time() + timeout
    WebDriverWait(driver, timeout).until(EC.presence_of_all_elements_located((By.TAG_NAME, "textarea")))

    while time.time() < end:
        areas = driver.find_elements(By.TAG_NAME, "textarea")
        for ta in areas:
            try:
                if not ta.is_displayed() or not ta.is_enabled():
                    continue
                rect = ta.rect or {}
                if rect.get("width", 0) < 60 or rect.get("height", 0) < 40:
                    continue
                return ta
            except Exception:
                continue
        time.sleep(0.2)

    raise TimeoutException("No visible textarea found.")


def fill_prompt_simple(driver, prompt: str):
    dismiss_popups_best_effort(driver, tries=2)
    wait_captcha_if_present(driver, max_wait_sec=120)

    # ✅ 입력 전에 idle 확인 (이게 interactable 문제 대부분 해결)
    wait_until_create_idle(driver, timeout=25)

    ta = get_visible_textarea(driver, timeout=12)
    driver.execute_script("arguments[0].scrollIntoView({block:'center'});", ta)

    # 클릭/삭제/입력
    try:
        ta.click()
    except Exception:
        driver.execute_script("arguments[0].click();", ta)

    try:
        ta.send_keys(Keys.CONTROL, "a")
        ta.send_keys(Keys.BACKSPACE)
        ta.send_keys(prompt)
        ta.send_keys(Keys.ENTER)  # 요청: Enter 1번
        return
    except (ElementNotInteractableException, ElementClickInterceptedException):
        pass

    # JS fallback
    driver.execute_script(
        """
        const el = arguments[0];
        const value = arguments[1];
        el.focus();
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        """,
        ta, prompt
    )
    try:
        ta.send_keys(Keys.ENTER)
    except Exception:
        pass


def click_create_simple(driver):
    dismiss_popups_best_effort(driver, tries=2)
    wait_captcha_if_present(driver, max_wait_sec=120)

    btn = WebDriverWait(driver, 12).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, "button[aria-label='Create song']"))
    )
    driver.execute_script("arguments[0].scrollIntoView({block:'center'});", btn)
    human_move_to(driver, btn)
    human_pause(0.05, 0.25)

    try:
        btn.click()
    except ElementClickInterceptedException:
        driver.execute_script("arguments[0].click();", btn)


def create_once_simple(driver, prompt: str):
    fill_prompt_simple(driver, prompt)
    click_create_simple(driver)


# -------------------------
# DRIVER
# -------------------------
def build_driver_uc():
    options = uc.ChromeOptions()
    options.add_argument("--start-maximized")
    options.add_argument("--disable-notifications")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument(f"--user-data-dir={CHROME_PROFILE_DIR}")
    return uc.Chrome(options=options)


# -------------------------
# MAIN LOOP
# -------------------------
def run_loop(driver, csv_path: str):
    with open(csv_path, "r", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    start_index = load_progress(0)
    print(f"[INFO] Resume start_index={start_index}")
    print(f"[INFO] Interval random range: {BASE_INTERVAL_SEC + JITTER_MIN_SEC:.0f}s ~ {BASE_INTERVAL_SEC + JITTER_MAX_SEC:.0f}s")

    driver.get("https://suno.com/create")
    time.sleep(1)
    dismiss_popups_best_effort(driver, tries=4)
    wait_captcha_if_present(driver, max_wait_sec=120)

    last_action_time = 0.0

    for i in range(start_index, len(rows)):
        title = rows[i]["title"]
        prompt = rows[i]["description"]

        if last_action_time > 0:
            wait_interval_since(last_action_time)

        if random.random() < 0.35:
            human_scroll(driver)

        ok = False
        last_msg = ""

        for attempt in range(1, MAX_RETRIES + 1):
            try:
                print(f"[{i+1}/{len(rows)}] Creating (attempt {attempt}): {title}")

                dismiss_popups_best_effort(driver, tries=2)
                create_once_simple(driver, prompt)

                # 요청 시작 안정화용 아주 짧은 pause
                time.sleep(random.uniform(1.0, 2.0))

                last_action_time = time.time()
                save_progress(i + 1)
                log_csv(i, title, "OK", "typed+enter+clicked create")
                ok = True
                break

            except Exception as e:
                last_msg = f"{type(e).__name__}: {e}"
                log_csv(i, title, f"RETRY_{attempt}", last_msg)
                print("[WARN]", last_msg)

                save_debug_artifacts(driver, f"fail_idx{i}_attempt{attempt}")

                dismiss_popups_best_effort(driver, tries=2)
                wait_captcha_if_present(driver, max_wait_sec=120)
                time.sleep(random.uniform(1.0, 2.5))

        if not ok:
            print(f"[ERROR] Failed at index={i} title={title} msg={last_msg}")
            log_csv(i, title, "FAIL", last_msg)
            break


def main():
    generate_csv_from_constants(CONSTANTS_TS_PATH, OUTPUT_CSV_PATH, NUM_ROWS, seed=42)

    driver = build_driver_uc()
    try:
        email = os.getenv("DISCORD_EMAIL", "alvin@bonanza-factory.co.kr")
        password = os.getenv("DISCORD_PASSWORD")
        if not password:
            raise RuntimeError("환경변수 DISCORD_PASSWORD 필요. (PowerShell: $env:DISCORD_PASSWORD='...')")

        login_suno_with_discord(driver, email, password)
        run_loop(driver, OUTPUT_CSV_PATH)

    finally:
        # driver.quit()
        pass


if __name__ == "__main__":
    main()
