describe("overtype-mode status actions", () => {
  let main, lease, element, editor, window;
  const menu = () => lumine.contextMenu.templateForElement(element);
  beforeEach(async () => {
    window = lumine.workspace.getMainWindow();
    jasmine.attachToDOM(window.getElement());
    main = (await lumine.packages.activatePackage("overtype-mode")).mainModule;
    editor = await lumine.workspace.open();
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
    expect(menu().map((item) => item.mouseBindingLabel)).toEqual(["LMB", "Shift+LMB"]);
    const [tooltip] = lumine.tooltips.findTooltips(element);
    expect(tooltip.options.keyBindingCommand).toBeUndefined();
    expect(tooltip.getTitle()).toContain("Click to toggle.");
    element.dispatchEvent(new MouseEvent("mouseup", { button: 2 }));
    expect(main.global).toBe(false);
    element.dispatchEvent(new MouseEvent("mouseup", { button: 0 }));
    expect(menu().map((item) => item.checked)).toEqual([true, true]);
    element.dispatchEvent(new MouseEvent("mouseup", { button: 0, shiftKey: true }));
    expect(editor.isOvertypeMode()).toBe(false);
    expect(menu().map((item) => item.checked)).toEqual([true, false]);
  });
  it("retires the menu and mouse handler with its lease", () => {
    lease.dispose();
    expect(menu()).toEqual([]);
    element.dispatchEvent(new MouseEvent("mouseup", { button: 0 }));
    expect(main.global).toBe(false);
  });

  it("uses the active embedded editor and disables the local action without one", async () => {
    const fragment = lumine.workspace.buildTextEditor();
    const registration = lumine.textEditors.add(fragment, { role: "fragment" });
    const item = {
      element: document.createElement("div"),
      getTitle: () => "Embedded editor",
      getActiveEmbeddedTextEditor: () => fragment,
    };
    const pane = lumine.workspace.getActivePane();
    try {
      pane.activateItem(item);
      lumine.commands.dispatch(element, "overtype-mode:toggle-editor");
      expect(fragment.isOvertypeMode()).toBe(true);
      expect(editor.isOvertypeMode()).toBe(false);
      expect(menu()[1].checked).toBe(true);
      item.getActiveEmbeddedTextEditor = () => undefined;
      expect(menu()[1].enabled).toBe(false);
      lumine.commands.dispatch(element, "overtype-mode:toggle-editor");
      expect(editor.isOvertypeMode()).toBe(false);
    } finally {
      await pane.destroyItem(item, true);
      registration.dispose();
      fragment.destroy();
    }
  });
});
