import "./style.css";
import * as THREE from "three"; // Added to handle clipping plane custom colors
import * as OBC from "@thatopen/components";
import * as OBCF from "@thatopen/components-front";
import * as BUI from "@thatopen/ui";
import * as BUIC from "@thatopen/ui-obc";

// ðŸ“‹ 1. Initialize the UI Libraries
BUI.Manager.init();
BUIC.Manager.init(); 

// ðŸŒŽ 2. Setting up the scene
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
const grid = viewerGrids.create(world);

components.init();

// ðŸ§± 3. Setting up the IFC Loader
const ifcLoader = components.get(OBC.IfcLoader);
await ifcLoader.setup();

// âš¡ 4. Initialize Fragments Manager FIRST
const workerUrl = await OBC.FragmentsManager.getWorker();
const fragments = components.get(OBC.FragmentsManager);
fragments.init(workerUrl);

// ðŸ’¡ 5. Setup Highlighter
const highlighter = components.get(OBCF.Highlighter);
highlighter.setup({ world });
highlighter.zoomToSelection = true;

// âœ¨ 6. Setup Hoverer
const hoverer = components.get(OBCF.Hoverer);
hoverer.world = world;
hoverer.enabled = true;

// âœ‚ï¸ 7. Setup Raycaster and Clipper Features
const casters = components.get(OBC.Raycasters);
casters.get(world); // Tells the engine to map cursor coordinates inside our world

const clipper = components.get(OBC.Clipper);
clipper.enabled = true;

// Bind double click event to the viewport canvas to trigger a new cut plane
viewport.ondblclick = () => {
  if (clipper.enabled) {
    clipper.create(world);
  }
};

// Bind keyboard "Delete" or "Backspace" to remove the plane directly under the user's cursor
window.onkeydown = (event) => {
  if (event.code === "Delete" || event.code === "Backspace") {
    if (clipper.enabled) clipper.delete(world);
  }
};

// Helper function to toggle existing cuts on/off
const toggleClippings = () => {
  for (const [, clipping] of clipper.list) {
    clipping.enabled = !clipping.enabled;
  }
};

// 8. Creating and Syncing the ViewCube 
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

viewCube.addEventListener("frontclick", () => {
  world.camera.controls.setLookAt(0, 0, 50, 0, 0, 0, true);
});

viewCube.addEventListener("backclick", () => {
  world.camera.controls.setLookAt(0, 0, -50, 0, 0, 0, true);
});

viewCube.addEventListener("leftclick", () => {
  world.camera.controls.setLookAt(-50, 0, 0, 0, 0, 0, true);
});

viewCube.addEventListener("rightclick", () => {
  world.camera.controls.setLookAt(50, 0, 0, 0, 0, 0, true);
});

viewCube.addEventListener("topclick", () => {
  world.camera.controls.setLookAt(0, 50, 0, 0, 0, 0, true);
});

viewCube.addEventListener("bottomclick", () => {
  world.camera.controls.setLookAt(0, -100, 0, 0, 0, 0, true);
});

// Hook up model rendering on load
fragments.list.onItemSet.add(async ({ value: model }) => {
  model.useCamera(world.camera.three);
  world.scene.three.add(model.object);
  await fragments.core.update(true);

  // Move the grid to the model's lowest point (ground level)
  try {
    const box = new THREE.Box3().setFromObject(model.object);
    const minY = box.min.y;
    if (Number.isFinite(minY) && grid && grid.three) {
      grid.three.position.y = minY;
      grid.three.updateMatrixWorld();
    }
  } catch (e) {
    // ignore if bounding box fails
  }
});

// Remove z-fighting
fragments.core.models.materials.list.onItemSet.add(({ value: material }) => {
  if (!("isLodMaterial" in material && material.isLodMaterial)) {
    material.polygonOffset = true;
    material.polygonOffsetUnits = 1;
    material.polygonOffsetFactor = Math.random();
  }
});

// 9. Creating the Spatial Tree UI
const [spatialTree] = BUIC.tables.spatialTree({
  components,
  models: [],
});
spatialTree.preserveStructureOnFilter = true;

// 10. Building the Left Control Panel with Model Tree and Clipper Controls
const panel = BUI.Component.create(() => {
  const [loadFragBtn] = BUIC.buttons.loadFrag({ components });

  const onSearch = (e: Event) => {
    const input = e.target as BUI.TextInput;
    spatialTree.queryString = input.value;
  };

  return BUI.html`
    <bim-panel label="BIM Controller Layout">
      
      <bim-panel-section label="Model Spatial Tree">
        ${loadFragBtn}
        <bim-text-input @input=${onSearch} placeholder="Search..." debounce="200"></bim-text-input>
        ${spatialTree}
      </bim-panel-section>

      <bim-panel-section label="Model Clipper Settings">
        <bim-label>ðŸ’¡ Instruction: Double-click model to cut. Press "Delete" over a plane to clear it.</bim-label>
        
        <bim-checkbox label="Enable Clipper Tool" checked
          @change="${({ target }: { target: BUI.Checkbox }) => { clipper.config.enabled = target.value; }}">
        </bim-checkbox>
        
        <bim-checkbox label="Show Section Outlines" checked
          @change="${({ target }: { target: BUI.Checkbox }) => { clipper.config.visible = target.value; }}">
        </bim-checkbox>

        <bim-color-input label="Planes Border Color" color="#202932"
          @input="${({ target }: { target: BUI.ColorInput }) => { clipper.config.color = new THREE.Color(target.color); }}">
        </bim-color-input>

        <bim-button label="Toggle Active Cuts" @click=${toggleClippings}></bim-button>
        <bim-button label="Clear All Section Planes" style="background-color: #ff4d4d; color: white;" 
          @click="${() => { clipper.deleteAll(); }}">
        </bim-button>
      </bim-panel-section>

    </bim-panel> 
  `;
});

// 11. Render Grid Layout
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