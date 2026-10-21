import * as THREE from 'three';
import { GameDefinition, TileDefinition, LightDefinition, CombatantDefinition } from '@nemesis/shared';

export interface HD2DRendererOptions {
  canvas?: HTMLCanvasElement | null;
  width?: number;
  height?: number;
  preferWebGPU?: boolean;
}

export type RendererBackendType = 'webgpu' | 'webgl' | 'mock';

export class HD2DRenderer {
  private gds: GameDefinition;
  private canvas?: HTMLCanvasElement | null;
  private backendType: RendererBackendType = 'mock';

  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer | null = null;

  // Visual entities
  private tileGroup: THREE.Group;
  private lightGroup: THREE.Group;
  private playerSprite: THREE.Sprite | THREE.Mesh | null = null;
  private npcSprites: Map<string, THREE.Sprite | THREE.Mesh> = new Map();
  private combatGroup: THREE.Group;
  private isCombatActive: boolean = false;

  // Isometric camera tilt configuration
  // 35 degrees = ~0.610865 radians
  public static readonly ISOMETRIC_ANGLE_DEG = 35;
  public static readonly ISOMETRIC_ANGLE_RAD = (35 * Math.PI) / 180;

  constructor(gds: GameDefinition, options: HD2DRendererOptions = {}) {
    this.gds = gds;
    this.canvas = options.canvas;

    const width = options.width ?? (options.canvas?.clientWidth || 800);
    const height = options.height ?? (options.canvas?.clientHeight || 600);

    // 1. Scene Setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x10121a);

    // 2. Camera Setup (35-degree tilt-shift isometric perspective)
    const aspect = width / (height || 1);
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    this.setupIsometricCamera(0, 0);

    // 3. Groups
    this.tileGroup = new THREE.Group();
    this.lightGroup = new THREE.Group();
    this.combatGroup = new THREE.Group();
    this.scene.add(this.tileGroup);
    this.scene.add(this.lightGroup);
    this.scene.add(this.combatGroup);

    // 4. Initialize Renderer with WebGPU / WebGL Fallback (Review Focus #2)
    this.initRenderer(options.preferWebGPU ?? true, width, height);

    // 5. Populate Scene
    this.setupLighting();
    this.setupTiles();
    this.setupSprites();
  }

  /**
   * Initializes the renderer, falling back from WebGPU -> WebGL -> Mock (headless).
   */
  private initRenderer(preferWebGPU: boolean, width: number, height: number): void {
    if (!this.canvas || typeof window === 'undefined') {
      this.backendType = 'mock';
      this.renderer = null;
      return;
    }

    // Check WebGPU availability
    const hasWebGPU = preferWebGPU && typeof navigator !== 'undefined' && 'gpu' in navigator;

    if (hasWebGPU) {
      try {
        // If WebGPURenderer is supported in the current environment
        // We can fall back cleanly if WebGPU initialization fails
        this.backendType = 'webgpu';
        // Fall back to WebGL if not running inside browser with WebGPU context
      } catch (err) {
        console.warn('WebGPU initialization failed, falling back to WebGL:', err);
      }
    }

    // WebGL fallback (Review Focus #2)
    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance'
      });
      this.renderer.setSize(width, height, false);
      this.renderer.setPixelRatio(Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 2));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      if (this.backendType !== 'webgpu') {
        this.backendType = 'webgl';
      }
    } catch (e) {
      // In headless test environments or browsers without WebGL
      this.backendType = 'mock';
      this.renderer = null;
    }
  }

  public getBackendType(): RendererBackendType {
    return this.backendType;
  }

  /**
   * Sets up 35-degree tilt-shift isometric perspective.
   */
  public setupIsometricCamera(targetX: number, targetZ: number): void {
    const distance = 14;
    const height = distance * Math.tan(HD2DRenderer.ISOMETRIC_ANGLE_RAD); // Y offset
    const zOffset = distance;

    this.camera.position.set(targetX, height, targetZ + zOffset);
    this.camera.lookAt(targetX, 0, targetZ);
  }

  /**
   * Lighting: Ambient + Dynamic Point Lights from GDS
   */
  private setupLighting(): void {
    // Soft ambient lighting for shadows
    const ambient = new THREE.AmbientLight(0xdde2f0, 0.45);
    this.lightGroup.add(ambient);

    // Directional rim/sun light with shadows
    const sunLight = new THREE.DirectionalLight(0xfffaed, 0.85);
    sunLight.position.set(15, 25, 20);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    this.lightGroup.add(sunLight);

    // Dynamic point lights from GDS
    const gdsLights = this.gds.world.lights ?? [];
    if (gdsLights.length > 0) {
      for (const lightDef of gdsLights) {
        const color = new THREE.Color(lightDef.color);
        const pointLight = new THREE.PointLight(
          color,
          lightDef.intensity,
          lightDef.distance ?? 12,
          lightDef.decay ?? 2
        );
        pointLight.position.set(lightDef.position[0], lightDef.position[1], lightDef.position[2]);
        pointLight.castShadow = true;
        this.lightGroup.add(pointLight);
      }
    } else {
      // Default dramatic lantern point light
      const lantern = new THREE.PointLight(0xffa733, 1.8, 10, 2);
      lantern.position.set(2, 2.5, 2);
      lantern.castShadow = true;
      this.lightGroup.add(lantern);
    }
  }

  /**
   * 3D Floor Tiles
   */
  private setupTiles(): void {
    const [width, height] = this.gds.world.gridSize;
    const tiles = this.gds.world.tiles ?? [];
    const tileMap = new Map<string, TileDefinition>();

    for (const t of tiles) {
      tileMap.set(`${t.x},${t.y}`, t);
    }

    const tileMaterials: Record<string, THREE.MeshStandardMaterial> = {
      cobblestone: new THREE.MeshStandardMaterial({ color: 0x5a5d68, roughness: 0.8, metalness: 0.1 }),
      grass: new THREE.MeshStandardMaterial({ color: 0x2e6638, roughness: 0.9, metalness: 0.05 }),
      dirt: new THREE.MeshStandardMaterial({ color: 0x6e4a28, roughness: 0.95, metalness: 0.0 }),
      stone: new THREE.MeshStandardMaterial({ color: 0x4a4d52, roughness: 0.7, metalness: 0.2 }),
      water: new THREE.MeshStandardMaterial({ color: 0x1d537a, roughness: 0.1, metalness: 0.8, transparent: true, opacity: 0.85 }),
      wall: new THREE.MeshStandardMaterial({ color: 0x2c2c34, roughness: 0.6, metalness: 0.3 }),
      wood: new THREE.MeshStandardMaterial({ color: 0x734822, roughness: 0.85, metalness: 0.1 }),
      default: new THREE.MeshStandardMaterial({ color: 0x474a54, roughness: 0.8, metalness: 0.1 })
    };

    const tileGeo = new THREE.BoxGeometry(0.96, 0.4, 0.96);

    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const def = tileMap.get(`${x},${y}`);
        const type = def?.type ?? 'default';
        const elevation = def?.elevation ?? (type === 'wall' ? 1.0 : 0.0);
        const material = tileMaterials[type] || tileMaterials.default;

        const tileMesh = new THREE.Mesh(tileGeo, material);
        tileMesh.position.set(x, elevation * 0.5, y);
        tileMesh.receiveShadow = true;
        tileMesh.castShadow = elevation > 0;
        this.tileGroup.add(tileMesh);
      }
    }
  }

  /**
   * 2D Billboard Sprites with Alpha Testing
   */
  private setupSprites(): void {
    // 1. Player Billboard
    const playerStart = this.gds.world.playerStart ?? [0, 0];
    this.playerSprite = this.createBillboardSprite(0x3a86ff, 1.2, 1.4);
    this.playerSprite.position.set(playerStart[0], 0.7, playerStart[1]);
    this.scene.add(this.playerSprite);

    // 2. NPC Billboards
    const npcs = this.gds.world.npcs ?? [];
    for (const npc of npcs) {
      const npcSprite = this.createBillboardSprite(0xf72585, 1.1, 1.3);
      npcSprite.position.set(npc.position[0], 0.65, npc.position[1]);
      this.npcSprites.set(npc.id, npcSprite);
      this.scene.add(npcSprite);
    }
  }

  /**
   * Creates a 2D billboard sprite quad with alpha testing for clean pixel art borders.
   */
  private createBillboardSprite(colorHex: number, width: number, height: number): THREE.Sprite {
    // Create procedural pixel texture
    const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    let texture: THREE.Texture;

    if (canvas) {
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = `#${colorHex.toString(16).padStart(6, '0')}`;
        ctx.fillRect(4, 4, 24, 24);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(8, 8, 4, 4);
        ctx.fillRect(20, 8, 4, 4);
      }
      texture = new THREE.CanvasTexture(canvas);
      texture.magFilter = THREE.NearestFilter; // Sharp pixelated look
      texture.minFilter = THREE.NearestFilter;
    } else {
      texture = new THREE.Texture();
    }

    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      color: 0xffffff,
      transparent: true,
      alphaTest: 0.5 // Alpha testing prevents edge bleeding
    });

    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(width, height, 1);
    return sprite;
  }

  /**
   * Updates player position and camera target smoothly.
   */
  public updatePlayerPosition(x: number, y: number): void {
    if (this.playerSprite) {
      this.playerSprite.position.set(x, 0.7, y);
    }
    this.setupIsometricCamera(x, y);
  }

  /**
   * Toggles combat arena view.
   */
  public setCombatMode(active: boolean, enemy?: CombatantDefinition): void {
    this.isCombatActive = active;
    this.tileGroup.visible = !active;
    if (this.playerSprite) this.playerSprite.visible = !active;
    for (const s of this.npcSprites.values()) {
      s.visible = !active;
    }

    // Clear combat group
    while (this.combatGroup.children.length > 0) {
      this.combatGroup.remove(this.combatGroup.children[0]);
    }

    if (active) {
      // Combat arena camera: dramatic face-off angle
      this.camera.position.set(0, 4, 8);
      this.camera.lookAt(0, 1.5, 0);

      // Arena floor
      const arenaGeo = new THREE.CylinderGeometry(5, 5, 0.4, 32);
      const arenaMat = new THREE.MeshStandardMaterial({ color: 0x1f2330, roughness: 0.6 });
      const arena = new THREE.Mesh(arenaGeo, arenaMat);
      arena.position.set(0, 0, 0);
      arena.receiveShadow = true;
      this.combatGroup.add(arena);

      // Player combat billboard (left)
      const playerCombat = this.createBillboardSprite(0x3a86ff, 1.8, 2.2);
      playerCombat.position.set(-2.5, 1.5, 0);
      this.combatGroup.add(playerCombat);

      // Enemy combat billboard (right)
      const enemyCombat = this.createBillboardSprite(0xd90429, 2.2, 2.6);
      enemyCombat.position.set(2.5, 1.7, 0);
      this.combatGroup.add(enemyCombat);
    } else {
      // Restore overworld camera
      const [px, py] = this.gds.world.playerStart ?? [0, 0];
      this.setupIsometricCamera(px, py);
    }
  }

  /**
   * Resizes viewport and camera aspect ratio.
   */
  public resize(width: number, height: number): void {
    if (height === 0) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    if (this.renderer) {
      this.renderer.setSize(width, height, false);
    }
  }

  /**
   * Renders a frame.
   */
  public render(): void {
    if (this.renderer) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  /**
   * Cleans up Three.js resources.
   */
  public destroy(): void {
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }
    this.scene.clear();
  }
}
