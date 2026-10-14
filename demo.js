// Authentic package usage. Run with lumine/script/demo.js; fixtures stay in demo/.
module.exports = {
  version: 1,
  dependencies: ["language-gfm"],
  viewport: { width: 1000, height: 350 },
  async before() {},
  async prepare(context) {
    const { lumine, state, fixture, open } = context;
    state.editor = await open("more/processing.txt");
    await lumine.project.setPaths([fixture("more")]);
  },
  scenes: [
    {
      id: "scene-1",
      file: "demo.png",
      caption: "Overwrite an existing value while preserving the surrounding text.",
      timeout: 60000,
      async run(context) {
        const { lumine, state } = context;
        {
          state.editor.setCursorBufferPosition([1, 8]);
          lumine.commands.dispatch(
            lumine.views.getView(state.editor),
            "overtype-mode:toggle-editor",
          );
          state.editor.getElement().focus();
          for (const c of "07")
            state.editor
              .getElement()
              .getComponent()
              .didTextInput({ data: c, preventDefault() {}, stopPropagation() {} });
        }
      },
      ready(context) {
        const { state } = context;
        return Boolean(
          state.editor.getText().includes("Window: 07") &&
          state.editor.getElement().classList.contains("overtype-cursor"),
        );
      },
    },
  ],
  async cleanup() {},
};
