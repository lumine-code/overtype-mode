describe("overtype-mode", () => {
  it("activates and deactivates cleanly", async () => {
    await lumine.packages.activatePackage("overtype-mode");
    expect(lumine.packages.isPackageActive("overtype-mode")).toBe(true);
    await lumine.packages.deactivatePackage("overtype-mode");
    expect(lumine.packages.isPackageActive("overtype-mode")).toBe(false);
  });
});
