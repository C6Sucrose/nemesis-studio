import zlib from 'zlib';
import type { GameDefinition } from '@nemesis/shared';

export interface ExportedRustProject {
  files: Record<string, string>;
  zipBuffer: Buffer;
}

/**
 * Creates a standard ZIP file in-memory synchronously using zlib deflate and standard headers.
 */
function createZipBuffer(files: Record<string, string>): Buffer {
  const fileEntries: Array<{
    nameBuf: Buffer;
    crc: number;
    compressedSize: number;
    uncompressedSize: number;
    offset: number;
  }> = [];

  let offset = 0;
  const parts: Buffer[] = [];

  for (const [name, content] of Object.entries(files)) {
    const nameBuf = Buffer.from(name, 'utf8');
    const dataBuf = Buffer.from(content, 'utf8');
    const uncompressedSize = dataBuf.length;
    const crc = zlib.crc32(dataBuf);
    const compressedData = zlib.deflateRawSync(dataBuf);
    const compressedSize = compressedData.length;

    // Local file header: 30 bytes
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // signature
    localHeader.writeUInt16LE(20, 4); // version needed (2.0)
    localHeader.writeUInt16LE(0, 6); // flags
    localHeader.writeUInt16LE(8, 8); // compression = deflate
    localHeader.writeUInt16LE(0, 10); // mod time
    localHeader.writeUInt16LE(0, 12); // mod date
    localHeader.writeUInt32LE(crc, 14); // crc-32
    localHeader.writeUInt32LE(compressedSize, 18); // compressed size
    localHeader.writeUInt32LE(uncompressedSize, 22); // uncompressed size
    localHeader.writeUInt16LE(nameBuf.length, 26); // file name length
    localHeader.writeUInt16LE(0, 28); // extra field length

    fileEntries.push({
      nameBuf,
      crc,
      compressedSize,
      uncompressedSize,
      offset,
    });

    parts.push(localHeader, nameBuf, compressedData);
    offset += localHeader.length + nameBuf.length + compressedData.length;
  }

  const centralDirStart = offset;
  let centralDirSize = 0;

  for (const entry of fileEntries) {
    // Central directory header: 46 bytes
    const cdHeader = Buffer.alloc(46);
    cdHeader.writeUInt32LE(0x02014b50, 0); // signature
    cdHeader.writeUInt16LE(20, 4); // version made by
    cdHeader.writeUInt16LE(20, 6); // version needed
    cdHeader.writeUInt16LE(0, 8); // flags
    cdHeader.writeUInt16LE(8, 10); // compression = deflate
    cdHeader.writeUInt16LE(0, 12); // mod time
    cdHeader.writeUInt16LE(0, 14); // mod date
    cdHeader.writeUInt32LE(entry.crc, 16);
    cdHeader.writeUInt32LE(entry.compressedSize, 20);
    cdHeader.writeUInt32LE(entry.uncompressedSize, 24);
    cdHeader.writeUInt16LE(entry.nameBuf.length, 28);
    cdHeader.writeUInt16LE(0, 30); // extra field length
    cdHeader.writeUInt16LE(0, 32); // comment length
    cdHeader.writeUInt16LE(0, 34); // disk start
    cdHeader.writeUInt16LE(0, 36); // internal file attributes
    cdHeader.writeUInt32LE(0, 38); // external file attributes
    cdHeader.writeUInt32LE(entry.offset, 42); // local header offset

    parts.push(cdHeader, entry.nameBuf);
    centralDirSize += cdHeader.length + entry.nameBuf.length;
  }

  // End of central directory: 22 bytes
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // signature
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // start disk
  eocd.writeUInt16LE(fileEntries.length, 8); // total records on disk
  eocd.writeUInt16LE(fileEntries.length, 10); // total records
  eocd.writeUInt32LE(centralDirSize, 12); // cd size
  eocd.writeUInt32LE(centralDirStart, 16); // cd offset
  eocd.writeUInt16LE(0, 20); // comment length
  parts.push(eocd);

  return Buffer.concat(parts);
}

/**
 * Generates Cargo.toml for the exported Rust Bevy project.
 */
function generateCargoToml(gds: GameDefinition): string {
  const rawTitle = gds.meta?.title || 'nemesis_runner';
  const packageName = rawTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'nemesis_runner';

  const version = gds.meta?.version || '0.1.0';
  const author = (gds.meta?.author || 'Nemesis Studio AI').replace(/"/g, '\\"');
  const description = (gds.meta?.description || rawTitle).replace(/"/g, '\\"');

  return `[package]
name = "${packageName}"
version = "${version}"
edition = "2021"
description = "${description}"
authors = ["${author}"]

[dependencies]
bevy = "0.14"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"

[profile.dev]
opt-level = 1

[profile.dev.package."*"]
opt-level = 3

[profile.release]
lto = "thin"
opt-level = 3
codegen-units = 1
`;
}

/**
 * Generates src/loader.rs for serde deserialization.
 */
function generateLoaderRs(): string {
  return `use bevy::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::File;
use std::io::Read;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameMetadata {
    pub title: String,
    pub author: Option<String>,
    pub version: Option<String>,
    pub description: Option<String>,
    pub prompt: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TileDefinition {
    pub x: f32,
    pub y: f32,
    #[serde(rename = "type")]
    pub tile_type: String,
    pub walkable: bool,
    pub elevation: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LightDefinition {
    #[serde(rename = "type")]
    pub light_type: String,
    pub position: [f32; 3],
    pub color: String,
    pub intensity: f32,
    pub distance: Option<f32>,
    pub decay: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NpcDefinition {
    pub id: String,
    pub name: String,
    pub position: [f32; 2],
    pub sprite: Option<String>,
    pub dialogue_node_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorldDefinition {
    pub zone_name: String,
    pub grid_size: [u32; 2],
    pub player_start: Option<[f32; 2]>,
    pub tiles: Option<Vec<TileDefinition>>,
    pub lights: Option<Vec<LightDefinition>>,
    pub npcs: Option<Vec<NpcDefinition>>,
    pub theme: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DialogueChoice {
    pub text: String,
    pub next_node_id: Option<String>,
    pub action: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DialogueNode {
    pub text: String,
    pub speaker: Option<String>,
    #[serde(default)]
    pub choices: Vec<DialogueChoice>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DialogueDefinition {
    pub initial_node_id: String,
    pub nodes: HashMap<String, DialogueNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillDefinition {
    pub id: String,
    pub name: String,
    pub mp_cost: u32,
    pub power: u32,
    #[serde(rename = "type")]
    pub skill_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CombatantDefinition {
    pub name: String,
    pub hp: i32,
    pub max_hp: i32,
    pub mp: Option<i32>,
    pub max_mp: Option<i32>,
    pub attack: i32,
    pub defense: i32,
    pub speed: Option<i32>,
    pub sprite: Option<String>,
    pub skills: Option<Vec<SkillDefinition>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CombatDefinition {
    pub enemy: CombatantDefinition,
    pub player: CombatantDefinition,
    pub background: Option<String>,
    pub turn_timer: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioDefinition {
    pub bgm_theme: Option<String>,
    pub sfx: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BloomConfig {
    pub enabled: bool,
    pub intensity: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TiltShiftConfig {
    pub enabled: bool,
    pub blur_radius: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShaderDefinition {
    pub custom_wgsl: Option<String>,
    pub custom_glsl: Option<String>,
    pub bloom: Option<BloomConfig>,
    pub tilt_shift: Option<TiltShiftConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameDefinition {
    pub meta: GameMetadata,
    pub world: WorldDefinition,
    pub dialogue: DialogueDefinition,
    pub combat: CombatDefinition,
    pub audio: Option<AudioDefinition>,
    pub shaders: Option<ShaderDefinition>,
}

#[derive(Resource, Clone, Debug)]
pub struct LoadedGameDef(pub GameDefinition);

/// Loads a GameDefinition from a file path
pub fn load_game_definition<P: AsRef<Path>>(path: P) -> Result<GameDefinition, Box<dyn std::error::Error>> {
    let mut file = File::open(path)?;
    let mut contents = String::new();
    file.read_to_string(&mut contents)?;
    let gds: GameDefinition = serde_json::from_str(&contents)?;
    Ok(gds)
}

/// Loads a GameDefinition from a JSON string
pub fn load_game_definition_from_str(json: &str) -> Result<GameDefinition, serde_json::Error> {
    serde_json::from_str(json)
}

/// Parses a hex color string like "#ffffff" or "#ff44aa" into Bevy Color
pub fn parse_hex_color(hex_str: &str) -> Color {
    let clean_hex = hex_str.trim_start_matches('#');
    if clean_hex.len() >= 6 {
        if let (Ok(r), Ok(g), Ok(b)) = (
            u8::from_str_radix(&clean_hex[0..2], 16),
            u8::from_str_radix(&clean_hex[2..4], 16),
            u8::from_str_radix(&clean_hex[4..6], 16),
        ) {
            return Color::srgb(r as f32 / 255.0, g as f32 / 255.0, b as f32 / 255.0);
        }
    }
    Color::srgb(1.0, 1.0, 1.0)
}
`;
}

/**
 * Generates src/main.rs configured with the game title and ECS systems.
 */
function generateMainRs(gds: GameDefinition): string {
  const gameTitle = gds.meta?.title || 'Nemesis HD-2D Adventure';

  return `//! Nemesis Studio - ${gameTitle}
//! High-Performance Native PC Bevy Runner
//! Autonomous Prompt-to-Playable HD-2D JRPG Engine

mod loader;

use bevy::core_pipeline::bloom::BloomSettings;
use bevy::prelude::*;
use loader::*;
use std::collections::HashSet;

/// Game state transitions
#[derive(States, Clone, Copy, Default, Eq, PartialEq, Hash, Debug)]
pub enum GameState {
    #[default]
    Overworld,
    Dialogue,
    Combat,
}

// ---------------------------------------------------------------------------
// Components & Resources
// ---------------------------------------------------------------------------

#[derive(Component)]
pub struct Player;

#[derive(Component)]
pub struct PlayerMovement {
    pub speed: f32,
}

#[derive(Component)]
pub struct MainCamera;

#[derive(Component)]
pub struct Billboard;

#[derive(Component)]
pub struct NpcEntity {
    pub id: String,
    pub name: String,
    pub dialogue_node_id: Option<String>,
}

#[derive(Component)]
pub struct GroundTile {
    pub x: i32,
    pub y: i32,
    pub walkable: bool,
}

#[derive(Component)]
pub struct DialogueUiRoot;

#[derive(Component)]
pub struct CombatUiRoot;

#[derive(Resource)]
pub struct CollisionMap {
    pub blocked_cells: HashSet<(i32, i32)>,
    pub grid_width: u32,
    pub grid_height: u32,
}

#[derive(Resource, Debug, Clone)]
pub struct DialogueState {
    pub current_node_id: String,
    pub selected_choice: usize,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum CombatTurn {
    PlayerTurn,
    EnemyTurn,
    Victory,
    Defeat,
}

#[derive(Resource, Debug, Clone)]
pub struct CombatState {
    pub player_name: String,
    pub player_hp: i32,
    pub player_max_hp: i32,
    pub player_mp: i32,
    pub player_max_mp: i32,
    pub player_attack: i32,
    pub player_defense: i32,

    pub enemy_name: String,
    pub enemy_hp: i32,
    pub enemy_max_hp: i32,
    pub enemy_attack: i32,
    pub enemy_defense: i32,

    pub turn: CombatTurn,
    pub combat_log: Vec<String>,
    pub turn_timer: Timer,
}

// ---------------------------------------------------------------------------
// Main Entrypoint
// ---------------------------------------------------------------------------

fn main() {
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap_or_else(|_| ".".into());
    let gds_path = std::path::Path::new(&manifest_dir).join("assets/game_def.json");

    let gds = match load_game_definition(&gds_path) {
        Ok(def) => def,
        Err(err) => {
            eprintln!("Warning: Could not load {:?}: {}. Using embedded GDS fallback.", gds_path, err);
            create_fallback_gds()
        }
    };

    let title = gds.meta.title.clone();

    App::new()
        .add_plugins(DefaultPlugins.set(WindowPlugin {
            primary_window: Some(Window {
                title: format!("{} - Nemesis Studio HD-2D Runner", title),
                resolution: (1280.0, 720.0).into(),
                ..default()
            }),
            ..default()
        }))
        .insert_resource(LoadedGameDef(gds))
        .init_state::<GameState>()
        .add_systems(Startup, setup_hd2d_world)
        .add_systems(
            Update,
            (
                billboard_alignment_system,
                camera_follow_system,
                player_movement_system.run_if(in_state(GameState::Overworld)),
                npc_interaction_system.run_if(in_state(GameState::Overworld)),
            ),
        )
        // Dialogue systems
        .add_systems(OnEnter(GameState::Dialogue), setup_dialogue_ui)
        .add_systems(Update, dialogue_input_system.run_if(in_state(GameState::Dialogue)))
        .add_systems(OnExit(GameState::Dialogue), teardown_dialogue_ui)
        // Combat systems
        .add_systems(OnEnter(GameState::Combat), setup_combat_ui)
        .add_systems(Update, combat_system.run_if(in_state(GameState::Combat)))
        .add_systems(OnExit(GameState::Combat), teardown_combat_ui)
        .run();
}

// ---------------------------------------------------------------------------
// World & Scene Setup
// ---------------------------------------------------------------------------

fn setup_hd2d_world(
    mut commands: Commands,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<StandardMaterial>>,
    gds_res: Res<LoadedGameDef>,
) {
    let gds = &gds_res.0;
    let grid_w = gds.world.grid_size[0];
    let grid_h = gds.world.grid_size[1];

    let mut blocked_cells = HashSet::new();

    // 1. Ambient Light
    commands.insert_resource(AmbientLight {
        color: Color::srgb(0.25, 0.25, 0.35),
        brightness: 200.0,
    });

    // 2. Dynamic Lights from GDS
    if let Some(lights) = &gds.world.lights {
        for light_def in lights {
            let color = parse_hex_color(&light_def.color);
            let pos = Vec3::new(
                light_def.position[0],
                light_def.position[1],
                light_def.position[2],
            );

            match light_def.light_type.as_str() {
                "directional" => {
                    commands.spawn(DirectionalLightBundle {
                        directional_light: DirectionalLight {
                            shadows_enabled: true,
                            illuminance: light_def.intensity * 8.0,
                            color,
                            ..default()
                        },
                        transform: Transform::from_translation(pos).looking_at(Vec3::ZERO, Vec3::Y),
                        ..default()
                    });
                }
                _ => {
                    // Default to Point Light
                    commands.spawn(PointLightBundle {
                        point_light: PointLight {
                            shadows_enabled: true,
                            intensity: light_def.intensity * 800.0,
                            range: light_def.distance.unwrap_or(25.0),
                            color,
                            ..default()
                        },
                        transform: Transform::from_translation(pos),
                        ..default()
                    });
                }
            }
        }
    } else {
        // Fallback default sunlight
        commands.spawn(DirectionalLightBundle {
            directional_light: DirectionalLight {
                shadows_enabled: true,
                illuminance: 8000.0,
                color: Color::srgb(1.0, 0.95, 0.85),
                ..default()
            },
            transform: Transform::from_xyz(10.0, 20.0, 10.0).looking_at(Vec3::ZERO, Vec3::Y),
            ..default()
        });
    }

    // 3. Ground Meshes Generation
    let tile_box_mesh = meshes.add(Cuboid::new(1.0, 0.2, 1.0));
    let wall_box_mesh = meshes.add(Cuboid::new(1.0, 1.2, 1.0));

    if let Some(tiles) = &gds.world.tiles {
        for tile in tiles {
            let color = match tile.tile_type.as_str() {
                "grass" => Color::srgb(0.22, 0.58, 0.26),
                "dirt" => Color::srgb(0.52, 0.38, 0.24),
                "stone" => Color::srgb(0.42, 0.44, 0.48),
                "water" => Color::srgb(0.2, 0.48, 0.85),
                "wall" => Color::srgb(0.3, 0.32, 0.38),
                "wood" => Color::srgb(0.48, 0.32, 0.18),
                _ => Color::srgb(0.5, 0.52, 0.56), // cobblestone
            };

            let elevation = tile.elevation.unwrap_or(0.0);
            let is_wall = tile.tile_type == "wall" || !tile.walkable;

            if !tile.walkable {
                blocked_cells.insert((tile.x as i32, tile.y as i32));
            }

            let (mesh_handle, y_pos) = if is_wall {
                (wall_box_mesh.clone(), 0.6 + elevation)
            } else {
                (tile_box_mesh.clone(), 0.1 + elevation)
            };

            commands.spawn((
                PbrBundle {
                    mesh: mesh_handle,
                    material: materials.add(StandardMaterial {
                        base_color: color,
                        perceptual_roughness: 0.8,
                        ..default()
                    }),
                    transform: Transform::from_xyz(tile.x, y_pos, tile.y),
                    ..default()
                },
                GroundTile {
                    x: tile.x as i32,
                    y: tile.y as i32,
                    walkable: tile.walkable,
                },
            ));
        }
    } else {
        // Fallback grid generation
        for x in 0..grid_w {
            for y in 0..grid_h {
                let is_edge = x == 0 || y == 0 || x == grid_w - 1 || y == grid_h - 1;
                if is_edge {
                    blocked_cells.insert((x as i32, y as i32));
                }
                let color = if is_edge {
                    Color::srgb(0.3, 0.32, 0.38)
                } else {
                    Color::srgb(0.5, 0.52, 0.56)
                };

                commands.spawn((
                    PbrBundle {
                        mesh: if is_edge { wall_box_mesh.clone() } else { tile_box_mesh.clone() },
                        material: materials.add(StandardMaterial {
                            base_color: color,
                            perceptual_roughness: 0.8,
                            ..default()
                        }),
                        transform: Transform::from_xyz(x as f32, if is_edge { 0.6 } else { 0.1 }, y as f32),
                        ..default()
                    },
                    GroundTile {
                        x: x as i32,
                        y: y as i32,
                        walkable: !is_edge,
                    },
                ));
            }
        }
    }

    commands.insert_resource(CollisionMap {
        blocked_cells,
        grid_width: grid_w,
        grid_height: grid_h,
    });

    // 4. Player Spawn (Billboard Quad)
    let player_start = gds.world.player_start.unwrap_or([grid_w as f32 / 2.0, grid_h as f32 / 2.0]);
    let sprite_mesh = meshes.add(Rectangle::new(0.8, 1.2));

    commands.spawn((
        PbrBundle {
            mesh: sprite_mesh.clone(),
            material: materials.add(StandardMaterial {
                base_color: Color::srgb(0.9, 0.2, 0.4),
                alpha_mode: AlphaMode::Blend,
                unlit: true,
                ..default()
            }),
            transform: Transform::from_xyz(player_start[0], 0.8, player_start[1]),
            ..default()
        },
        Player,
        PlayerMovement { speed: 5.0 },
        Billboard,
    ));

    // 5. NPC Spawns (Billboard Quads)
    if let Some(npcs) = &gds.world.npcs {
        for npc in npcs {
            commands.spawn((
                PbrBundle {
                    mesh: sprite_mesh.clone(),
                    material: materials.add(StandardMaterial {
                        base_color: Color::srgb(0.2, 0.7, 0.9),
                        alpha_mode: AlphaMode::Blend,
                        unlit: true,
                        ..default()
                    }),
                    transform: Transform::from_xyz(npc.position[0], 0.8, npc.position[1]),
                    ..default()
                },
                NpcEntity {
                    id: npc.id.clone(),
                    name: npc.name.clone(),
                    dialogue_node_id: npc.dialogue_node_id.clone(),
                },
                Billboard,
            ));
        }
    }

    // 6. HD-2D Camera (35-degree isometric tilt-shift perspective with Bloom)
    let cam_offset = Vec3::new(0.0, 14.0, 18.0);
    let cam_target = Vec3::new(player_start[0], 0.0, player_start[1]);

    commands.spawn((
        Camera3dBundle {
            camera: Camera {
                hdr: true,
                ..default()
            },
            transform: Transform::from_translation(cam_target + cam_offset).looking_at(cam_target, Vec3::Y),
            ..default()
        },
        BloomSettings::NATURAL,
        MainCamera,
    ));
}

// ---------------------------------------------------------------------------
// Systems: Camera & Billboarding
// ---------------------------------------------------------------------------

/// Ensures 2D billboard sprites face the camera angle to preserve HD-2D perspective
fn billboard_alignment_system(
    mut billboard_query: Query<&mut Transform, With<Billboard>>,
) {
    let billboard_rotation = Quat::from_rotation_x(-35.0_f32.to_radians());
    for mut transform in &mut billboard_query {
        transform.rotation = billboard_rotation;
    }
}

/// Camera smoothly tracks the player in overworld
fn camera_follow_system(
    player_query: Query<&Transform, (With<Player>, Without<MainCamera>)>,
    mut camera_query: Query<&mut Transform, With<MainCamera>>,
    time: Res<Time>,
) {
    let Ok(player_tf) = player_query.get_single() else { return; };
    let Ok(mut camera_tf) = camera_query.get_single_mut() else { return; };

    let cam_offset = Vec3::new(0.0, 14.0, 18.0);
    let target_pos = player_tf.translation + cam_offset;

    camera_tf.translation = camera_tf.translation.lerp(target_pos, 8.0 * time.delta_seconds());
}

// ---------------------------------------------------------------------------
// Systems: Overworld Movement & Collision
// ---------------------------------------------------------------------------

fn player_movement_system(
    keyboard_input: Res<ButtonInput<KeyCode>>,
    time: Res<Time>,
    collision_map: Res<CollisionMap>,
    mut player_query: Query<(&mut Transform, &PlayerMovement), With<Player>>,
) {
    let Ok((mut transform, movement)) = player_query.get_single_mut() else { return; };

    let mut dir = Vec3::ZERO;
    if keyboard_input.pressed(KeyCode::KeyW) || keyboard_input.pressed(KeyCode::ArrowUp) {
        dir.z -= 1.0;
    }
    if keyboard_input.pressed(KeyCode::KeyS) || keyboard_input.pressed(KeyCode::ArrowDown) {
        dir.z += 1.0;
    }
    if keyboard_input.pressed(KeyCode::KeyA) || keyboard_input.pressed(KeyCode::ArrowLeft) {
        dir.x -= 1.0;
    }
    if keyboard_input.pressed(KeyCode::KeyD) || keyboard_input.pressed(KeyCode::ArrowRight) {
        dir.x += 1.0;
    }

    if dir != Vec3::ZERO {
        let delta = dir.normalize() * movement.speed * time.delta_seconds();
        let target_x = transform.translation.x + delta.x;
        let target_z = transform.translation.z + delta.z;

        let cell_x = target_x.round() as i32;
        let cell_z = target_z.round() as i32;

        let within_bounds = cell_x >= 0
            && cell_x < collision_map.grid_width as i32
            && cell_z >= 0
            && cell_z < collision_map.grid_height as i32;

        if within_bounds && !collision_map.blocked_cells.contains(&(cell_x, cell_z)) {
            transform.translation.x = target_x;
            transform.translation.z = target_z;
        }
    }
}

/// Detect player proximity to NPCs and trigger dialogue on interaction
fn npc_interaction_system(
    keyboard_input: Res<ButtonInput<KeyCode>>,
    player_query: Query<&Transform, With<Player>>,
    npc_query: Query<(&Transform, &NpcEntity), Without<Player>>,
    mut next_state: ResMut<NextState<GameState>>,
    mut commands: Commands,
    gds_res: Res<LoadedGameDef>,
) {
    if !(keyboard_input.just_pressed(KeyCode::KeyE) || keyboard_input.just_pressed(KeyCode::Space)) {
        return;
    }

    let Ok(player_tf) = player_query.get_single() else { return; };

    for (npc_tf, npc) in &npc_query {
        let dist = player_tf.translation.distance(npc_tf.translation);
        if dist < 1.8 {
            let start_node = npc.dialogue_node_id.clone().unwrap_or_else(|| {
                gds_res.0.dialogue.initial_node_id.clone()
            });

            commands.insert_resource(DialogueState {
                current_node_id: start_node,
                selected_choice: 0,
            });

            next_state.set(GameState::Dialogue);
            break;
        }
    }
}

// ---------------------------------------------------------------------------
// Systems: Dialogue UI & Navigation
// ---------------------------------------------------------------------------

fn setup_dialogue_ui(
    mut commands: Commands,
    gds_res: Res<LoadedGameDef>,
    dialogue_state: Res<DialogueState>,
) {
    let node = gds_res.0.dialogue.nodes.get(&dialogue_state.current_node_id);
    let speaker = node.and_then(|n| n.speaker.as_ref()).map(|s| s.as_str()).unwrap_or("NPC");
    let text = node.map(|n| n.text.as_str()).unwrap_or("...");

    commands
        .spawn((
            NodeBundle {
                style: Style {
                    position_type: PositionType::Absolute,
                    bottom: Val::Percent(5.0),
                    left: Val::Percent(10.0),
                    right: Val::Percent(10.0),
                    height: Val::Px(160.0),
                    flex_direction: FlexDirection::Column,
                    padding: UiRect::all(Val::Px(16.0)),
                    border: UiRect::all(Val::Px(2.0)),
                    ..default()
                },
                border_color: BorderColor(Color::srgb(0.8, 0.7, 0.2)),
                background_color: BackgroundColor(Color::srgba(0.05, 0.05, 0.1, 0.9)),
                ..default()
            },
            DialogueUiRoot,
        ))
        .with_children(|parent| {
            // Speaker
            parent.spawn(TextBundle::from_section(
                format!("[ {} ]", speaker),
                TextStyle {
                    font_size: 20.0,
                    color: Color::srgb(1.0, 0.8, 0.2),
                    ..default()
                },
            ));
            // Dialogue text
            parent.spawn(TextBundle::from_section(
                text,
                TextStyle {
                    font_size: 16.0,
                    color: Color::srgb(1.0, 1.0, 1.0),
                    ..default()
                },
            ));
            // Instructions
            parent.spawn(TextBundle::from_section(
                "[Press 1..9 or Enter to select, Space/Escape to exit]",
                TextStyle {
                    font_size: 13.0,
                    color: Color::srgb(0.6, 0.6, 0.6),
                    ..default()
                },
            ));
        });
}

fn dialogue_input_system(
    keyboard_input: Res<ButtonInput<KeyCode>>,
    mut dialogue_state: ResMut<DialogueState>,
    mut next_state: ResMut<NextState<GameState>>,
    mut commands: Commands,
    gds_res: Res<LoadedGameDef>,
) {
    let gds = &gds_res.0;
    let Some(current_node) = gds.dialogue.nodes.get(&dialogue_state.current_node_id) else {
        next_state.set(GameState::Overworld);
        return;
    };

    if keyboard_input.just_pressed(KeyCode::Escape) {
        next_state.set(GameState::Overworld);
        return;
    }

    let mut selected_choice_idx = None;
    if keyboard_input.just_pressed(KeyCode::Digit1) && !current_node.choices.is_empty() {
        selected_choice_idx = Some(0);
    } else if keyboard_input.just_pressed(KeyCode::Digit2) && current_node.choices.len() > 1 {
        selected_choice_idx = Some(1);
    } else if keyboard_input.just_pressed(KeyCode::Digit3) && current_node.choices.len() > 2 {
        selected_choice_idx = Some(2);
    } else if keyboard_input.just_pressed(KeyCode::Enter) || keyboard_input.just_pressed(KeyCode::Space) {
        selected_choice_idx = Some(dialogue_state.selected_choice);
    }

    if let Some(idx) = selected_choice_idx {
        if let Some(choice) = current_node.choices.get(idx) {
            if choice.action.as_deref() == Some("START_COMBAT") {
                init_combat_resource(&mut commands, gds);
                next_state.set(GameState::Combat);
                return;
            }

            if let Some(ref next_id) = choice.next_node_id {
                if gds.dialogue.nodes.contains_key(next_id) {
                    dialogue_state.current_node_id = next_id.clone();
                    dialogue_state.selected_choice = 0;
                    return;
                }
            }
            next_state.set(GameState::Overworld);
        } else {
            next_state.set(GameState::Overworld);
        }
    }
}

fn teardown_dialogue_ui(
    mut commands: Commands,
    query: Query<Entity, With<DialogueUiRoot>>,
) {
    for entity in &query {
        commands.entity(entity).despawn_recursive();
    }
}

// ---------------------------------------------------------------------------
// Systems: Turn-Based Combat
// ---------------------------------------------------------------------------

fn init_combat_resource(commands: &mut Commands, gds: &GameDefinition) {
    let p = &gds.combat.player;
    let e = &gds.combat.enemy;

    commands.insert_resource(CombatState {
        player_name: p.name.clone(),
        player_hp: p.hp,
        player_max_hp: p.max_hp,
        player_mp: p.mp.unwrap_or(20),
        player_max_mp: p.max_mp.unwrap_or(20),
        player_attack: p.attack,
        player_defense: p.defense,

        enemy_name: e.name.clone(),
        enemy_hp: e.hp,
        enemy_max_hp: e.max_hp,
        enemy_attack: e.attack,
        enemy_defense: e.defense,

        turn: CombatTurn::PlayerTurn,
        combat_log: vec![format!("Battle started! {} vs {}", p.name, e.name)],
        turn_timer: Timer::from_seconds(1.0, TimerMode::Once),
    });
}

fn setup_combat_ui(
    mut commands: Commands,
    combat_state: Option<Res<CombatState>>,
    gds_res: Res<LoadedGameDef>,
) {
    if combat_state.is_none() {
        init_combat_resource(&mut commands, &gds_res.0);
    }

    commands
        .spawn((
            NodeBundle {
                style: Style {
                    position_type: PositionType::Absolute,
                    left: Val::Percent(15.0),
                    right: Val::Percent(15.0),
                    top: Val::Percent(10.0),
                    bottom: Val::Percent(10.0),
                    flex_direction: FlexDirection::Column,
                    justify_content: JustifyContent::SpaceBetween,
                    padding: UiRect::all(Val::Px(20.0)),
                    border: UiRect::all(Val::Px(3.0)),
                    ..default()
                },
                border_color: BorderColor(Color::srgb(0.9, 0.2, 0.3)),
                background_color: BackgroundColor(Color::srgba(0.08, 0.08, 0.12, 0.95)),
                ..default()
            },
            CombatUiRoot,
        ))
        .with_children(|parent| {
            parent.spawn(TextBundle::from_section(
                "⚔ TURN-BASED HD-2D BATTLE ⚔",
                TextStyle {
                    font_size: 26.0,
                    color: Color::srgb(1.0, 0.3, 0.4),
                    ..default()
                },
            ));
            parent.spawn(TextBundle::from_section(
                "[1] Attack   [2] Skill (Magic)   [3] Defend   [4] Run / Exit",
                TextStyle {
                    font_size: 18.0,
                    color: Color::srgb(0.9, 0.9, 0.9),
                    ..default()
                },
            ));
        });
}

fn combat_system(
    time: Res<Time>,
    keyboard_input: Res<ButtonInput<KeyCode>>,
    mut combat_state: ResMut<CombatState>,
    mut next_state: ResMut<NextState<GameState>>,
) {
    match combat_state.turn {
        CombatTurn::PlayerTurn => {
            if keyboard_input.just_pressed(KeyCode::Digit1) || keyboard_input.just_pressed(KeyCode::KeyA) {
                let damage = (combat_state.player_attack - combat_state.enemy_defense).max(1);
                combat_state.enemy_hp = (combat_state.enemy_hp - damage).max(0);
                combat_state.combat_log.push(format!(
                    "{} attacks for {} damage!",
                    combat_state.player_name, damage
                ));

                if combat_state.enemy_hp == 0 {
                    combat_state.turn = CombatTurn::Victory;
                    combat_state.combat_log.push("Enemy defeated! Victory!".into());
                } else {
                    combat_state.turn = CombatTurn::EnemyTurn;
                    combat_state.turn_timer.reset();
                }
            } else if keyboard_input.just_pressed(KeyCode::Digit2) {
                if combat_state.player_mp >= 5 {
                    combat_state.player_mp -= 5;
                    let damage = (combat_state.player_attack * 2 - combat_state.enemy_defense).max(5);
                    combat_state.enemy_hp = (combat_state.enemy_hp - damage).max(0);
                    combat_state.combat_log.push(format!(
                        "{} casts arcane flare for {} damage!",
                        combat_state.player_name, damage
                    ));

                    if combat_state.enemy_hp == 0 {
                        combat_state.turn = CombatTurn::Victory;
                    } else {
                        combat_state.turn = CombatTurn::EnemyTurn;
                        combat_state.turn_timer.reset();
                    }
                }
            } else if keyboard_input.just_pressed(KeyCode::Digit3) {
                combat_state.combat_log.push(format!("{} guards vigilantly!", combat_state.player_name));
                combat_state.turn = CombatTurn::EnemyTurn;
                combat_state.turn_timer.reset();
            } else if keyboard_input.just_pressed(KeyCode::Digit4) || keyboard_input.just_pressed(KeyCode::Escape) {
                next_state.set(GameState::Overworld);
            }
        }
        CombatTurn::EnemyTurn => {
            combat_state.turn_timer.tick(time.delta());
            if combat_state.turn_timer.finished() {
                let damage = (combat_state.enemy_attack - combat_state.player_defense).max(1);
                combat_state.player_hp = (combat_state.player_hp - damage).max(0);
                combat_state.combat_log.push(format!(
                    "{} strikes back for {} damage!",
                    combat_state.enemy_name, damage
                ));

                if combat_state.player_hp == 0 {
                    combat_state.turn = CombatTurn::Defeat;
                    combat_state.combat_log.push("You fell in battle...".into());
                } else {
                    combat_state.turn = CombatTurn::PlayerTurn;
                }
            }
        }
        CombatTurn::Victory | CombatTurn::Defeat => {
            if keyboard_input.just_pressed(KeyCode::Space)
                || keyboard_input.just_pressed(KeyCode::Enter)
                || keyboard_input.just_pressed(KeyCode::Escape)
            {
                next_state.set(GameState::Overworld);
            }
        }
    }
}

fn teardown_combat_ui(
    mut commands: Commands,
    query: Query<Entity, With<CombatUiRoot>>,
) {
    for entity in &query {
        commands.entity(entity).despawn_recursive();
    }
}

// ---------------------------------------------------------------------------
// Fallback GDS Generator
// ---------------------------------------------------------------------------

fn create_fallback_gds() -> GameDefinition {
    GameDefinition {
        meta: GameMetadata {
            title: "${gameTitle}".into(),
            author: Some("Nemesis AI".into()),
            version: Some("1.0.0".into()),
            description: Some("Autonomous HD-2D JRPG target".into()),
            prompt: None,
            created_at: None,
        },
        world: WorldDefinition {
            zone_name: "Sanctuary Plaza".into(),
            grid_size: [16, 16],
            player_start: Some([8.0, 8.0]),
            tiles: None,
            lights: None,
            npcs: None,
            theme: Some("cyberpunk".into()),
        },
        dialogue: DialogueDefinition {
            initial_node_id: "root".into(),
            nodes: {
                let mut m = std::collections::HashMap::new();
                m.insert(
                    "root".into(),
                    DialogueNode {
                        text: "Welcome to the HD-2D realm, traveler.".into(),
                        speaker: Some("Guardian".into()),
                        choices: vec![
                            DialogueChoice {
                                text: "Engage battle!".into(),
                                next_node_id: None,
                                action: Some("START_COMBAT".into()),
                            },
                        ],
                    },
                );
                m
            },
        },
        combat: CombatDefinition {
            player: CombatantDefinition {
                name: "Hero".into(),
                hp: 100,
                max_hp: 100,
                mp: Some(30),
                max_mp: Some(30),
                attack: 25,
                defense: 12,
                speed: Some(15),
                sprite: None,
                skills: None,
            },
            enemy: CombatantDefinition {
                name: "Golem".into(),
                hp: 80,
                max_hp: 80,
                mp: None,
                max_mp: None,
                attack: 18,
                defense: 8,
                speed: Some(8),
                sprite: None,
                skills: None,
            },
            background: None,
            turn_timer: Some(1.0),
        },
        audio: None,
        shaders: None,
    }
}
`;
}

/**
 * Generates README.md with build and run instructions.
 */
function generateReadmeMd(gds: GameDefinition): string {
  const title = gds.meta?.title || 'Nemesis HD-2D Runner';
  const description = gds.meta?.description || 'Autonomous Prompt-to-Playable HD-2D JRPG Engine';

  return `# ${title} - Native Bevy HD-2D Runner

> ${description}

Built with [Bevy Engine 0.14](https://bevyengine.org/) and generated autonomously by **Nemesis Studio**.

## Prerequisites
- [Rust](https://rustup.rs/) (Rust 1.78 or newer recommended)
- A GPU supporting Vulkan, Metal, or DirectX 12

## Quick Start
To build and run the native game:

\`\`\`bash
cargo run --release
\`\`\`

## Controls
- **W, A, S, D** or **Arrow Keys**: Move character across the 3D grid
- **E** or **Space**: Interact with NPCs / Dialogue
- **1, 2, 3, 4**: Combat menu actions ([1] Attack, [2] Magic Skill, [3] Guard, [4] Retreat)
- **Escape**: Exit dialogue or retreat
`;
}

/**
 * Exports a full, self-contained native Rust project for the given GameDefinition.
 *
 * @param gds The GameDefinition specification to package.
 * @returns An object containing the generated file tree map and the binary ZIP buffer.
 */
export function exportRustSourceProject(gds: GameDefinition): ExportedRustProject {
  const files: Record<string, string> = {
    'Cargo.toml': generateCargoToml(gds),
    'src/main.rs': generateMainRs(gds),
    'src/loader.rs': generateLoaderRs(),
    'assets/game_def.json': JSON.stringify(gds, null, 2),
    'README.md': generateReadmeMd(gds),
  };

  const zipBuffer = createZipBuffer(files);

  return {
    files,
    zipBuffer,
  };
}
