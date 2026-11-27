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


def click_setting(page, selector):
    """Use the actual pause menu when a settings control is not already visible."""
    opened = not page.locator(selector).is_visible()
    if opened:
        page.locator("#menuButton").click()
        page.wait_for_selector("#gameMenu[open]")
    page.locator(selector).click()
    if opened:
        page.locator("[data-menu-close]").click()
        page.wait_for_function("!window.lumberPhaser.core.paused && (!window.lumberPhaser.scene.audio.context || window.lumberPhaser.scene.audio.context.state === (window.lumberPhaser.scene.audio.enabled ? 'running' : 'suspended'))")
