export const PLAYER_SPEED = 500;
export const JUMP_SPEED = 520;

// --- графика (Kenney Pixel Platformer) ---
export const SPRITE_SCALE = 2;

export const TILE_SHEET_KEY = 'tiles';
export const TILE_SIZE = 18;

export const CHARACTER_SHEET_KEY = 'characters';
export const CHARACTER_SIZE = 24;

export const ASSETS_PATH = 'assets/kenney-pixel-platformer';

// номера кадров в листах tilemap_packed.png и tilemap-characters_packed.png
export const PLAYER_FRAME = 4;
export const ENEMY_FRAME = 8;
// платформа = левый край, две середины, правый край
export const PLATFORM_FRAMES = [1, 2, 2, 3];
export const DISAPPEARING_PLATFORM_FRAMES = [13, 14, 14, 15];

// --- фон: готовая плитка из набора, повторяется и медленно сдвигается вслед за камерой ---
export const BACKGROUND_SHEET_KEY = 'backgrounds';
export const BACKGROUND_TILE_SIZE = 24;
export const BACKGROUND_FRAME = 16;
export const BACKGROUND_PARALLAX = 0.3;

// обводка текста, чтобы он читался и на светлом небе, и на облаках
export const HUD_STROKE_COLOR = '#161236';
export const HUD_STROKE_THICKNESS = 4;

export const PLATFORM_TILES = PLATFORM_FRAMES.length;
export const PLATFORM_WIDTH = TILE_SIZE * SPRITE_SCALE * PLATFORM_TILES;
export const PLATFORM_HEIGHT = 20;

export const PLAYER_SIZE = 38;

export const START_Y = 540;

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

export const DISAPPEARING_CHANCE = 0.35;
export const DISAPPEARING_CHANCE_MAX = 0.6;
export const DISAPPEARING_FULL_HEIGHT = 12000;

export const ENEMY_CHANCE = 0.12;
export const ENEMY_CHANCE_MAX = 0.35;

export const ENEMY_START_HEIGHT = 400;
export const ENEMY_FULL_HEIGHT = 12000;

export const ENEMY_RADIUS = 16;
export const ENEMY_SPEED = 90;

export const ENEMY_PATROL_RANGE = 90;
export const ENEMY_POSITION_ATTEMPTS = 40;

export const CAMERA_PLAYER_HEIGHT = 0.4;

export const PHASE_2_SCORE = 10;
export const HAZARDS_START_PHASE = 2;
export const PHASE_BANNER_MS = 2000;

export const PHASE_2_ENEMY_SPEED_MULTIPLIER = 1.6;
export const PHASE_2_ENEMY_CHANCE_MULTIPLIER = 1.8;
export const PHASE_2_DISAPPEARING_CHANCE_BONUS = 0.2;

export const PLAYER_LIVES = 3;

// сердечки жизней в правом верхнем углу (кадры листа tilemap_packed.png)
export const HEART_FULL_FRAME = 44;
export const HEART_EMPTY_FRAME = 46;
export const HEART_GAP = 4;
export const HUD_MARGIN = 24;

// цифры очков: кадр 170 — «0», дальше по порядку до 179 — «9»
export const DIGIT_FIRST_FRAME = 170;
export const INVULNERABLE_MS = 1500;
export const RESPAWN_BOTTOM_MARGIN = 60;

// реакция на урон: красная вспышка, мигание на время неуязвимости, тряска экрана, «удар» по сердцу
export const HIT_FLASH_COLOR = 0xff3b3b;
export const HIT_FLASH_MS = 150;
export const HIT_BLINK_MS = 100;
export const HIT_BLINK_ALPHA = 0.2;
export const HIT_SHAKE_MS = 220;
export const HIT_SHAKE_INTENSITY = 0.008;
export const HEART_POP_SCALE = 1.6;
export const HEART_POP_MS = 140;