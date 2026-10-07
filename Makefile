UUID           := always-on-top-indicator@ajv99.github.io
DOMAIN         := $(UUID)
EXTENSIONS_DIR := $(HOME)/.local/share/gnome-shell/extensions
INSTALL_DIR    := $(EXTENSIONS_DIR)/$(UUID)

SOURCES := extension.js prefs.js metadata.json stylesheet.css
SCHEMA_SRC := $(wildcard schemas/*.gschema.xml)
SCHEMA_COMPILED := schemas/gschemas.compiled

POT_FILE := po/$(DOMAIN).pot
PO_FILES := $(wildcard po/*.po)
MO_FILES := $(patsubst po/%.po,locale/%/LC_MESSAGES/$(DOMAIN).mo,$(PO_FILES))

.PHONY: all schemas pot update-po translations pack install uninstall clean help

all: schemas

help:
	@echo "Targets:"
	@echo "  schemas    Compile GSettings schemas"
	@echo "  pot        Regenerate the translation template in po/"
	@echo "  update-po  Merge the template into every po/*.po"
	@echo "  pack       Produce a distributable .shell-extension.zip"
	@echo "  install    Install the extension for the current user"
	@echo "  uninstall  Remove the extension for the current user"
	@echo "  clean      Remove build artifacts"

schemas: $(SCHEMA_COMPILED)

$(SCHEMA_COMPILED): $(SCHEMA_SRC)
	glib-compile-schemas --strict schemas/

pot:
	xgettext --from-code=UTF-8 --language=JavaScript --keyword=_ \
		--package-name="$(UUID)" --output=$(POT_FILE) prefs.js
	sed -i 's/charset=CHARSET/charset=UTF-8/' $(POT_FILE)

update-po: pot
	for po in $(PO_FILES); do msgmerge --update --backup=none $$po $(POT_FILE); done

translations: $(MO_FILES)

locale/%/LC_MESSAGES/$(DOMAIN).mo: po/%.po
	mkdir -p $(dir $@)
	msgfmt --check -o $@ $<

pack: schemas
	gnome-extensions pack --force \
		--extra-source=LICENSE \
		.

install: schemas translations
	rm -rf $(INSTALL_DIR)
	mkdir -p $(INSTALL_DIR)
	cp -r $(SOURCES) schemas $(wildcard locale) $(INSTALL_DIR)/
	@echo "Installed to $(INSTALL_DIR)"
	@echo "Restart GNOME Shell (Alt+F2, r) on X11 or log out/in on Wayland."
	@echo "Then enable with: gnome-extensions enable $(UUID)"
	@echo "  or toggle it on in the Extensions app."

uninstall:
	rm -rf $(INSTALL_DIR)
	@echo "Removed $(INSTALL_DIR)"

clean:
	rm -f $(SCHEMA_COMPILED)
	rm -f *.shell-extension.zip
	rm -rf locale
