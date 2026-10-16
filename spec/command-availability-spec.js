describe("Overtype command availability", () => {
  let editor;
  beforeEach(async () => {
    jasmine.attachToDOM(lumine.workspace.getElement());
    await lumine.packages.activatePackage("overtype-mode");
  });
  afterEach(async () => {
    editor?.destroy();
    await lumine.packages.deactivatePackage("overtype-mode");
    editor = null;
  });
  it("distinguishes persistent global mode from an editor-dependent toggle", async () => {
    const target = lumine.workspace.getElement();
    expect(lumine.commands.canDispatch(target, "overtype-mode:toggle-global")).toBe(true);
    expect(lumine.commands.canDispatch(target, "overtype-mode:toggle-editor")).toBe(false);
    editor = await lumine.workspace.open();
    expect(lumine.commands.canDispatch(target, "overtype-mode:toggle-editor")).toBe(true);
  });
});
