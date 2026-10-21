use bevy::prelude::*;
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
