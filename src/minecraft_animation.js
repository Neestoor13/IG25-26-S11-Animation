import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import Ammo from "ammojs-typed";
import { PlayerObject } from "skinview3d";
import * as TWEEN from "@tweenjs/tween.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

let camera, controls, scene, renderer;
let textureLoader;
let gltfLoader;
const clock = new THREE.Clock();

let ambientLight;

// Mundo físico con Ammo
let physicsWorld;
const gravityConstant = 7.8;
let collisionConfiguration, dispatcher, broadphase, solver;
const margin = 0.05;

// Objetos rígidos
const rigidBodies = [];

const pos = new THREE.Vector3();
const quat = new THREE.Quaternion();
let transformAux1;

// Personajes
let characters = [];

// Creación del Listener
let listener = new THREE.AudioListener();
let sound1, sound2;

// Inicialización Ammo
Ammo(Ammo).then(start);

function start() {
  initGraphics();
  initPhysics();
  createObjects();
  //initInput();
  displayAnimation(); // Visualización de la animación
  animationLoop();
}

function initGraphics() {
  camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.2,
    2000
  );
  camera.position.set(-15, 3, 13);

  camera.add(listener); // Añadimos el listener a la cámara

  // Inicializamos el sonido
  sound1 = new THREE.Audio(listener);
  sound2 = new THREE.Audio(listener);

  const audioLoader = new THREE.AudioLoader();

  // Sonido Disparo
  audioLoader.load("audio/disparo.mp3", function (buffer) {
    sound1.setBuffer(buffer);
    sound1.setLoop(false);
    sound1.setVolume(1.0);
  });

  // Grito de Ken
  audioLoader.load("audio/ken_grito.mp3", function (buffer) {
    sound2.setBuffer(buffer);
    sound2.setLoop(false);
    sound2.setVolume(1.0);
  });

  scene = new THREE.Scene();

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 3, 13);
  controls.update();

  textureLoader = new THREE.TextureLoader();
  gltfLoader = new GLTFLoader();

  const nightText = textureLoader.load("assets/2k_stars.jpg");

  scene.background = nightText;

  ambientLight = new THREE.AmbientLight(0x1ed643, 0.35);
  scene.add(ambientLight);

  const light = new THREE.DirectionalLight(0xffffff, 0.15);
  light.position.set(-125, 18, 5);
  light.castShadow = true;
  const d = 14;
  light.shadow.camera.left = -d;
  light.shadow.camera.right = d;
  light.shadow.camera.top = d;
  light.shadow.camera.bottom = -d;
  light.shadow.camera.near = 2;
  light.shadow.camera.far = 50;
  light.shadow.mapSize.x = 1024;
  light.shadow.mapSize.y = 1024;
  scene.add(light);

  window.addEventListener("resize", onWindowResize);
}

// inicialización de las físicas
function initPhysics() {
  collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
  dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration);
  broadphase = new Ammo.btDbvtBroadphase();
  solver = new Ammo.btSequentialImpulseConstraintSolver();
  physicsWorld = new Ammo.btDiscreteDynamicsWorld(
    dispatcher,
    broadphase,
    solver,
    collisionConfiguration
  );
  physicsWorld.setGravity(new Ammo.btVector3(0, -gravityConstant, 0));

  transformAux1 = new Ammo.btTransform();
}

// Creamos cajas con físicas
function createBoxWithPhysics(sx, sy, sz, mass, pos, quat, material) {
  const object = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
  const shape = new Ammo.btBoxShape(
    new Ammo.btVector3(sx * 0.5, sy * 0.5, sz * 0.5)
  );
  shape.setMargin(margin);
  createRigidBody(object, shape, mass, pos, quat);
  return object;
}

// Crear cuerpos rígidos
function createRigidBody(object, physicsShape, mass, pos, quat, vel, angVel) {
  if (pos) object.position.copy(pos);
  else pos = object.position;
  if (quat) object.quaternion.copy(quat);
  else quat = object.quaternion;

  const transform = new Ammo.btTransform();
  transform.setIdentity();
  transform.setOrigin(new Ammo.btVector3(pos.x, pos.y, pos.z));
  transform.setRotation(new Ammo.btQuaternion(quat.x, quat.y, quat.z, quat.w));
  const motionState = new Ammo.btDefaultMotionState(transform);

  const localInertia = new Ammo.btVector3(0, 0, 0);
  physicsShape.calculateLocalInertia(mass, localInertia);

  const rbInfo = new Ammo.btRigidBodyConstructionInfo(
    mass,
    motionState,
    physicsShape,
    localInertia
  );
  const body = new Ammo.btRigidBody(rbInfo);
  body.setFriction(0.5);

  if (vel) body.setLinearVelocity(new Ammo.btVector3(vel.x, vel.y, vel.z));
  if (angVel)
    body.setAngularVelocity(new Ammo.btVector3(angVel.x, angVel.y, angVel.z));

  object.userData.physicsBody = body;
  object.userData.collided = false;

  scene.add(object);
  if (mass > 0) rigidBodies.push(object);
  physicsWorld.addRigidBody(body);
  return body;
}

// Creación de los objetos
function createObjects() {
  // Suelo
  pos.set(0, -0.5, 0);
  quat.set(0, 0, 0, 1);
  const suelo = createBoxWithPhysics(
    40,
    1,
    40,
    0,
    pos,
    quat,
    new THREE.MeshPhongMaterial({ color: 0xffffff })
  );
  suelo.receiveShadow = true;
  textureLoader.load(
    "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/4k/brick_pavement_02/brick_pavement_02_diff_4k.jpg",
    (texture) => {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(4, 4);
      suelo.material.map = texture;
      suelo.material.needsUpdate = true;
    }
  );

  // === Creamos 2 grupos de cajas ===

  createBoxCluster();

  createBoxCluster({
    sizeX: 6,
    sizeY: 6,
    sizeZ: 5,
    origin: new THREE.Vector3(7, 0.5, 15),
  });

  // === Cargado de texturas y creación de edificios ===

  const tex = textureLoader.load("assets/edificio_ladrillo.jpg");
  const tex2 = textureLoader.load("assets/edificio_ladrillo_ruinas.jpg");
  const tex3 = textureLoader.load("assets/bloque_edificios.jpg");

  // Edificio ladrillo 1
  createCube({
    position: new THREE.Vector3(10, 1, -5),
    size: new THREE.Vector3(25, 25, 7),
    color: "#ffffff",
    texture: tex,
    rotation: { x: 0, y: Math.PI / 2, z: 0 },
    physics: true,
  });

  // Edificio en ruinas 1
  createCube({
    position: new THREE.Vector3(-8, 1, -10),
    size: new THREE.Vector3(20, 25, 7),
    color: "#ffffff",
    texture: tex2,
    rotation: { x: 0, y: 0, z: 0 },
    physics: true,
  });

  // Bloque de oscuridad
  createCube({
    position: new THREE.Vector3(4, 1, -15),
    size: new THREE.Vector3(4.5, 25, 7),
    color: "#000000",
    rotation: { x: 0, y: 0, z: 0 },
  });

  // Bloque de edificios 1
  createCube({
    position: new THREE.Vector3(15, 1, 12),
    size: new THREE.Vector3(20, 45, 1),
    color: "#ffffff",
    texture: tex3,
    rotation: { x: 0, y: Math.PI / 2, z: 0 },
    physics: true,
  });

  // Edificios frente personajes
  // Edificio ruinas 2
  createCube({
    position: new THREE.Vector3(5, 1, 25),
    size: new THREE.Vector3(20, 25, 7),
    color: "#ffffff",
    texture: tex2,
    rotation: { x: 0, y: 0, z: 0 },
    physics: true,
  });

  // Edificio ladrillos 2

  createCube({
    position: new THREE.Vector3(-9, 1, 20),
    size: new THREE.Vector3(25, 25, 7),
    color: "#ffffff",
    texture: tex,
    rotation: { x: 0, y: 0, z: 0 },
    physics: true,
  });

  // Edificio ladrillo 3
  createCube({
    position: new THREE.Vector3(-20, 1, -3),
    size: new THREE.Vector3(25, 25, 7),
    color: "#ffffff",
    texture: tex,
    rotation: { x: 0, y: Math.PI / 2, z: 0 },
    physics: true,
  });

  // Bloque de oscuridad 2
  createCube({
    position: new THREE.Vector3(-23, 1, 13),
    size: new THREE.Vector3(4.5, 25, 7),
    color: "#000000",
    rotation: { x: 0, y: 0, z: 0 },
  });

  // === Creación de varios personajes con distintas skins y tamaños ===

  // Cargamos la textura de Takaya
  characters.push(
    createCharacter({
      position: new THREE.Vector3(4, 1.95, -13),
      scale: new THREE.Vector3(0.15, 0.15, 0.15),
      skinURL: "assets/takaya.png",
    })
  );

  // Cargamos la pistola de Takaya Sakaki
  gltfLoader.load(
    "assets/minecraft_pistol/scene.gltf",
    (gltf) => {
      const gun = gltf.scene;

      // Activamos la sombras en los meshes
      gun.traverse((obj) => {
        if (obj.isMesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
        }
      });

      characters[0].player.skin.rightArm.add(gun); // Asociamos la pistola a Takaya en lugar de a la escena

      // Ajustamos la escala, la posición y la rotacaión
      gun.scale.set(0.3, 0.3, 0.3);
      gun.position.set(1, -12.5, 0);
      gun.rotation.set(Math.PI / 2, Math.PI, 0);
      window.gun = gun;
    },
    undefined,
    (error) => {
      console.error("Error cargando GLTF:", error);
    }
  );

  // Cargamos la textura de Shinjiro Aragaki
  characters.push(
    createCharacter({
      position: new THREE.Vector3(-20, 1.95, 13),
      scale: new THREE.Vector3(0.125, 0.125, 0.125),
      skinURL: "assets/aragaki.png",
    })
  );

  characters[1].player.rotation.y = Math.PI / 2;

  // Cargamos la textura de Ken Amada
  characters.push(
    createCharacter({
      position: new THREE.Vector3(5, 1.25, 13),
      scale: new THREE.Vector3(0.08, 0.085, 0.125),
      skinURL: "assets/ken.png",
    })
  );

  characters[2].player.rotation.y = Math.PI / 2;
}

// Función para crear cada uno de los personajes
function createCharacter(params) {
  const position = params.position || new THREE.Vector3(0, 0, 0);
  const scale = params.scale || new THREE.Vector3(0.125, 0.125, 0.125);
  const skinURL = params.skinURL || "assets/skin.png";

  const player = new PlayerObject();
  player.position.copy(position);
  player.scale.copy(scale);

  const loader = new THREE.TextureLoader();
  loader.load(skinURL, (texture) => {
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.flipY = true;
    player.skin.map = texture;
    player.cape.visible = false;
  });

  scene.add(player);

  return { player }; // Retornamos player para poder animar sus articulaciones
}

// Cremos las distintas cajas acumuladas al final del callejón
function createBoxCluster({
  sizeX = 8, // Definimos cuantas cajas a lo ancho
  sizeY = 3, // Definimos cuantas cajas hacia arriba
  sizeZ = 5, // Definimos cuantas cajas de profundidad
  boxWidth = 1,
  boxHeight = 1,
  boxDepth = 1,
  mass = 1,
  origin = new THREE.Vector3(7, 0.5, 10.5),
  material = new THREE.MeshPhongMaterial({ color: 0xb08b68 }),
} = {}) {
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion(0, 0, 0, 1);

  // Empezamos desde la esquina baja del bloque
  for (let y = 0; y < sizeY; y++) {
    for (let x = 0; x < sizeX; x++) {
      for (let z = 0; z < sizeZ; z++) {
        pos.set(
          origin.x + x * boxWidth,
          origin.y + y * boxHeight,
          origin.z + z * boxDepth
        );

        const box = createBoxWithPhysics(
          boxWidth,
          boxHeight,
          boxDepth,
          mass,
          pos,
          quat,
          material
        );

        box.castShadow = true;
        box.receiveShadow = true;
      }
    }
  }
}

function createCube(options = {}) {
  const {
    position = new THREE.Vector3(0, 0, 0),
    size = new THREE.Vector3(1, 1, 1),
    color = 0xffffff,
    texture = null,
    rotation = null,
    castShadow = true,
    receiveShadow = true,
    physics = false,
    mass = 0,
  } = options;

  const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
  const material = new THREE.MeshPhongMaterial(
    texture ? { map: texture } : { color }
  );

  const mesh = new THREE.Mesh(geometry, material);

  mesh.position.copy(position);

  if (rotation) {
    if (rotation instanceof THREE.Euler) {
      mesh.rotation.copy(rotation);
    } else {
      mesh.rotation.set(rotation.x || 0, rotation.y || 0, rotation.z || 0);
    }
  }

  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;

  scene.add(mesh);

  // Si physics = true se activan las físicas para los edificios
  if (physics) {
    const shape = new Ammo.btBoxShape(
      new Ammo.btVector3(size.x / 2, size.y / 2, size.z / 2)
    );
    shape.setMargin(0.05);

    const transform = new Ammo.btTransform();
    transform.setIdentity();
    transform.setOrigin(new Ammo.btVector3(position.x, position.y, position.z));

    const quat = new THREE.Quaternion();
    mesh.getWorldQuaternion(quat);
    transform.setRotation(
      new Ammo.btQuaternion(quat.x, quat.y, quat.z, quat.w)
    );

    const motionState = new Ammo.btDefaultMotionState(transform);

    const localInertia = new Ammo.btVector3(0, 0, 0);
    if (mass > 0) shape.calculateLocalInertia(mass, localInertia);

    const rbInfo = new Ammo.btRigidBodyConstructionInfo(
      mass,
      motionState,
      shape,
      localInertia
    );

    const body = new Ammo.btRigidBody(rbInfo);
    body.setFriction(0.8);

    mesh.userData.physicsBody = body;

    physicsWorld.addRigidBody(body);
    if (mass > 0) rigidBodies.push(mesh);
  }

  return mesh;
}

function updatePhysics(deltaTime) {
  physicsWorld.stepSimulation(deltaTime, 10);
  for (let i = 0; i < rigidBodies.length; i++) {
    const objThree = rigidBodies[i];
    const objPhys = objThree.userData.physicsBody;
    const ms = objPhys.getMotionState();
    if (ms) {
      ms.getWorldTransform(transformAux1);
      const p = transformAux1.getOrigin();
      const q = transformAux1.getRotation();
      objThree.position.set(p.x(), p.y(), p.z());
      objThree.quaternion.set(q.x(), q.y(), q.z(), q.w());
      objThree.userData.collided = false;
    }
  }
}

function addPhysicsToCharacter(character, mass = 5) {
  const player = character.player;
  const box = new THREE.Box3().setFromObject(player);
  const size = new THREE.Vector3();
  box.getSize(size);

  const shape = new Ammo.btBoxShape(
    new Ammo.btVector3(size.x / 2, size.y / 2, size.z / 2)
  );
  shape.setMargin(margin);

  const transform = new Ammo.btTransform();
  transform.setIdentity();
  transform.setOrigin(
    new Ammo.btVector3(player.position.x, player.position.y, player.position.z)
  );

  const quat = new THREE.Quaternion();
  player.getWorldQuaternion(quat);
  transform.setRotation(new Ammo.btQuaternion(quat.x, quat.y, quat.z, quat.w));

  const motionState = new Ammo.btDefaultMotionState(transform);

  const localInertia = new Ammo.btVector3(0, 0, 0);
  shape.calculateLocalInertia(mass, localInertia);

  const rbInfo = new Ammo.btRigidBodyConstructionInfo(
    mass,
    motionState,
    shape,
    localInertia
  );
  const body = new Ammo.btRigidBody(rbInfo);
  body.setFriction(0.5);

  player.userData.physicsBody = body;
  physicsWorld.addRigidBody(body);
  rigidBodies.push(player);
}

function moveCameraTo(targetPos, lookAt = null, duration = 20000) {
  new TWEEN.Tween(camera.position)
    .to(
      {
        x: targetPos.x,
        y: targetPos.y,
        z: targetPos.z,
      },
      duration
    )
    .easing(TWEEN.Easing.Quadratic.Out)
    .start();

  // Si queremos mantener el foco en una posición usamos lookAt
  if (lookAt) {
    new TWEEN.Tween(controls.target)
      .to(
        {
          x: lookAt.x,
          y: lookAt.y,
          z: lookAt.z,
        },
        duration
      )
      .easing(TWEEN.Easing.Quadratic.Out)
      .onUpdate(() => controls.update())
      .start();
  }
}

function animateWalkingDistance(character, distanceVec, duration = 3000) {
  const player = character.player;

  const startPos = player.position.clone();
  const endPos = startPos.clone().add(distanceVec);

  const totalDistance = distanceVec.length();

  const walkTween = new TWEEN.Tween(player.position)
    .to(
      {
        x: endPos.x,
        y: endPos.y,
        z: endPos.z,
      },
      duration
    )
    .easing(TWEEN.Easing.Linear.None)
    .onUpdate(() => {
      // Distancia recorrida
      const currentDistance = player.position.distanceTo(startPos);

      // Hacemos los cálculos para caminar
      const walkPhase = (currentDistance / totalDistance) * Math.PI * 2;

      player.skin.rightArm.rotation.x = Math.sin(walkPhase) * 0.5;
      player.skin.leftArm.rotation.x = Math.sin(walkPhase + Math.PI) * 0.5;
      player.skin.rightLeg.rotation.x = Math.sin(walkPhase + Math.PI) * 0.5;
      player.skin.leftLeg.rotation.x = Math.sin(walkPhase) * 0.5;
    });

  return walkTween;
}

function animateCryPose(character) {
  const leftArm = character.player.skin.leftArm.rotation;
  const rightArm = character.player.skin.rightArm.rotation;

  new TWEEN.Tween(leftArm)
    .to(
      {
        x: -1.3,
        y: 0.9,
        z: -0.8,
      },
      1500
    )
    .easing(TWEEN.Easing.Quadratic.Out)
    .start();

  new TWEEN.Tween(rightArm)
    .to(
      {
        x: -1.3,
        y: -0.9,
        z: +0.8,
      },
      1500
    )
    .easing(TWEEN.Easing.Quadratic.Out)
    .start();
}

function shootProjectileAtTarget(shooter, target) {
  const ballMass = 5;
  const ballRadius = 0.05;
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(ballRadius, 14, 10),
    new THREE.MeshPhongMaterial({ color: 0xff0000 })
  );
  ball.castShadow = true;
  ball.receiveShadow = true;

  const ballShape = new Ammo.btSphereShape(ballRadius);
  ballShape.setMargin(margin);

  // Calculamos la posición desde donde se dispara
  const handWorldPos = new THREE.Vector3();
  shooter.player.skin.rightArm.getWorldPosition(handWorldPos);

  pos.copy(handWorldPos);
  quat.set(0, 0, 0, 1);

  const ballBody = createRigidBody(ball, ballShape, ballMass, pos, quat);

  // Apuntamos hacia el objetivo
  const targetPos = new THREE.Vector3();
  target.player.getWorldPosition(targetPos);

  const direction = new THREE.Vector3()
    .subVectors(targetPos, handWorldPos)
    .normalize();

  direction.multiplyScalar(25); // Velocidad a la que se mueve la bala
  ballBody.setLinearVelocity(
    new Ammo.btVector3(direction.x, direction.y, direction.z)
  );

  sound1.play(); // Sonido del disparo
}

function displayAnimation() {
  const targetCamPos = new THREE.Vector3(5, 4, 12);
  const lookAtPos = characters[1].player.position.clone();

  moveCameraTo(targetCamPos, lookAtPos, 10000);

  // Dummy para detectar cuando la cámara termina
  const dummy1 = { t: 0 };
  new TWEEN.Tween(dummy1)
    .to({ t: 1 }, 10000) // Mismo tiempo que moveCameraTo
    .onComplete(() => {
      // Iniciamos la animación de caminar para Aragaki
      const distanceVec1 = new THREE.Vector3(15, 0, 0);
      const walkTween1 = animateWalkingDistance(
        characters[1],
        distanceVec1,
        3000
      );

      walkTween1.onComplete(() => {
        const camPos2 = characters[1].player.position
          .clone()
          .add(new THREE.Vector3(-2, 1, -2));
        const lookAt2 = characters[2].player.position.clone();
        moveCameraTo(camPos2, lookAt2, 3000);

        const dummy2 = { t: 0 };
        new TWEEN.Tween(dummy2)
          .to({ t: 1 }, 3000)
          .onComplete(() => {
            console.log("Segunda cámara completada tras caminar.");

            // Rotamos al personaje
            const rotateTween = new TWEEN.Tween(characters[2].player.rotation)
              .to({ y: characters[2].player.rotation.y + Math.PI }, 2000)
              .easing(TWEEN.Easing.Quadratic.Out)
              .onUpdate(() => {
                characters[2].player.updateMatrixWorld();
              })
              .onComplete(() => {
                const distanceVec2 = new THREE.Vector3(-5, 0, 0);
                const walkTween2 = animateWalkingDistance(
                  characters[2],
                  distanceVec2,
                  2000
                );

                walkTween2.onComplete(() => {
                  // Rotamos de nuevo para señalar las cajas
                  new TWEEN.Tween(characters[2].player.rotation)
                    .to({ y: characters[2].player.rotation.y + Math.PI }, 2000)
                    .easing(TWEEN.Easing.Quadratic.Out)
                    .onUpdate(() => {
                      characters[2].player.updateMatrixWorld();
                    })
                    .onComplete(() => {
                      // Ken Amada levanta el brazo para apuntar a las cajas
                      const arm = characters[2].player.skin.rightArm.rotation;
                      const originalX = arm.x;

                      new TWEEN.Tween(arm)
                        .to({ x: -Math.PI / 2 }, 600)
                        .easing(TWEEN.Easing.Quadratic.Out)
                        .onComplete(() => {
                          // mantener 1s
                          setTimeout(() => {
                            new TWEEN.Tween(arm)
                              .to({ x: originalX }, 600)
                              .easing(TWEEN.Easing.Quadratic.In)
                              .start();
                          }, 1000);
                        })
                        .start();

                      characters[1].player.rotation.y = Math.PI;
                      const distanceLeft = new THREE.Vector3(0, 0, -3);
                      const walkTween3 = animateWalkingDistance(
                        characters[1],
                        distanceLeft,
                        2500
                      );
                      walkTween3.onComplete(() => {
                        characters[1].player.rotation.y -= Math.PI / 2;
                        const distanceLeft = new THREE.Vector3(10, 0, 0);
                        const walkTween4 = animateWalkingDistance(
                          characters[1],
                          distanceLeft,
                          2500
                        );

                        walkTween4.onComplete(() => {
                          continueAnimation();
                        });

                        walkTween4.start();
                      });

                      walkTween3.start();
                    })
                    .start();
                });

                walkTween2.start();
              })
              .start();
          })
          .start();
      });

      walkTween1.start();
    })
    .start();
}

function continueAnimation() {
  const targetPos = characters[0].player.position.clone();
  const camPos = targetPos.clone().add(new THREE.Vector3(0, 3, 25));

  moveCameraTo(camPos, targetPos, 4500);

  // Dummy tween para sincronizar el final del movimiento de cámara
  const dummy = { t: 0 };

  new TWEEN.Tween(dummy)
    .to({ t: 1 }, 4500)
    .onComplete(() => {
      const distanceVec = new THREE.Vector3(0, 0, 15);
      const walkTween = animateWalkingDistance(
        characters[0],
        distanceVec,
        3000
      );

      walkTween.onComplete(() => {
        const camPos2 = characters[0].player.position
          .clone()
          .add(new THREE.Vector3(-2, 1, -2));
        const lookAt2 = characters[2].player.position.clone();
        moveCameraTo(camPos2, lookAt2, 3000);

        const dummy2 = { t: 0 };
        new TWEEN.Tween(dummy2)
          .to({ t: 1 }, 3000)
          .onComplete(() => {
            characters[0].player.rotation.y -= Math.PI / 2;
            const distanceRight = new THREE.Vector3(-5, 0, 0);
            const walkTween2 = animateWalkingDistance(
              characters[0],
              distanceRight,
              2500
            );

            walkTween2.onComplete(() => {
              characters[0].player.rotation.y += Math.PI / 2;
              const distanceForward = new THREE.Vector3(0, 0, 4);
              const walkTween3 = animateWalkingDistance(
                characters[0],
                distanceForward,
                2500
              );

              walkTween3.onComplete(() => {
                characters[0].player.rotation.y += Math.PI / 4;
                const camPos3 = characters[0].player.position
                  .clone()
                  .add(new THREE.Vector3(-2, 2, 4));
                const lookAt3 = characters[1].player.position.clone();
                moveCameraTo(camPos3, lookAt3, 3000);

                const dummy3 = { t: 0 };
                new TWEEN.Tween(dummy3)
                  .to({ t: 1 }, 3000)
                  .onComplete(() => {
                    characters[1].player.lookAt(characters[0].player.position);
                    // Takaya levanta el brazo para disparar
                    const arm = characters[0].player.skin.rightArm.rotation;
                    const originalX = arm.x;

                    new TWEEN.Tween(arm)
                      .to({ x: -Math.PI / 2 }, 600)
                      .easing(TWEEN.Easing.Quadratic.Out)
                      .onComplete(() => {
                        addPhysicsToCharacter(characters[1], 5); // Activamos las físicas para que a Aragaki le afecte el tiro
                        shootProjectileAtTarget(characters[0], characters[1]); // Takaya dispara a Aragaki

                        // Mantenemos el brazo levantado durante 1 segundo
                        setTimeout(() => {
                          const downArm = new TWEEN.Tween(arm)
                            .to({ x: originalX }, 600)
                            .easing(TWEEN.Easing.Quadratic.In)
                            .onComplete(() => {
                              // Takaya rota
                              characters[0].player.rotation.y -= Math.PI / 4; // Deshacemos el giro previo
                              characters[0].player.rotation.y += Math.PI; // Giramos hacia la izquierda

                              const camPos3 = characters[2].player.position
                                .clone()
                                .add(new THREE.Vector3(-5, 2, 4));
                              const lookAt3 = new THREE.Vector3(4, 1.95, -13);

                              moveCameraTo(camPos3, lookAt3, 3000);

                              const dummy3 = { t: 0 };
                              new TWEEN.Tween(dummy3)
                                .to({ t: 1 }, 3000)
                                .onComplete(() => {
                                  // Desactivamos las físicas de Aragaki
                                  const obj = characters[1].player;
                                  const body = obj.userData.physicsBody;
                                  if (body) {
                                    physicsWorld.removeRigidBody(body);
                                  }

                                  // Borramos a Aragaki de rigidBodies
                                  const index = rigidBodies.indexOf(obj);
                                  if (index !== -1)
                                    rigidBodies.splice(index, 1);

                                  // Borramos la referencia
                                  obj.userData.physicsBody = null;

                                  physicsWorld.removeRigidBody(body);
                                  characters[1].player.userData.physicsBody =
                                    null;

                                  // Rotamos a Aragaki para mostrar que está muerto
                                  characters[1].player.rotation.x =
                                    -Math.PI / 2; // Acostado boca arriba
                                  characters[1].player.rotation.y = 0;
                                  characters[1].player.rotation.z = 0;

                                  characters[1].player.position.y = 0.5;
                                  characters[1].player.position.z = 13;

                                  const distanceForward2 = new THREE.Vector3(
                                    0,
                                    0,
                                    -8
                                  );
                                  const walkTween4 = animateWalkingDistance(
                                    characters[0],
                                    distanceForward2,
                                    2500
                                  );

                                  walkTween4.onComplete(() => {
                                    characters[0].player.rotation.y -=
                                      Math.PI / 2;
                                    const distanceRight = new THREE.Vector3(
                                      5,
                                      0,
                                      0
                                    );
                                    const walkTween5 = animateWalkingDistance(
                                      characters[0],
                                      distanceRight,
                                      2500
                                    );

                                    walkTween5.onComplete(() => {
                                      characters[0].player.rotation.y +=
                                        Math.PI / 2;

                                      const distanceForward3 =
                                        new THREE.Vector3(0, 0, -13);
                                      const walkTween6 = animateWalkingDistance(
                                        characters[0],
                                        distanceForward3,
                                        2500
                                      );

                                      walkTween6.onComplete(() => {
                                        finishAnimation();
                                      });

                                      walkTween6.start();
                                    });
                                    walkTween5.start();
                                  });

                                  walkTween4.start();
                                })
                                .start();
                            })
                            .start();
                        }, 1000);
                      })
                      .start();
                  })
                  .start();
              });

              walkTween3.start();
            });

            walkTween2.start();
          })
          .start();
      });

      walkTween.start();
    })
    .start();
}

function finishAnimation() {
  const target = characters[2].player; // Referenciamos a Ken Amada para centrar la cámara en él

  // Punto inicial de la cámara
  const targetPos = target.position.clone();
  const camPos = targetPos.clone().add(new THREE.Vector3(-13, 3, 0));

  moveCameraTo(camPos, targetPos, 4500);

  const dummy = { t: 0 };

  new TWEEN.Tween(dummy)
    .to({ t: 1 }, 4500)
    .onComplete(() => {
      ambientLight.color.set(0x707070); // Cambiamos el color del ambiente a blanco
      ambientLight.intensity = 0.05; // Cambiamos la intensidad del mismo

      // Retrocedemos la cámara lentamente
      const startPos = camera.position.clone();
      const endPos = startPos.clone().add(new THREE.Vector3(-11, 0, 0));

      animateCryPose(characters[2]);

      sound2.play();

      new TWEEN.Tween(startPos)
        .to(endPos, 16000)
        .onUpdate(() => {
          camera.position.copy(startPos);
          camera.lookAt(target.position); // La cámara se aleja mirando a Ken Amada
        })
        .onComplete(() => {
          showEndText("Incidente del 4/10<br>Néstor Déniz González", 2500);
        })
        .start();
    })
    .start();
}

// Función para animar al personaje
function animateCharacter(delta) {
  // Actualizamos el TWEEN
  TWEEN.update();
}

function animationLoop() {
  requestAnimationFrame(animationLoop);
  const deltaTime = clock.getDelta();

  updatePhysics(deltaTime);
  animateCharacter(deltaTime);

  renderer.render(scene, camera);
}

// Función para añadir autoría
function showEndText(message, visibleTime = 2000) {
  let endText = document.getElementById("endText");

  if (!endText) {
    endText = document.createElement("div");
    endText.id = "endText";

    endText.style.position = "absolute";
    endText.style.top = "50%";
    endText.style.left = "50%";
    endText.style.transform = "translate(-50%, -50%)";
    endText.style.color = "white";
    endText.style.fontSize = "32px";
    endText.style.fontFamily = "Arial, sans-serif";
    endText.style.textAlign = "center";
    endText.style.textShadow = "0 0 10px black";
    endText.style.opacity = "0";
    endText.style.transition = "opacity 1s ease";
    endText.style.pointerEvents = "none";
    endText.style.whiteSpace = "pre-line";
    endText.style.zIndex = "2";

    document.body.appendChild(endText);
  }

  endText.innerHTML = message;

  endText.getBoundingClientRect(); // Forzamos reflow para que funcione el fade-in

  // Fade-in
  endText.style.opacity = "1";

  // Fade-out
  setTimeout(() => {
    endText.style.opacity = "0";
  }, visibleTime);
}

// Función para iniciar los disparos al pulsar en la pantalla
/*function initInput() { // Comentamos porque no la usamos en este, pero puede servir para futuras mejoras
  window.addEventListener("pointerdown", (event) => {
    const mouseCoords = new THREE.Vector2(
      (event.clientX / window.innerWidth) * 2 - 1,
      -(event.clientY / window.innerHeight) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouseCoords, camera);

    const ballMass = 35,
      ballRadius = 0.4;
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(ballRadius, 14, 10),
      new THREE.MeshPhongMaterial({ color: 0x202020 })
    );
    ball.castShadow = true;
    ball.receiveShadow = true;

    const ballShape = new Ammo.btSphereShape(ballRadius);
    ballShape.setMargin(margin);

    pos.copy(raycaster.ray.direction).add(raycaster.ray.origin);
    quat.set(0, 0, 0, 1);
    const ballBody = createRigidBody(ball, ballShape, ballMass, pos, quat);

    pos.copy(raycaster.ray.direction).multiplyScalar(24);
    ballBody.setLinearVelocity(new Ammo.btVector3(pos.x, pos.y, pos.z));
  });
}*/

// Función para ajustar la pantalla
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
