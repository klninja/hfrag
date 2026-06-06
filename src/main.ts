import * as OBC from "@thatopen/components";
import * as OBCF from "@thatopen/components-front";
import * as BUI from "@thatopen/ui";
import * as BUIC from "@thatopen/ui-obc";

// 📋 1. Initialize the UI Libraries
BUI.Manager.init();
BUIC.Manager.init(); 

// 🌎 2. Setting up the scene
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

const viewport = document.createElement("bim-viewport");
const rendererComponent = new OBC.SimpleRenderer(components, viewport);
world.renderer = rendererComponent;

const cameraComponent = new OBC.SimpleCamera(components);
world.camera = cameraComponent;

viewport.addEventListener("resize", () => {
  rendererComponent.resize();
  cameraComponent.updateAspect();
});

const viewerGrids = components.get(OBC.Grids);
viewerGrids.create(world);

components.init();

// 🧱 3. Setting up the IFC Loader
const ifcLoader = components.get(OBC.IfcLoader);
await ifcLoader.setup();

// ⚡ 4. Initialize Fragments Manager FIRST
const workerUrl = await OBC.FragmentsManager.getWorker();
const fragments = components.get(OBC.FragmentsManager);
fragments.init(workerUrl);

// 💡 5. Setup Highlighter
const highlighter = components.get(OBCF.Highlighter);
highlighter.setup({ world });
highlighter.zoomToSelection = true;

// ✨ 6. Setup Hoverer (Corrected: directly assign the world)
const hoverer = components.get(OBCF.Hoverer);
hoverer.world = world;
hoverer.enabled = true;

// 🧊 7. Creating and Syncing the ViewCube 
const viewCube = document.createElement("bim-view-cube");
viewCube.camera = world.camera.three;
viewport.append(viewCube);

// Update event loop for camera actions
world.camera.controls.addEventListener("update", () => {
  fragments.core.update();
  if (typeof viewCube.updateOrientation === "function") {
    viewCube.updateOrientation();
  }
});

viewCube.addEventListener("leftclick", () => {
  world.camera.controls.setLookAt(-10, 10, 0, 1, 10, 0, true);
});

// Hook up model rendering on load
fragments.list.onItemSet.add(async ({ value: model }) => {
  model.useCamera(world.camera.three);
  world.scene.three.add(model.object);
  await fragments.core.update(true);
});

// Remove z-fighting
fragments.core.models.materials.list.onItemSet.add(({ value: material }) => {
  if (!("isLodMaterial" in material && material.isLodMaterial)) {
    material.polygonOffset = true;
    material.polygonOffsetUnits = 1;
    material.polygonOffsetFactor = Math.random();
  }
});

// 🌲 8. Creating the Spatial Tree UI
const [spatialTree] = BUIC.tables.spatialTree({
  components,
  models: [],
});
spatialTree.preserveStructureOnFilter = true;

// 🎛️ 9. Building the Left Control Panel
const panel = BUI.Component.create(() => {
  const [loadFragBtn] = BUIC.buttons.loadFrag({ components });

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

// 📐 10. Render Grid Layout
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