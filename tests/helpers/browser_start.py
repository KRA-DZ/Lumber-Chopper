"""Explicitly select a hero before existing browser scenarios begin; never bypass the UI."""


def choose_hero(page, appearance="traveler"):
    page.wait_for_function(
        "window.lumberPhaser?.scene?.hudReady || document.querySelector('#heroDialog')?.open",
        timeout=60000,
    )
    if page.evaluate("!!window.lumberPhaser?.scene?.hudReady"):
        return
    page.locator(f'#heroDialog input[value="{appearance}"]').check()
    page.locator("[data-hero-start]").click()
    page.wait_for_function("!!window.lumberPhaser?.scene?.hudReady", timeout=60000)
