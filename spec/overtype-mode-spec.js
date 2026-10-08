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

  describe("status-bar edge ownership", () => {
    let mainModule, workspaceElement, containers, edges;

    beforeEach(async () => {
      mainModule = (await lumine.packages.activatePackage("overtype-mode")).mainModule;
      workspaceElement = lumine.views.getView(lumine.workspace);
      jasmine.attachToDOM(workspaceElement);
      lumine.config.set("overtype-mode.statusBar", true);
      containers = [];
      edges = [];
    });

    afterEach(() => {
      for (const edge of edges) edge.dispose();
      for (const container of containers) container.remove();
    });

    function statusBar() {
      const container = document.createElement("div");
      workspaceElement.appendChild(container);
      containers.push(container);
      return {
        container,
        addRightTile({ item }) {
          container.appendChild(item);
          return { destroy: () => item.remove() };
        },
      };
    }

    function connect(service) {
      const edge = mainModule.consumeStatusBar(service);
      edges.push(edge);
      return edge;
    }

    it("removes only the tile and tooltip belonging to an old provider", () => {
      const first = statusBar();
      const second = statusBar();
      const tooltip = spyOn(lumine.tooltips, "add").and.callThrough();
      const oldEdge = connect(first);
      const oldTooltip = tooltip.calls.mostRecent().returnValue;
      const disposeTooltip = spyOn(oldTooltip, "dispose").and.callThrough();
      connect(second);
      oldEdge.dispose();

      expect(first.container.querySelector(".overtype-mode-icon")).toBeNull();
      expect(second.container.querySelector(".overtype-mode-icon")).not.toBeNull();
      expect(disposeTooltip).toHaveBeenCalledTimes(1);
    });

    it("shares a provider's tile until the final edge goes away", () => {
      const service = statusBar();
      const firstEdge = connect(service);
      const secondEdge = connect(service);
      expect(service.container.querySelectorAll(".overtype-mode-icon").length).toBe(1);
      firstEdge.dispose();

      expect(service.container.querySelectorAll(".overtype-mode-icon").length).toBe(1);
      secondEdge.dispose();
      expect(service.container.querySelector(".overtype-mode-icon")).toBeNull();
    });

    it("updates every live provider and preserves editor mode through config changes", async () => {
      const first = statusBar();
      const second = statusBar();
      connect(first);
      connect(second);
      const editor = await lumine.workspace.open();
      mainModule.toggleGlobal();
      expect(editor.isOvertypeMode()).toBe(true);
      for (const service of [first, second]) {
        expect(service.container.querySelector(".icon").classList.contains("active")).toBe(true);
      }
      lumine.config.set("overtype-mode.statusBar", false);
      expect(editor.isOvertypeMode()).toBe(true);
      for (const service of [first, second]) {
        expect(service.container.querySelector(".overtype-mode-icon")).toBeNull();
      }
      lumine.config.set("overtype-mode.statusBar", true);
      for (const service of [first, second]) {
        expect(service.container.querySelectorAll(".overtype-mode-icon").length).toBe(1);
        expect(service.container.querySelector(".icon").classList.contains("active")).toBe(true);
      }
    });

    it("cleans manual edges on deactivation without removing a new generation's tile", async () => {
      const service = statusBar();
      const oldEdge = connect(service);
      await lumine.packages.deactivatePackage("overtype-mode");
      expect(service.container.querySelector(".overtype-mode-icon")).toBeNull();
      mainModule = (await lumine.packages.activatePackage("overtype-mode")).mainModule;
      connect(service);
      oldEdge.dispose();

      expect(service.container.querySelectorAll(".overtype-mode-icon").length).toBe(1);
    });

    it("retires a tile returned after its setting was disabled reentrantly", () => {
      const service = statusBar();
      const add = service.addRightTile;
      let first = true;
      service.addRightTile = (options) => {
        const tile = add(options);
        if (first) {
          first = false;
          lumine.config.set("overtype-mode.statusBar", false);
        }
        return tile;
      };
      connect(service);
      expect(service.container.querySelector(".overtype-mode-icon")).toBeNull();
      lumine.config.set("overtype-mode.statusBar", true);
      expect(service.container.querySelectorAll(".overtype-mode-icon").length).toBe(1);
    });
  });
});
