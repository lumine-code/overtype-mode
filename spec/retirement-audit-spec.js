describe("Overtype retirement ownership audit", () => {
  let main, editor, bar, leases, fragments;
  beforeEach(async () => {
    jasmine.attachToDOM(lumine.workspace.getElement());
    leases = [];
    fragments = [];
    editor = await lumine.workspace.open();
    bar = (await lumine.packages.activatePackage("status-bar")).mainModule.statusBar;
    main = (await lumine.packages.activatePackage("overtype-mode")).mainModule;
  });
  afterEach(async () => {
    for (const lease of leases) lease.dispose();
    await lumine.packages.deactivatePackage("overtype-mode");
    for (const fragment of fragments) fragment.destroy();
    editor.destroy();
  });
  it("keeps a replacement native tile created inside an old tile cleanup", () => {
    let armed = false,
      replacement;
    const newer = { addRightTile: (options) => bar.addRightTile(options) };
    const older = {
      addRightTile: (options) => {
        const tile = bar.addRightTile(options),
          destroy = tile.destroy.bind(tile);
        tile.destroy = () => {
          destroy();
          if (armed) {
            armed = false;
            main.activate();
            leases.push(main.consumeStatusBar(newer));
            replacement = main.statusBars.get(newer);
          }
        };
        return tile;
      },
    };
    leases.push(main.consumeStatusBar(older));
    armed = true;
    main.deactivate();
    expect(main.statusBars?.get(newer)).toBe(replacement);
    expect(replacement.tile?.getItem()).toBe(replacement.switch);
    expect(bar.element.contains(replacement.switch)).toBe(true);
  });
  it("does not restore its block cursor from a copied native mode callback after retirement", () => {
    main.unobserveEditor(editor);
    let armed = true;
    leases.push(
      editor.onDidChangeOvertypeMode(() => {
        if (armed) {
          armed = false;
          main.deactivate();
        }
      }),
    );
    main.observeEditor(editor);
    editor.setOvertypeMode(true);
    expect(editor.isOvertypeMode()).toBe(true);
    expect(editor.getElement().classList.contains("overtype-cursor")).toBe(false);
  });
  it("ignores a copied real registry callback after another observer retires the activation", () => {
    main.deactivate();
    let armed = false;
    leases.push(
      lumine.textEditors.observe(() => {
        if (armed) {
          armed = false;
          main.deactivate();
        }
      }),
    );
    main.activate();
    armed = true;
    const fragment = lumine.workspace.buildTextEditor();
    fragments.push(fragment);
    expect(() => leases.push(lumine.textEditors.add(fragment, { role: "fragment" }))).not.toThrow();
    expect(fragment.getElement().classList.contains("overtype-cursor")).toBe(false);
  });
});
