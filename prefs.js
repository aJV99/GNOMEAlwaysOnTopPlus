// Fork of "Always On Top Indicator" by perosredo
// https://github.com/perosredo/gnome-always-on-top-indicator

import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import Adw from 'gi://Adw';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const DEFAULT_COLOR_HEX = '#bd93f9';
const TOGGLE_KEYBINDING = 'toggle-always-on-top';

function hexToRgba(hex) {
    const rgba = new Gdk.RGBA();
    if (!rgba.parse(hex))
        rgba.parse(DEFAULT_COLOR_HEX);
    return rgba;
}

function rgbaToHex(rgba) {
    const channel = (v) => Math.round(v * 255).toString(16).padStart(2, '0');
    return `#${channel(rgba.red)}${channel(rgba.green)}${channel(rgba.blue)}`;
}

export default class AlwaysOnTopIndicatorPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage({
            title: _('General'),
            icon_name: 'dialog-information-symbolic',
        });
        window.add(page);

        const ifaceSchema = Gio.SettingsSchemaSource.get_default()
            .lookup('org.gnome.desktop.interface', true);
        const accentColorAvailable = !!ifaceSchema && ifaceSchema.has_key('accent-color');

        const group = new Adw.PreferencesGroup({
            title: _('Appearance'),
            description: _('Configure the appearance of the border'),
        });
        page.add(group);

        const accentRow = new Adw.SwitchRow({
            title: _('Use System Accent Colour'),
            subtitle: accentColorAvailable
                ? _('Match the GNOME desktop accent colour.')
                : _('Requires GNOME 47 or newer.'),
            sensitive: accentColorAvailable,
        });
        group.add(accentRow);
        if (accentColorAvailable) {
            settings.bind('use-accent-color', accentRow, 'active',
                Gio.SettingsBindFlags.DEFAULT);
        } else {
            // Key exists in our schema but cannot take effect on this GNOME
            // version; present it as off so the UI matches the colour that
            // actually drives the border.
            accentRow.active = false;
        }

        const thicknessRow = new Adw.SpinRow({
            title: _('Border Thickness'),
            subtitle: _('Thickness of the border in pixels'),
            adjustment: new Gtk.Adjustment({
                lower: 0.25,
                upper: 10.0,
                step_increment: 0.25,
                page_increment: 1.0,
            }),
            digits: 2,
            width_chars: 6,
        });
        group.add(thicknessRow);
        settings.bind('border-thickness', thicknessRow, 'value',
            Gio.SettingsBindFlags.DEFAULT);

        const colorButton = new Gtk.ColorDialogButton({
            dialog: new Gtk.ColorDialog({with_alpha: false}),
            valign: Gtk.Align.CENTER,
            rgba: hexToRgba(settings.get_string('border-color')),
        });
        colorButton.connect('notify::rgba', () => {
            const hex = rgbaToHex(colorButton.rgba);
            if (hex !== settings.get_string('border-color'))
                settings.set_string('border-color', hex);
        });
        const colorChangedId = settings.connect('changed::border-color', () => {
            colorButton.rgba = hexToRgba(settings.get_string('border-color'));
        });
        window.connect('close-request', () => settings.disconnect(colorChangedId));

        const colorRow = new Adw.ActionRow({
            title: _('Border Color'),
            subtitle: _('Used when the system accent colour is disabled.'),
            activatable_widget: colorButton,
        });
        colorRow.add_suffix(colorButton);
        group.add(colorRow);
        if (accentColorAvailable) {
            settings.bind('use-accent-color', colorRow, 'visible',
                Gio.SettingsBindFlags.GET | Gio.SettingsBindFlags.INVERT_BOOLEAN);
        }

        const opacityRow = new Adw.SpinRow({
            title: _('Border Opacity'),
            subtitle: _('0 (transparent) to 1 (fully opaque)'),
            adjustment: new Gtk.Adjustment({
                lower: 0.0,
                upper: 1.0,
                step_increment: 0.05,
                page_increment: 0.1,
            }),
            digits: 2,
            width_chars: 6,
        });
        group.add(opacityRow);
        settings.bind('border-opacity', opacityRow, 'value',
            Gio.SettingsBindFlags.DEFAULT);

        const radiusRow = new Adw.SpinRow({
            title: _('Corner Radius'),
            subtitle: _('Corner rounding in pixels'),
            adjustment: new Gtk.Adjustment({
                lower: 0.0,
                upper: 20.0,
                step_increment: 0.5,
                page_increment: 2.0,
            }),
            digits: 1,
            width_chars: 6,
        });
        group.add(radiusRow);
        settings.bind('corner-radius', radiusRow, 'value',
            Gio.SettingsBindFlags.DEFAULT);

        const shortcutGroup = new Adw.PreferencesGroup({
            title: _('Shortcut'),
            description: _('Pin or unpin the focused window from the keyboard'),
        });
        page.add(shortcutGroup);

        const shortcutLabel = new Gtk.ShortcutLabel({
            disabled_text: _('Disabled'),
            valign: Gtk.Align.CENTER,
        });
        const updateShortcutLabel = () => {
            shortcutLabel.accelerator = settings.get_strv(TOGGLE_KEYBINDING)[0] ?? '';
        };
        updateShortcutLabel();
        const shortcutChangedId = settings.connect(
            `changed::${TOGGLE_KEYBINDING}`, updateShortcutLabel);
        window.connect('close-request', () => settings.disconnect(shortcutChangedId));

        const resetButton = new Gtk.Button({
            icon_name: 'edit-undo-symbolic',
            tooltip_text: _('Reset to default'),
            valign: Gtk.Align.CENTER,
            css_classes: ['flat'],
        });
        resetButton.connect('clicked', () => settings.reset(TOGGLE_KEYBINDING));

        const shortcutRow = new Adw.ActionRow({
            title: _('Toggle Always on Top'),
            subtitle: _('Click to set a new shortcut'),
            activatable: true,
        });
        shortcutRow.add_suffix(shortcutLabel);
        shortcutRow.add_suffix(resetButton);
        shortcutRow.connect('activated', () => this._captureShortcut(window, settings));
        shortcutGroup.add(shortcutRow);
    }

    _captureShortcut(parent, settings) {
        const view = new Adw.ToolbarView({
            content: new Adw.StatusPage({
                icon_name: 'preferences-desktop-keyboard-shortcuts-symbolic',
                title: _('Press a Shortcut'),
                description: _('Esc to cancel, Backspace to disable'),
            }),
        });
        view.add_top_bar(new Adw.HeaderBar());

        const dialog = new Adw.Window({
            title: _('Set Shortcut'),
            modal: true,
            transient_for: parent,
            default_width: 400,
            default_height: 300,
            content: view,
        });

        const controller = new Gtk.EventControllerKey();
        controller.connect('key-pressed', (_controller, keyval, _keycode, state) => {
            const mask = state & Gtk.accelerator_get_default_mod_mask();

            if (!mask && keyval === Gdk.KEY_Escape) {
                dialog.close();
            } else if (!mask && keyval === Gdk.KEY_BackSpace) {
                settings.set_strv(TOGGLE_KEYBINDING, []);
                dialog.close();
            } else if (mask && Gtk.accelerator_valid(keyval, mask)) {
                // Lone modifiers and unmodified keys fall through and keep
                // the dialog waiting for a usable combination.
                const accelerator = Gtk.accelerator_name(Gdk.keyval_to_lower(keyval), mask);
                settings.set_strv(TOGGLE_KEYBINDING, [accelerator]);
                dialog.close();
            }
            return Gdk.EVENT_STOP;
        });
        dialog.add_controller(controller);
        dialog.present();
    }
}
