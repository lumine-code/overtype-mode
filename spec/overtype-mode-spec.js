describe("overtype-mode", () => {
  it("activates and deactivates cleanly", async () => {
    await lumine.packages.activatePackage("overtype-mode");
    expect(lumine.packages.isPackageActive("overtype-mode")).toBe(true);
    await lumine.packages.deactivatePackage("overtype-mode");
    expect(lumine.packages.isPackageActive("overtype-mode")).toBe(false);
  });

  it("stops observing a removed editor and observes it once when re-added", async () => {
    const pack = await lumine.packages.activatePackage("overtype-mode");
    const mainModule = pack.mainModule;
    const editor = lumine.workspace.buildTextEditor();
    let registration = lumine.textEditors.add(editor, { role: "fragment" });

    editor.setOvertypeMode(true);
    expect(mainModule.editorSubscriptions.has(editor)).toBe(true);
    expect(editor.getElement().classList.contains("overtype-cursor")).toBe(true);

    registration.dispose();
    expect(mainModule.editorSubscriptions.has(editor)).toBe(false);
    expect(editor.getElement().classList.contains("overtype-cursor")).toBe(false);

    registration = lumine.textEditors.add(editor, { role: "fragment" });
    expect(mainModule.editorSubscriptions.has(editor)).toBe(true);
    expect(editor.getElement().classList.contains("overtype-cursor")).toBe(true);

    spyOn(mainModule, "updateEditorClass").and.callThrough();
    editor.toggleOvertypeMode();
    expect(mainModule.updateEditorClass.calls.count()).toBe(1);

    const editorSubscriptions = mainModule.editorSubscriptions;
    await lumine.packages.deactivatePackage("overtype-mode");
    expect(editorSubscriptions.size).toBe(0);
    expect(editor.getElement().classList.contains("overtype-cursor")).toBe(false);

    registration.dispose();
    editor.destroy();
  });
});
