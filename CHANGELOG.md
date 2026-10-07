# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Top bar button: a click pins or unpins the focused window, a right-click opens preferences, and the icon is dimmed while the focused window is not pinned. On by default; can be turned off in preferences.
- "Show on All Workspaces" option (off by default): while a window is pinned it is also placed on all workspaces. Unpinning, turning the option off, or disabling the extension hands the window back; windows the user made sticky themselves are left alone.
- GitHub Actions workflow that validates the schemas and packs the extension on every push to `master` and pull request, and attaches the bundle to a GitHub release when a `v*` tag is pushed.
- Translation scaffolding: a `gettext-domain` in `metadata.json`, a template in `po/`, and `make pot` / `make update-po` targets. `make install` and `make pack` compile and bundle any `po/*.po` present. No translations ship yet.
- Bundled keyboard shortcut that pins or unpins the focused window: `Super+Ctrl+T` by default, stored in the extension's own `toggle-always-on-top` key and active only while the extension is enabled. It can be rebound, disabled, or reset from a new "Shortcut" group in preferences.
- GNOME 50 compatibility declared in `metadata.json` (supports Fedora 44).
- GNOME 49 compatibility declared in `metadata.json` (fixes Fedora 43).
- Configurable border colour via a colour picker in preferences (hex; default `#bd93f9`).
- Configurable border opacity (0.0–1.0) and corner radius (0–20 px) in preferences.
- GNOME 47+ accent-color integration: borders can now match the desktop accent colour automatically and update when the user changes it. Exposed as a "Use System Accent Colour" switch in preferences (disabled with a hint on GNOME 45/46).
- `.gitignore`, `LICENSE` (GPL-3.0), `CHANGELOG.md`, and `Makefile` for a consistent build and release workflow.
- Borders now apply to dialog, modal dialog, and utility windows in addition to normal windows.
- Border visibility reacts to workspace switches and to the window changing workspace.
- Borders hide while the Activities overview is open and restore when it closes.

### Changed
- Preferences: the "Shortcut" group is now "Pinning" and also holds the top bar button and all-workspaces switches.
- Extension description now mentions pinning as well as the border.
- `make pack` no longer bundles `README.md` and `CHANGELOG.md`, which the extension does not need to run; `extension.js` and `prefs.js` now carry the attribution to the upstream extension that the README held.
- README features list and roadmap brought up to date.
- Corner radius now defaults to 16 px (was 0) so a fresh install matches GNOME's rounded windows.
- The border's static styling moved into `stylesheet.css`; only the settings-driven width, colour, opacity and radius remain inline.
- Renamed the extension to "Always On Top+": it now pins windows as well as indicating them, and the name distinguishes it from the upstream "Always On Top Indicator" listing. The UUID and GSettings schema are unchanged.
- Adopted the fork's own identity: UUID is now `always-on-top-indicator@ajv99.github.io`, `url` points at this repository, and the GSettings schema is `org.gnome.shell.extensions.always-on-top-indicator-maintained` (own dconf path, so the fork no longer shares stored settings with the upstream extension).
- Borders are now parented onto each window's own `Meta.WindowActor` (via `get_compositor_private()`) instead of `Main.layoutManager.addChrome`. The border moves, stacks, and animates together with its window — including workspace-switch and minimise animations — rather than chasing it from the chrome layer. Geometry is computed in window-actor-local coordinates, translating the frame rect against the buffer rect so the border hugs the visible window rather than any client-side-decoration shadow. As a non-reactive child of the window actor the overlay inherently cannot steal input or affect the work area, so the old `addChrome` opt-outs are no longer needed. Geometry updates are skipped while a window reports a degenerate frame rect, avoiding Clutter allocation warnings during teardown.
- Settings changes now flow through a single `changed` handler that reloads every key and restyles live borders, replacing the thickness-only handler. The handler short-circuits when no border-affecting value actually changed, and only re-applies window geometry when thickness changed.
- Custom colour picker is hidden in preferences while the accent-colour toggle is on, and the accent toggle shows as off (with its "Requires GNOME 47 or newer" hint) on older GNOME versions — so the UI always reflects the colour actually driving the border.
- `Gio.Settings` for `org.gnome.desktop.interface` is now constructed only when the `accent-color` key is available, using the schema handle returned by the availability probe.
- `GNOME_ACCENT_COLORS` now cites the libadwaita source so future palette drift is debuggable. The default colour `#bd93f9` is now a named constant shared across the extension and preferences code.
- Project maintenance forked from [perosredo/gnome-always-on-top-indicator](https://github.com/perosredo/gnome-always-on-top-indicator).
- Untracked generated build artifacts (`*.shell-extension.zip`, `schemas/gschemas.compiled`); they are now produced by `make`.
- Collapsed the separate border and signal-handler maps into a single per-window state record.
- Extracted `_borderStyle` and `_applyGeometry` helpers to remove duplicated styling and geometry code.
- Switched the on-all-workspaces check to the `on_all_workspaces` property for compatibility across Mutter versions.
- Removed the unused `Gio` import; renamed `_windowAddedId` to `_windowCreatedId` to match the signal it tracks.
- `make install` now clears the install directory first so stale files from older versions cannot linger; `SCHEMA_SRC` uses a wildcard so additional schemas rebuild automatically.
- README now documents enabling the extension via `gnome-extensions enable …`.

### Fixed
- Border no longer persists on other workspaces after switching away from an always-on-top window.
- `disable()` iterates a snapshot of tracked windows instead of mutating the map mid-iteration.

## [0.1.0]

### Added
- Initial release: draws a coloured border around windows set to always-on-top.
- Preferences dialog with configurable border thickness (0.25–10.0 px).
