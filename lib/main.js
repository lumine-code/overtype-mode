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
    const owner = this.disposables;
    const owns = () => this.disposables === owner;
    this.disposables.add(
      lumine.config.onDidChange("overtype-mode.statusBar", (e) => {
        if (!owns()) return;
        e.newValue ? this.activateStatusBar() : this.deactivateStatusBar();
      }),
      lumine.textEditors.onDidRemoveEditor((editor) => {
        if (!owns()) return;
        this.unobserveEditor(editor);
      }),
      lumine.textEditors.observe((editor) => {
        if (!owns()) return;
        this.observeEditor(editor);
      }),
      lumine.commands.add("lumine-workspace", {
        "overtype-mode:toggle-global": {
          description: "Turn overtype on or off in every editor.",
          didDispatch: () => {
            if (!owns()) return;
            this.toggleGlobal();
          },
        },
      }),
      // This workspace operation deliberately addresses the current embedded
      // editor when another workspace surface has focus.
      lumine.commands.add("lumine-workspace", {
        "overtype-mode:toggle-editor": {
          description: "Turn overtype on or off in this editor alone.",
          didDispatch: (e) => {
            if (!owns()) return;
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
    const records = this.statusBars;
    const editors = this.editorSubscriptions;
    const retired = [...(records?.values() ?? [])];
    this.disposables = null;
    this.statusBars = null;
    this.editorSubscriptions = null;
    records?.clear();
    if (editors) {
      const registrations = [...editors];
      editors.clear();
      for (const [editor, registration] of registrations) {
        registration.dispose();
        editor.getElement().classList.remove("overtype-cursor");
      }
    }
    owner?.dispose();
    for (const record of retired) this.deactivateStatusBarRecord(record);
  },

  /**
   * Starts tracking an editor: applies the current global state, syncs the
   * block-cursor class and keeps it in sync with future mode changes.
   * @param {TextEditor} editor - The text editor to observe
   */
  observeEditor(editor) {
    const owner = this.disposables;
    const editors = this.editorSubscriptions;
    if (!owner || !editors || editor.isDestroyed() || editors.has(editor)) {
      return;
    }
    if (this.global) {
      editor.setOvertypeMode(true);
    }
    if (this.disposables !== owner || this.editorSubscriptions !== editors || editor.isDestroyed())
      return;
    this.updateEditorClass(editor);
    const entry = new CompositeDisposable();
    editors.set(editor, entry);
    const subscription = editor.onDidChangeOvertypeMode(() => {
      if (this.disposables === owner && editors.get(editor) === entry)
        this.updateEditorClass(editor);
    });
    if (this.disposables !== owner || editors.get(editor) !== entry) subscription.dispose();
    else entry.add(subscription);
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
    const editor = this.editorForToggle(e);
    if (!editor) {
      return;
    }
    editor.toggleOvertypeMode();
  },

  editorForToggle(event) {
    return (
      lumine.workspace.getTextEditorForElement(event?.target, { includeMini: false }) ??
      (event?.context ?? lumine.workspace.resolveCommandContext(event)).embeddedEditor
    );
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
  consumeStatusBar(service) {
    return service.observeWindows(
      (scopedStatusBar, context) => this.consumeWindowStatusBar(scopedStatusBar, context),
      { windows: "all" },
    );
  },

  consumeWindowStatusBar(statusBar, context) {
    const records = this.statusBars;
    const owner = this.disposables;
    if (!records || !owner) return new Disposable();
    let record = records.get(statusBar);
    if (!record) {
      record = { statusBar, context, references: 0, switch: null, tile: null, tooltip: null };
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
    const element = this.createSwitch(record.context.window);
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
      title: () => `Global overtype ${this.global ? "on" : "off"}. Click to toggle.`,
      html: false,
      keyBindingCommand: "overtype-mode:toggle-global",
      keyBindingTarget: record.context.window.getElement(),
    });
    if (this.disposables !== owner || record.switch !== element) tooltip.dispose();
    else record.tooltip = tooltip;
    if (this.disposables !== owner || record.switch !== element) return;
    const packageMain = this;
    record.menu = lumine.contextMenu.add({
      ".overtype-mode-icon": {
        commandTarget: "focus",
        items: [
          { type: "separator" },
          {
            label: "Overtype for All Editors",
            command: "overtype-mode:toggle-global",
            type: "checkbox",
            shouldDisplay: ({ target }) => target.closest(".overtype-mode-icon") === element,
            created() {
              this.checked = packageMain.global;
            },
          },
          {
            label: "Overtype for This Editor",
            command: "overtype-mode:toggle-editor",
            type: "checkbox",
            shouldDisplay: ({ target }) => target.closest(".overtype-mode-icon") === element,
            created(event, { commandTarget }) {
              const editor = packageMain.editorForToggle({ target: commandTarget });
              this.enabled = Boolean(editor);
              this.checked = Boolean(editor?.isOvertypeMode());
            },
          },
          { type: "separator" },
        ],
      },
    });
  },

  /**
   * Deactivates the status bar indicator.
   */
  deactivateStatusBar() {
    for (const record of this.statusBars?.values() ?? []) this.deactivateStatusBarRecord(record);
  },

  deactivateStatusBarRecord(record) {
    const { switch: element, tile, tooltip, menu } = record;
    record.switch = record.tile = record.tooltip = record.menu = null;
    menu?.dispose();
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
  createSwitch(window = lumine.workspace.getMainWindow()) {
    const element = window.getDocument().createElement("status-bar-tile");
    element.classList.add("overtype-mode-icon");
    element.setAttribute("data-context-menu-boundary", "");
    let iconSpan = window.getDocument().createElement("span");
    iconSpan.classList.add("icon", "is-icon-only", "icon-ruby");
    element.appendChild(iconSpan);
    element.onmouseup = (e) => {
      if (e.button === 0 && !(process.platform === "darwin" && e.ctrlKey)) {
        lumine.commands.dispatch(
          window.getElement(),
          e.shiftKey ? "overtype-mode:toggle-editor" : "overtype-mode:toggle-global",
        );
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
