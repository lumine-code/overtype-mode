describe("overtype-mode status actions", () => {
  const { createRequire } = require("node:module");
  const coreRequire = createRequire(
    require("node:path").join(lumine.application.getResourcePath(), "package.json"),
  );
  const { humanizeKeystroke } = coreRequire("@lumine-code/underscore-plus");
  let main, lease, element, editor, window;
  const menu = () => lumine.contextMenu.templateForElement(element);
  beforeEach(async () => {
    window = lumine.workspace.getMainWindow();
    jasmine.attachToDOM(window.getElement());
    main = (await lumine.packages.activatePackage("overtype-mode")).mainModule;
    editor = await lumine.workspace.open();
    editor.getElement().focus();
    lumine.config.set("overtype-mode.statusBar", true);
    lease = main.consumeWindowStatusBar(
      {
        addRightTile({ item }) {
          element = item;
          window.getElement().appendChild(item);
          return { destroy: () => item.remove() };
        },
      },
      { window },
    );
  });
  afterEach(async () => {
    lease.dispose();
    await lumine.packages.deactivatePackage("overtype-mode");
  });
  it("exposes both checked scopes and routes Shift-click to the current editor", () => {
    expect(menu().map((item) => item.command)).toEqual([
      "overtype-mode:toggle-global",
      "overtype-mode:toggle-editor",
    ]);
    const dispatch = spyOn(lumine.commands, "dispatch").and.callThrough();
    const [tooltip] = lumine.tooltips.findTooltips(element);
    expect(tooltip.options.keyBindingCommand).toBe("overtype-mode:toggle-global");
    expect(tooltip.options.keyBindingExtra).toBeUndefined();
    expect(tooltip.getTitle()).toContain("Click to toggle.");
    element.dispatchEvent(new MouseEvent("mouseup", { button: 2 }));
    expect(main.global).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
    element.dispatchEvent(new MouseEvent("mouseup", { button: 0 }));
    expect(menu().map((item) => item.checked)).toEqual([true, true]);
    element.dispatchEvent(new MouseEvent("mouseup", { button: 0, shiftKey: true }));
    expect(dispatch.calls.allArgs().map(([, command]) => command)).toEqual(
      menu().map((item) => item.command),
    );
    expect(editor.isOvertypeMode()).toBe(false);
    expect(menu().map((item) => item.checked)).toEqual([true, false]);
  });
  it("retires the menu and mouse handler with its lease", () => {
    lease.dispose();
    expect(menu()).toEqual([]);
    element.dispatchEvent(new MouseEvent("mouseup", { button: 0 }));
    expect(main.global).toBe(false);
  });

  it("shows the editor shortcut without changing the global shortcut", async () => {
    expect(menu().map((item) => item.keyBindingLabel)).toEqual([
      humanizeKeystroke("insert"),
      humanizeKeystroke("alt-insert"),
    ]);
    await lumine.workspace.getActivePane().destroyItem(editor, true);
    expect(menu().map((item) => item.keyBindingLabel)).toEqual([
      humanizeKeystroke("insert"),
      undefined,
    ]);
  });

  it("does not borrow the active editor's shortcut while another surface has focus", () => {
    const button = document.createElement("button");
    window.getElement().appendChild(button);
    try {
      button.focus();
      expect(lumine.workspace.getActiveTextEditor()).toBe(editor);
      expect(menu().map((item) => item.keyBindingLabel)).toEqual([
        humanizeKeystroke("insert"),
        undefined,
      ]);
    } finally {
      button.remove();
    }
  });

  it("reports the saved focus editor's mode while another editor is active", async () => {
    const other = await lumine.workspace.open(undefined, { split: "right" });
    other.setOvertypeMode(false);
    editor.setOvertypeMode(true);
    const [global, local] = lumine.contextMenu.templateForEvent(
      { target: element },
      { focusTarget: editor.getElement() },
    );
    expect(lumine.workspace.getActiveTextEditor()).toBe(other);
    expect(global.checked).toBe(false);
    expect(local.enabled).toBe(true);
    expect(local.checked).toBe(true);
  });

  it("uses a focused embedded editor's shortcut and disables the local action without one", async () => {
    const fragment = lumine.workspace.buildTextEditor();
    const registration = lumine.textEditors.add(fragment, { role: "fragment" });
    const item = {
      element: document.createElement("div"),
      getTitle: () => "Embedded editor",
      getActiveEmbeddedTextEditor: () => fragment,
    };
    const pane = lumine.workspace.getActivePane();
    try {
      item.element.appendChild(fragment.getElement());
      pane.activateItem(item);
      fragment.getElement().focus();
      lumine.commands.dispatch(element, "overtype-mode:toggle-editor");
      expect(fragment.isOvertypeMode()).toBe(true);
      expect(editor.isOvertypeMode()).toBe(false);
      expect(menu()[1].checked).toBe(true);
      expect(menu()[1].keyBindingLabel).toBe(humanizeKeystroke("alt-insert"));
      item.getActiveEmbeddedTextEditor = () => undefined;
      window.getElement().focus();
      expect(menu()[1].enabled).toBe(false);
      expect(menu()[1].keyBindingLabel).toBeUndefined();
      lumine.commands.dispatch(element, "overtype-mode:toggle-editor");
      expect(editor.isOvertypeMode()).toBe(false);
    } finally {
      await pane.destroyItem(item, true);
      registration.dispose();
      fragment.destroy();
    }
  });
});
