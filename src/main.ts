import * as THREE from "three";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import workerUrl from "@thatopen/fragments/worker?url";

const components = new OBC.Components();

const worlds = components.get( OBC.Worlds );
const world = worlds.create<
  OBC.SimpleScene,
  OBC.OrthoPerspectiveCamera,
  OBF.PostproductionRenderer
>();

world.scene = new OBC.SimpleScene( components );
world.scene.setup();
world.scene.three.background = null;

const container = document.getElementById( "container" )!;
world.renderer = new OBF.PostproductionRenderer( components, container );
world.camera = new OBC.OrthoPerspectiveCamera( components );
await world.camera.controls.setLookAt( 68, 23, -8.5, 21.5, -5.5, 23 );

components.init();

const fragments = components.get( OBC.FragmentsManager );
fragments.init( workerUrl );

world.camera.controls.addEventListener( "update", () => fragments.core.update() );

world.onCameraChanged.add( ( camera ) =>
{
  for ( const [ , model ] of fragments.list )
  {
    model.useCamera( camera.three );
  }
  fragments.core.update( true );
} );

fragments.list.onItemSet.add( ( { value: model } ) =>
{
  model.useCamera( world.camera.three );
  world.scene.three.add( model.object );
  fragments.core.update( true );
} );

// Remove z fighting
fragments.core.models.materials.list.onItemSet.add( ( { value: material } ) =>
{
  if ( !( "isLodMaterial" in material && material.isLodMaterial ) )
  {
    material.polygonOffset = true;
    material.polygonOffsetUnits = 1;
    material.polygonOffsetFactor = Math.random();
  }
} );

const fragPaths = [ "sample.frag" ];
await Promise.all(
  fragPaths.map( async ( path ) =>
  {
    const modelId = path.split( "/" ).pop()?.split( "." ).shift();
    if ( !modelId ) return null;
    const file = await fetch( path );
    const buffer = await file.arrayBuffer();
    return fragments.core.load( buffer, { modelId } );
  } ),
);


//***** highlighter code I got from thatopen ************

components.get( OBC.Raycasters ).get( world );

const highlighter = components.get(OBF.Highlighter);
highlighter.setup({
  world,
  selectMaterialDefinition: {
  // you can change this to define the color of your highligthing
    color: new THREE.Color("#bcf124"),
    opacity: 1,
    transparent: false,
    renderedFaces: 0,
  },
});


/***** helmy highlighter code , looks the same ************

const highlighter = components.get( OBF.Highlighter );
highlighter.setup( {
  world,
  selectMaterialDefinition: {
    // you can change this to define the color of your highligthing
    color: new THREE.Color( "#bcf124" ),
    opacity: 1,
    transparent: false,
    renderedFaces: 0,
  },
} );

*** helmy highlighter code *****************/

//***** hoverer code I got from thatopen ************

const hoverer = components.get(OBF.Hoverer);
hoverer.world = world;
hoverer.enabled = true;
hoverer.material = new THREE.MeshBasicMaterial({
  color: 0x6528d7,
  transparent: true, // transparent must be true to allow the animation
  opacity: 0.5, // this will act as the maximum possible opacity when animating
  depthTest: false, // recommended to avoid z-fighting
});


