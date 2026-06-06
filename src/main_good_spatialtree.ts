import * as OBC from "@thatopen/components";
import * as OBCF from "@thatopen/components-front";
import * as BUI from "@thatopen/ui";
// Corrected package import for your app:
import * as BUIC from "@thatopen/ui-obc";

// 📋 1. Initialize the UI Library (Run once across your entire application)
BUI.Manager.init();

// 🌎 2. Setting up a simple scene
const components = new OBC.Components();
const worlds = components.get(OBC.Worlds);

const world = worlds.create<
  OBC.SimpleScene,
  OBC.SimpleCamera,
  OBC.SimpleRenderer
>();
world.name = "main";

const sceneComponent = new OBC.SimpleScene(components);
sceneComponent.setup();
world.scene = sceneComponent;

// Create the 3D canvas/viewport element
const viewport = document.createElement("bim-viewport");
const rendererComponent = new OBC.SimpleRenderer(components, viewport);
world.renderer = rendererComponent;

const cameraComponent = new OBC.SimpleCamera(components);
world.camera = cameraComponent;

viewport.addEventListener("resize", () => {
  rendererComponent.resize();
  cameraComponent.updateAspect();
});

// Add standard grid floor lines
const viewerGrids = components.get(OBC.Grids);
viewerGrids.create(world);

components.init();

// 🧱 3. Setting up the IFC and Fragment Loading Components
const ifcLoader = components.get(OBC.IfcLoader);
await ifcLoader.setup();

// 💡 4. Setting up the highlighter (Hovering and Zoom-on-click)
const highlighter = components.get(OBCF.Highlighter);
highlighter.setup({ world });
highlighter.zoomToSelection = true;

// Configure the Fragments Manager to automatically append loaded models to our scene
const workerUrl = await OBC.FragmentsManager.getWorker();
const fragments = components.get(OBC.FragmentsManager);
fragments.init(workerUrl);

world.camera.controls.addEventListener("update", () => fragments.core.update());

fragments.list.onItemSet.add(async ({ value: model }) => {
  model.useCamera(world.camera.three);
  world.scene.three.add(model.object);
  await fragments.core.update(true);
});

// Optional: Prevent z-fighting (overlapping graphic planes flickering)
fragments.core.models.materials.list.onItemSet.add(({ value: material }) => {
  if (!("isLodMaterial" in material && material.isLodMaterial)) {
    material.polygonOffset = true;
    material.polygonOffsetUnits = 1;
    material.polygonOffsetFactor = Math.random();
  }
});

// 🌲 5. Creating the Tree UI
const [spatialTree] = BUIC.tables.spatialTree({
  components,
  models: [], // Starts empty; auto-updates when a fragment/IFC model loads
});

// Ensures you don't lose the structural context (floors/groups) when searching elements
spatialTree.preserveStructureOnFilter = true;

// 🎛️ 6. Binding everything into a structural BIM Panel Component
const panel = BUI.Component.create(() => {
  const [loadFragBtn] = BUIC.buttons.loadFrag({ components });

  // Handle live hierarchy searching
  const onSearch = (e: Event) => {
    const input = e.target as BUI.TextInput;
    spatialTree.queryString = input.value;
  };

  return BUI.html`
    <bim-panel label="Spatial Tree">
      <bim-panel-section label="Model Tree">
        ${loadFragBtn}
        <bim-text-input @input=${onSearch} placeholder="Search..." debounce="200"></bim-text-input>
        ${spatialTree}
      </bim-panel-section>
    </bim-panel> 
  `;
});

// 📐 7. Render Layout using That Open UI grid layout system
const app = document.getElementById("app") as BUI.Grid<["main"]>;
app.layouts = {
  main: {
    template: `
      "panel viewport"
      / 30rem 1fr
    `,
    elements: { panel, viewport },
  },
};

app.layout = "main";