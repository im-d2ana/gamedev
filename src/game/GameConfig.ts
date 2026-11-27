export const PLAYER_SPEED = 500;
export const JUMP_SPEED = 520;
export const SPRITE_SCALE = 2;

export const TILE_SHEET_KEY = 'tiles';
export const TILE_SIZE = 18;
export const CHARACTER_SHEET_KEY = 'characters';
export const CHARACTER_SIZE = 24;
export const ASSETS_PATH = 'assets/kenney-pixel-platformer';

export const PLAYER_FRAME = 4;
export const ENEMY_FRAME = 8;
export const PLATFORM_FRAMES = [1, 2, 3];
export const DISAPPEARING_PLATFORM_FRAMES = [13, 14, 15];
export const BACKGROUND_SHEET_KEY = 'backgrounds';
export const BACKGROUND_TILE_SIZE = 24;
export const BACKGROUND_FRAME = 16;
export const BACKGROUND_PARALLAX = 0.3;

export const CLOUD_FRAME_LEFT = 153;
export const CLOUD_FRAME_MIDDLE = 154;
export const CLOUD_FRAME_RIGHT = 155;
export const CLOUD_COUNT = 6;
export const CLOUD_ALPHA = 0.4;
export const CLOUD_PARALLAX_MIN = 0.15;
export const CLOUD_PARALLAX_MAX = 0.35;
export const CLOUD_RESPAWN_RANGE = 200;

export const HUD_STROKE_COLOR = '#161236';
export const HUD_STROKE_THICKNESS = 4;
export const PAUSE_OVERLAY_COLOR = 0x434a5f;
export const PAUSE_OVERLAY_ALPHA = 0.55;
export const PAUSE_TITLE_STROKE_THICKNESS = 8;

export const PLATFORM_TILES = PLATFORM_FRAMES.length;
export const PLATFORM_WIDTH = TILE_SIZE * SPRITE_SCALE * PLATFORM_TILES;
export const PLATFORM_HEIGHT = 20;
export const PLAYER_SIZE = 38;
export const PLAYER_START_X = 120;
export const START_Y = 540;
export const START_PLATFORMS: readonly (readonly [number, number])[] = [
  [PLAYER_START_X, START_Y],
  [350, 470],
  [600, 390],
  [820, 310],
  [620, 220],
  [350, 160],
  [700, 100],
];

export const MIN_PLATFORM_SIDE_GAP = 200;
export const PLATFORM_LEVEL_Y_JITTER = 20;
export const MIN_LEVEL_X_SHIFT = 140;
export const MAX_LEVEL_X_SHIFT = 240;
export const LEVEL_POSITION_ATTEMPTS = 100;
export const PLATFORM_SPAWN_MARGIN = 300;
export const PLATFORM_REMOVE_MARGIN = 200;
export const MIN_PLATFORMS_PER_LEVEL = 1;
export const MAX_PLATFORMS_PER_LEVEL = 2;
export const MIN_LEVEL_GAP = 80;
export const MAX_LEVEL_GAP = 130;

export const DISAPPEARING_CHANCE = 0.25;
export const DISAPPEARING_CHANCE_MAX = 0.55;
export const DISAPPEARING_FULL_HEIGHT = 30000;
export const DISAPPEARING_PLATFORM_DELAY_MS = 500;

export const ENEMY_CHANCE = 0.16;
export const ENEMY_CHANCE_MAX = 0.4;
export const ENEMY_START_HEIGHT = 600;
export const ENEMY_FULL_HEIGHT = 24000;
export const ENEMY_RADIUS = 16;
export const ENEMY_SPEED = 90;
export const ENEMY_PATROL_RANGE = 90;
export const ENEMY_POSITION_ATTEMPTS = 40;
export const ENEMY_MAX_ACTIVE_START = 2;
export const ENEMY_MAX_ACTIVE_END = 5;
export const ENEMY_MIN_GAP_START = 240;
export const ENEMY_MIN_GAP_END = 140;
export const ENEMY_MAX_DRY_LEVELS_START = 5;
export const ENEMY_MAX_DRY_LEVELS_END = 2;

export const CAMERA_PLAYER_HEIGHT = 0.4;
export const PHASE_2_SCORE = 10;
export const HAZARDS_START_PHASE = 2;
export const PHASE_BANNER_MS = 2000;
export const PHASE_2_ENEMY_SPEED_MULTIPLIER = 1.6;
export const PHASE_2_ENEMY_CHANCE_MULTIPLIER = 1.4;
export const PHASE_2_DISAPPEARING_CHANCE_BONUS = 0.2;

export const PLAYER_LIVES = 3;
export const HEART_FULL_FRAME = 44;
export const HEART_EMPTY_FRAME = 46;
export const HEART_GAP = 4;
export const HUD_MARGIN = 24;
export const DIGIT_FIRST_FRAME = 170;

export const INVULNERABLE_MS = 1500;
export const FALL_DEATH_MARGIN = 80;
export const RESPAWN_BOTTOM_MARGIN = 60;
export const RESTART_DELAY_MS = 1500;

export const HIT_FLASH_COLOR = 0xff3b3b;
export const HIT_FLASH_MS = 150;
export const HIT_BLINK_MS = 100;
export const HIT_BLINK_ALPHA = 0.2;
export const HIT_SHAKE_MS = 220;
export const HIT_SHAKE_INTENSITY = 0.008;
export const HEART_POP_SCALE = 1.6;
export const HEART_POP_MS = 140;

export const RESPAWN_FLASH_COLOR = 0x36e377;
export const RESPAWN_FLASH_MS = 200;
export const RESPAWN_RING_RADIUS = 24;
export const RESPAWN_RING_WIDTH = 4;
export const RESPAWN_RING_SCALE = 3;
export const RESPAWN_RING_MS = 450;