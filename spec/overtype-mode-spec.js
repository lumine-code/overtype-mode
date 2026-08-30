describe("overtype-mode", () => {
  it("activates and deactivates cleanly", async () => {
    await lumine.packages.activatePackage("overtype-mode");
    expect(lumine.packages.isPackageActive("overtype-mode")).toBe(true);
    await lumine.packages.deactivatePackage("overtype-mode");
    expect(lumine.packages.isPackageActive("overtype-mode")).toBe(false);
  });

  it("toggles editors hosted in detached surfaces", async () => {
    await lumine.packages.activatePackage("overtype-mode");
    const editor = await lumine.workspace.open();
    const element = editor.getElement();
    lumine.initializeDetachedPaneSurfaces({ force: true });
    const detachedPane = await lumine.workspace.detachPaneItem(editor, { show: false });

    try {
      await lumine.commands.dispatch(lumine.workspace.getElement(), "overtype-mode:toggle-global");
      expect(editor.isOvertypeMode()).toBe(true);
      expect(element.ownerDocument).not.toBe(document);
      expect(element.classList).toContain("overtype-cursor");
    } finally {
      if (detachedPane.isDetached()) await lumine.workspace.attachDetachedPane(detachedPane);
      lumine.initializeDetachedPaneSurfaces();
      await lumine.packages.deactivatePackage("overtype-mode");
    }
  });
});
