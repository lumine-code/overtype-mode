describe("overtype-mode window status", () => {
  beforeEach(async () => {
    jasmine.useRealClock();
    jasmine.attachToDOM(lumine.workspace.getElement());
    await lumine.packages.activatePackage("status-bar");
    await lumine.packages.activatePackage("overtype-mode");
  });
  afterEach(async () => {
    await lumine.workspace.discardEditorWindows();
  });
  it("creates controls in future windows and removes only that package's controls on unload", async () => {
    const main = lumine.workspace.getMainWindow();
    const extra = await lumine.workspace.openEditorWindow({ show: false });
    expect(main.getElement().querySelector(".overtype-mode-icon")).not.toBeNull();
    const element = extra.getElement().querySelector(".overtype-mode-icon");
    expect(element).not.toBeNull();
    expect(element.ownerDocument).toBe(extra.getDocument());
    await lumine.packages.deactivatePackage("overtype-mode");
    for (const window of lumine.workspace.getWindows())
      expect(window.getElement().querySelector(".overtype-mode-icon")).toBeNull();
    expect(extra.getElement().querySelector("status-bar")).not.toBeNull();
  });
});
