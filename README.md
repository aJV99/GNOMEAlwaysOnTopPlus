# Always On Top Indicator+

GNOME Shell extension that draws a coloured border around windows set as always-on-top.

> Maintained fork of [perosredo/gnome-always-on-top-indicator](https://github.com/perosredo/gnome-always-on-top-indicator). Not yet published on extensions.gnome.org; install from source (below).

## Features

- Visible border on any window you set to always-on-top
- `Super+Ctrl+T` pins or unpins the focused window; rebind or disable it in preferences
- Border colour follows the GNOME accent colour (GNOME 47+), or pick your own
- Configurable thickness (0.25–10 px), opacity, and corner radius (0–20 px)
- Everything lives in the preferences dialog — no config files to touch

## Installation

### From source

```bash
git clone https://github.com/aJV99/gnome-always-on-top-indicator.git
cd gnome-always-on-top-indicator
make install
```

Log out and back in (Wayland), then enable the extension:

```bash
gnome-extensions enable always-on-top-indicator@ajv99.github.io
```

…or toggle it on in the **Extensions** app.

### Uninstall

```bash
make uninstall
```

## Requirements

- GNOME Shell 45–50
- Wayland (X11 also works on GNOME 45–49; GNOME 50 is Wayland-only)

## Roadmap

This fork is actively adopting the upstream project, fixing known bugs, and targeting a new release on extensions.gnome.org. Progress is tracked in [CHANGELOG.md](CHANGELOG.md).

### Phase 0 — Housekeeping ✅
- `.gitignore`, `LICENSE`, `CHANGELOG.md`, `Makefile`
- Untrack generated build artifacts

### Phase 1 — Correctness fixes ✅
- Stop borders from leaking across workspaces
- Collapse duplicate per-window bookkeeping
- Allow dialog and utility windows, not only normal ones
- Remove unused imports and misleading identifiers

### Phase 2 — Features ✅
- Real GNOME accent-color integration (GNOME 47+)
- Configurable colour, opacity, and corner radius
- Reparent the border onto the window actor so it tracks and animates with its window
- Move inline styles into a proper stylesheet

### Phase 3 — Bundled default keybinding ✅
- Ship `Super+Ctrl+T` as a default always-on-top shortcut so non-technical users don't need to run `gsettings` manually
- Rebindable from the preferences page

### Phase 4 — Internationalisation ✅
- `po/` scaffolding and translator-friendly build targets

### Phase 5 — CI and release pipeline ✅
- GitHub Actions: pack the extension, validate schemas, attach the artifact on tagged releases

### Phase 6 — GNOME Extensions submission
- New UUID owned by this fork ✅
- Submit to extensions.gnome.org

## Development

Originally developed by Claude with micromanagement from PS. Fork now maintained by [@aJV99](https://github.com/aJV99).

Build targets:

```bash
make schemas    # compile GSettings schemas
make pot        # regenerate the translation template in po/
make update-po  # merge the template into every po/*.po
make pack       # produce a .shell-extension.zip
make install    # install for the current user
make uninstall  # remove for the current user
make clean      # remove build artifacts
```

### Translating

Start a new language from the template (French shown), then translate the `msgstr` lines:

```bash
msginit --locale=fr.UTF-8 \
    --input=po/always-on-top-indicator@ajv99.github.io.pot --output=po/fr.po
```

`make install` and `make pack` compile every `po/*.po` automatically. After changing strings in the source, run `make update-po`.

## License

GPL-3.0 — see [LICENSE](LICENSE).
