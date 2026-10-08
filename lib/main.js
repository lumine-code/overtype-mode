const { CompositeDisposable, Disposable } = require("lumine");

/**
 * Overtype Mode Package
 *
 * Enables overtype (overwrite) mode for text editors. The actual overwrite
 * behaviour lives in core (`TextEditor::applyOvertype`, driven from genuine
 * typed input in the editor component); this package only drives the per-editor
 * state via `TextEditor::setOvertypeMode` and provides the presentation:
 * commands, a global/per-editor toggle, the block-cursor class, and the status
 * bar indicator.
 */
module.exports = {
  provideBackgroundTips() {
    return {
      packageName: "overtype-mode",
      tips: [
        "You can switch between inserting and overwriting text with {{ 'overtype-mode:toggle-global' | keystroke }}",
      ],
    };
  },

  /**
   * Activates the package and wires up commands, editor observation and the
   * status bar indicator.
   */
  activate() {
    this.global = false;
    this.statusBars = new Map();
    this.disposables = new CompositeDisposable();
    this.editorSubscriptions = new Map();
    this.disposables.add(
      lumine.config.onDidChange("overtype-mode.statusBar", (e) => {
        e.newValue ? this.activateStatusBar() : this.deactivateStatusBar();
      }),
      lumine.textEditors.onDidRemoveEditor((editor) => {
        this.unobserveEditor(editor);
      }),
      lumine.textEditors.observe((editor) => {
        this.observeEditor(editor);
      }),
      lumine.commands.add("lumine-workspace", {
        "overtype-mode:toggle-global": {
          description: "Turn overtype on or off in every editor.",
          didDispatch: () => {
            this.toggleGlobal();
          },
        },
      }),
      // toggle-editor joins it: the application menu dispatches at whatever
      // holds focus, so on the editor scope the menu item was dead off-editor.
      lumine.commands.add("lumine-workspace", {
        "overtype-mode:toggle-editor": {
          description: "Turn overtype on or off in this editor alone.",
          didDispatch: (e) => {
            this.toggleEditor(e);
          },
        },
      }),
    );
  },

  /**
   * Deactivates the package, disposes resources and clears any block cursors.
   */
  deactivate() {
    const owner = this.disposables;
    this.disposables = null;
    owner?.dispose();
    this.deactivateStatusBar();
    this.statusBars = null;
    if (this.editorSubscriptions) {
      for (const editor of [...this.editorSubscriptions.keys()]) {
        this.unobserveEditor(editor);
      }
      this.editorSubscriptions.clear();
      this.editorSubscriptions = null;
    }
  },

  /**
   * Starts tracking an editor: applies the current global state, syncs the
   * block-cursor class and keeps it in sync with future mode changes.
   * @param {TextEditor} editor - The text editor to observe
   */
  observeEditor(editor) {
    if (this.editorSubscriptions.has(editor)) {
      return;
    }
    if (this.global) {
      editor.setOvertypeMode(true);
    }
    this.updateEditorClass(editor);
    this.editorSubscriptions.set(
      editor,
      editor.onDidChangeOvertypeMode(() => this.updateEditorClass(editor)),
    );
  },

  /**
   * Stops tracking an editor when its last registry lease is released.
   * @param {TextEditor} editor - The text editor to stop observing
   */
  unobserveEditor(editor) {
    const subscription = this.editorSubscriptions?.get(editor);
    if (subscription) {
      this.editorSubscriptions.delete(editor);
      subscription.dispose();
    }
    editor.getElement().classList.remove("overtype-cursor");
  },

  /**
   * Reflects an editor's overtype state on its element via the block-cursor class.
   * @param {TextEditor} editor - The text editor to update
   */
  updateEditorClass(editor) {
    editor.getElement().classList.toggle("overtype-cursor", editor.isOvertypeMode());
  },

  /**
   * Toggles overtype mode for the editor targeted by a command event.
   * @param {Event} e - The triggering command event
   */
  toggleEditor(e) {
    // The editor the dispatch came from, or the active one: the application
    // menu dispatches at whatever holds focus, so target resolution answers
    // null there and the active editor remains the fallback.
    const editor =
      lumine.workspace.getTextEditorForElement(e?.target, { includeMini: false }) ??
      lumine.workspace.getActiveTextEditor();
    if (!editor) {
      return;
    }
    editor.toggleOvertypeMode();
  },

  /**
   * Toggles overtype mode globally for all editors and sets the default for
   * editors opened afterwards.
   */
  toggleGlobal() {
    this.global = !this.global;
    for (const editor of lumine.textEditors.getEditors()) {
      editor.setOvertypeMode(this.global);
    }
    for (const record of this.statusBars?.values() ?? []) record.switch?.update();
  },

  /**
   * Consumes the status bar service.
   * @param {Object} statusBar - The status bar service
   */
  consumeStatusBar(statusBar) {
    const records = this.statusBars;
    const owner = this.disposables;
    if (!records || !owner) return new Disposable();
    let record = records.get(statusBar);
    if (!record) {
      record = { statusBar, references: 0, switch: null, tile: null, tooltip: null };
      records.set(statusBar, record);
    }
    record.references++;
    const registration = new Disposable(() => {
      owner.remove(registration);
      if (--record.references !== 0) return;
      if (records.get(statusBar) === record) records.delete(statusBar);
      this.deactivateStatusBarRecord(record);
    });
    owner.add(registration);
    if (lumine.config.get("overtype-mode.statusBar")) this.activateStatusBarRecord(record);
    return registration;
  },

  /**
   * Activates the status bar indicator.
   */
  activateStatusBar() {
    for (const record of this.statusBars?.values() ?? []) this.activateStatusBarRecord(record);
  },

  activateStatusBarRecord(record) {
    if (!this.disposables || record.references === 0 || record.switch) return;
    const owner = this.disposables;
    const element = this.createSwitch();
    record.switch = element;
    element.update();
    // Editor-mode band, see packages/status-bar/README.md.
    const tile = record.statusBar.addRightTile({ item: element, priority: 230 });
    if (this.disposables !== owner || record.switch !== element) {
      tile.destroy();
      return;
    }
    record.tile = tile;
    const tooltip = lumine.tooltips.add(element, {
      title: () => `Overtype mode is ${this.global ? "enabled" : "disabled"}`,
      keyBindingCommand: "overtype-mode:toggle-global",
      keyBindingTarget: lumine.views.getView(lumine.workspace),
    });
    if (this.disposables !== owner || record.switch !== element) tooltip.dispose();
    else record.tooltip = tooltip;
  },

  /**
   * Deactivates the status bar indicator.
   */
  deactivateStatusBar() {
    for (const record of this.statusBars?.values() ?? []) this.deactivateStatusBarRecord(record);
  },

  deactivateStatusBarRecord(record) {
    const { switch: element, tile, tooltip } = record;
    record.switch = record.tile = record.tooltip = null;
    if (element) element.onmouseup = null;
    tooltip?.dispose();
    // Destroy the tile rather than just the element: the status bar keeps the
    // tile in its ordered collection and inserts later tiles relative to it, so
    // a detached element left behind there breaks the next insertion.
    tile?.destroy();
  },

  /**
   * Creates the status bar switch element.
   * @returns {HTMLElement} The switch element with an `update` method
   */
  createSwitch() {
    const element = document.createElement("status-bar-tile");
    element.classList.add("overtype-mode-icon");
    let iconSpan = document.createElement("span");
    iconSpan.classList.add("icon", "is-icon-only", "icon-ruby");
    element.appendChild(iconSpan);
    element.onmouseup = (e) => {
      if (e.which === 1) {
        this.toggleGlobal();
      }
    };
    element.update = () => {
      if (this.global) {
        iconSpan.classList.add("active");
      } else {
        iconSpan.classList.remove("active");
      }
    };
    return element;
  },
};
