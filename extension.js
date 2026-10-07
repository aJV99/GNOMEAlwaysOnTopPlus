// Fork of "Always On Top Indicator" by perosredo
// https://github.com/perosredo/gnome-always-on-top-indicator

import St from 'gi://St';
import Meta from 'gi://Meta';
import Gio from 'gi://Gio';
import Shell from 'gi://Shell';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const INTERFACE_SCHEMA = 'org.gnome.desktop.interface';
const ACCENT_COLOR_KEY = 'accent-color';
const TOGGLE_KEYBINDING = 'toggle-always-on-top';

// GNOME 47+ accent-color enum values, mapped to their libadwaita standalone
// hex values. Source: libadwaita src/stylesheet/_colors_public.scss.
const GNOME_ACCENT_COLORS = {
    blue:   '#3584e4',
    teal:   '#2190a4',
    green:  '#3a944a',
    yellow: '#c88800',
    orange: '#ed5b00',
    red:    '#e62d42',
    pink:   '#d56199',
    purple: '#9141ac',
    slate:  '#6f8396',
};

const SUPPORTED_WINDOW_TYPES = new Set([
    Meta.WindowType.NORMAL,
    Meta.WindowType.DIALOG,
    Meta.WindowType.MODAL_DIALOG,
    Meta.WindowType.UTILITY,
]);

const DEFAULT_COLOR_HEX = '#bd93f9';
const HEX_COLOR_RE = /^#([0-9a-f]{6})$/i;
// Pre-parsed form of DEFAULT_COLOR_HEX, held separately so parseHexColor
// does not need to parse itself on every malformed input.
const FALLBACK_COLOR = {r: 0xbd, g: 0x93, b: 0xf9};

function parseHexColor(hex) {
    const match = HEX_COLOR_RE.exec(hex ?? '');
    if (!match)
        return FALLBACK_COLOR;
    const v = match[1];
    return {
        r: parseInt(v.substring(0, 2), 16),
        g: parseInt(v.substring(2, 4), 16),
        b: parseInt(v.substring(4, 6), 16),
    };
}

export default class AlwaysOnTopIndicatorExtension extends Extension {
    constructor(metadata) {
        super(metadata);
        this._windows = new Map();
    }

    enable() {
        this._settings = this.getSettings();
        this._overviewActive = Main.overview.visible;

        const ifaceSchema = Gio.SettingsSchemaSource.get_default()
            .lookup(INTERFACE_SCHEMA, true);
        this._accentColorAvailable = !!ifaceSchema && ifaceSchema.has_key(ACCENT_COLOR_KEY);
        this._ifaceSettings = this._accentColorAvailable
            ? new Gio.Settings({settings_schema: ifaceSchema})
            : null;

        this._loadSettings();

        this._settingsChangedId = this._settings.connect('changed', () => {
            const {changed, widthChanged} = this._loadSettings();
            if (changed)
                this._restyleAll(widthChanged);
        });

        if (this._ifaceSettings) {
            this._ifaceChangedId = this._ifaceSettings.connect(
                `changed::${ACCENT_COLOR_KEY}`,
                () => {
                    const {changed, widthChanged} = this._loadSettings();
                    if (changed)
                        this._restyleAll(widthChanged);
                }
            );
        }

        Main.wm.addKeybinding(
            TOGGLE_KEYBINDING,
            this._settings,
            Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
            Shell.ActionMode.NORMAL,
            () => this._toggleFocusedWindow()
        );

        this._windowCreatedId = global.display.connect(
            'window-created',
            (_display, window) => this._setupWindow(window)
        );

        this._workspaceSwitchedId = global.workspace_manager.connect(
            'workspace-switched',
            () => this._refreshAll()
        );

        this._overviewShowingId = Main.overview.connect('showing', () => {
            this._overviewActive = true;
            this._refreshAll();
        });
        this._overviewHiddenId = Main.overview.connect('hidden', () => {
            this._overviewActive = false;
            this._refreshAll();
        });

        for (const actor of global.get_window_actors()) {
            const win = actor.meta_window;
            if (win)
                this._setupWindow(win);
        }
    }

    disable() {
        Main.wm.removeKeybinding(TOGGLE_KEYBINDING);

        if (this._settingsChangedId) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = null;
        }
        this._settings = null;

        if (this._ifaceChangedId) {
            this._ifaceSettings.disconnect(this._ifaceChangedId);
            this._ifaceChangedId = null;
        }
        this._ifaceSettings = null;
        this._accentColorAvailable = false;

        if (this._windowCreatedId) {
            global.display.disconnect(this._windowCreatedId);
            this._windowCreatedId = null;
        }

        if (this._workspaceSwitchedId) {
            global.workspace_manager.disconnect(this._workspaceSwitchedId);
            this._workspaceSwitchedId = null;
        }

        if (this._overviewShowingId) {
            Main.overview.disconnect(this._overviewShowingId);
            this._overviewShowingId = null;
        }

        if (this._overviewHiddenId) {
            Main.overview.disconnect(this._overviewHiddenId);
            this._overviewHiddenId = null;
        }

        for (const metaWindow of [...this._windows.keys()])
            this._cleanupWindow(metaWindow);
        this._windows.clear();
    }

    _loadSettings() {
        const prev = {
            width: this._borderWidth,
            opacity: this._borderOpacity,
            radius: this._cornerRadius,
            color: this._borderColor,
        };

        this._borderWidth = this._settings.get_double('border-thickness');
        this._borderOpacity = this._settings.get_double('border-opacity');
        this._cornerRadius = this._settings.get_double('corner-radius');
        this._borderColor = parseHexColor(this._resolveColorHex());

        const widthChanged = prev.width !== this._borderWidth;
        const colorChanged = !prev.color
            || prev.color.r !== this._borderColor.r
            || prev.color.g !== this._borderColor.g
            || prev.color.b !== this._borderColor.b;

        return {
            widthChanged,
            changed: widthChanged
                || prev.opacity !== this._borderOpacity
                || prev.radius !== this._cornerRadius
                || colorChanged,
        };
    }

    _resolveColorHex() {
        if (this._ifaceSettings && this._settings.get_boolean('use-accent-color')) {
            const name = this._ifaceSettings.get_string(ACCENT_COLOR_KEY);
            const hex = GNOME_ACCENT_COLORS[name];
            if (hex)
                return hex;
        }
        return this._settings.get_string('border-color');
    }

    _restyleAll(reapplyGeometry = false) {
        for (const [metaWindow, state] of this._windows) {
            if (!state.border)
                continue;
            state.border.actor.set_style(this._borderStyle());
            if (reapplyGeometry)
                this._applyGeometry(state.border.actor, metaWindow);
        }
    }

    _toggleFocusedWindow() {
        const metaWindow = global.display.focus_window;
        if (!metaWindow || !SUPPORTED_WINDOW_TYPES.has(metaWindow.get_window_type()))
            return;

        if (metaWindow.is_above())
            metaWindow.unmake_above();
        else
            metaWindow.make_above();
    }

    _refreshAll() {
        for (const metaWindow of this._windows.keys())
            this._updateWindowBorder(metaWindow);
    }

    _setupWindow(metaWindow) {
        if (!metaWindow || !SUPPORTED_WINDOW_TYPES.has(metaWindow.get_window_type()))
            return;
        if (this._windows.has(metaWindow))
            return;

        const handlers = {
            above: metaWindow.connect('notify::above', () => this._updateWindowBorder(metaWindow)),
            minimized: metaWindow.connect('notify::minimized', () => this._updateWindowBorder(metaWindow)),
            workspace: metaWindow.connect('workspace-changed', () => this._updateWindowBorder(metaWindow)),
            unmanaged: metaWindow.connect('unmanaged', () => this._cleanupWindow(metaWindow)),
        };

        this._windows.set(metaWindow, {handlers, border: null});
        this._updateWindowBorder(metaWindow);
    }

    _cleanupWindow(metaWindow) {
        const state = this._windows.get(metaWindow);
        if (!state)
            return;

        for (const id of Object.values(state.handlers)) {
            try {
                metaWindow.disconnect(id);
            } catch (_e) {
                // window may already be destroyed
            }
        }

        if (state.border)
            this._destroyBorder(metaWindow);

        this._windows.delete(metaWindow);
    }

    _shouldShowBorder(metaWindow) {
        if (this._overviewActive)
            return false;
        if (!metaWindow.is_above())
            return false;
        if (metaWindow.minimized)
            return false;

        const activeWs = global.workspace_manager.get_active_workspace();
        const winWs = metaWindow.get_workspace();
        if (winWs && winWs !== activeWs && !metaWindow.on_all_workspaces)
            return false;

        return true;
    }

    _updateWindowBorder(metaWindow) {
        if (this._shouldShowBorder(metaWindow))
            this._ensureBorder(metaWindow);
        else
            this._destroyBorder(metaWindow);
    }

    _borderStyle() {
        const {r, g, b} = this._borderColor;
        const color = `rgba(${r}, ${g}, ${b}, ${this._borderOpacity})`;
        return `border: ${this._borderWidth}px solid ${color};` +
               `border-radius: ${this._cornerRadius}px;`;
    }

    _applyGeometry(actor, metaWindow) {
        try {
            // The border is a child of the window actor, whose origin is the
            // buffer-rect origin (buffer includes any client-side-decoration
            // shadow margins). Translate the frame rect into that local space
            // so the border hugs the visible window, not the shadow.
            const frame = metaWindow.get_frame_rect();
            // A window that is unmapped or mid-teardown can report a degenerate
            // frame rect; pushing that into set_size triggers Clutter "tried to
            // allocate a size of -2147483648" warnings, so skip until the
            // geometry is real.
            if (!frame || frame.width <= 0 || frame.height <= 0)
                return;
            const buffer = metaWindow.get_buffer_rect();
            actor.set_position(
                frame.x - buffer.x - this._borderWidth,
                frame.y - buffer.y - this._borderWidth
            );
            actor.set_size(frame.width + 2 * this._borderWidth, frame.height + 2 * this._borderWidth);
        } catch (_e) {
            // window may have been destroyed
        }
    }

    _ensureBorder(metaWindow) {
        const state = this._windows.get(metaWindow);
        if (!state || state.border)
            return;
        const windowActor = metaWindow.get_compositor_private();
        if (!windowActor)
            return;

        const actor = new St.Bin({
            // Named so it is identifiable in Clutter allocation warnings
            // (otherwise it logs as an anonymous "unnamed [StBin]").
            name: 'always-on-top-indicator-border',
            style_class: 'always-on-top-indicator-border',
            reactive: false,
            can_focus: false,
            track_hover: false,
            style: this._borderStyle(),
        });
        // Parent the border onto the window's own actor so it moves, stacks,
        // and animates (workspace switches, minimise) together with the window
        // instead of chasing it from the chrome layer.
        windowActor.add_child(actor);
        this._applyGeometry(actor, metaWindow);

        const sizeChangedId = metaWindow.connect('size-changed',
            () => this._applyGeometry(actor, metaWindow));
        const positionChangedId = metaWindow.connect('position-changed',
            () => this._applyGeometry(actor, metaWindow));

        state.border = {actor, sizeChangedId, positionChangedId};
    }

    _destroyBorder(metaWindow) {
        const state = this._windows.get(metaWindow);
        if (!state || !state.border)
            return;

        const {actor, sizeChangedId, positionChangedId} = state.border;

        try {
            metaWindow.disconnect(sizeChangedId);
        } catch (_e) { /* gone */ }
        try {
            metaWindow.disconnect(positionChangedId);
        } catch (_e) { /* gone */ }

        // destroy() also unparents the actor from the window actor. If the
        // window actor was already torn down (unmanaged), the child is gone
        // with it, so guard against operating on a destroyed actor.
        try {
            actor.destroy();
        } catch (_e) { /* already destroyed with its window actor */ }

        state.border = null;
    }
}
