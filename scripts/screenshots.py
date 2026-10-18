"""Regenerate the README screenshots.

    pip install playwright && playwright install chromium
    python3 -m http.server 8765 &      # from the repo root
    python3 scripts/screenshots.py
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = 'http://localhost:8765/'
OUT = Path(__file__).resolve().parent.parent / 'docs' / 'screenshots'
OUT.mkdir(parents=True, exist_ok=True)

# A little believable progress so the progress bars aren't empty.
SEED = """localStorage.setItem('satvocab:mastery', JSON.stringify(Object.fromEntries(
  BATCHES.slice(0, 6).flatMap((b, i) => b.words.slice(0, 9 - i).map((w, j) =>
    [w.w, j % 3 ? 'known' : 'learning'])))));"""


def page(browser, scheme='light', width=1100, height=820):
    pg = browser.new_page(viewport={'width': width, 'height': height}, color_scheme=scheme,
                          device_scale_factor=2)
    pg.goto(URL)
    pg.evaluate(SEED)
    pg.reload()
    pg.wait_for_timeout(400)
    return pg


with sync_playwright() as p:
    b = p.chromium.launch()

    pg = page(b)
    pg.screenshot(path=OUT / 'home.png')

    pg.click('[data-batch="b01"]')
    pg.click('[data-act="next"]')
    pg.click('#card')
    pg.wait_for_timeout(700)
    pg.screenshot(path=OUT / 'flashcard.png')

    pg.click('nav [data-mode="quiz"]')
    pg.click('.opt >> nth=0')  # answer, so the explanation panel shows
    pg.wait_for_timeout(200)
    pg.screenshot(path=OUT / 'quiz.png')

    pg.click('nav [data-mode="groups"]')
    pg.wait_for_timeout(200)
    pg.screenshot(path=OUT / 'groups.png')

    dk = page(b, 'dark')
    dk.click('[data-batch="b02"]')
    dk.click('#card')
    dk.wait_for_timeout(700)
    dk.screenshot(path=OUT / 'dark.png')

    mb = page(b, width=390, height=844)
    mb.click('nav [data-mode="quiz"]')
    mb.wait_for_timeout(200)
    mb.screenshot(path=OUT / 'mobile.png')

    so = page(b, width=1200, height=630)
    so.click('[data-batch="b01"]')
    so.click('#card')
    so.wait_for_timeout(700)
    so.screenshot(path=OUT / 'social.png')

    b.close()
print('screenshots written to', OUT)
