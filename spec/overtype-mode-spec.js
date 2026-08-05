describe("overtype-mode", () => {
  it("activates and deactivates cleanly", async () => {
    await atom.packages.activatePackage("overtype-mode");
    expect(atom.packages.isPackageActive("overtype-mode")).toBe(true);
    await atom.packages.deactivatePackage("overtype-mode");
    expect(atom.packages.isPackageActive("overtype-mode")).toBe(false);
  });
});
