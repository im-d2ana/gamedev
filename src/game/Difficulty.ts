import * as config from './GameConfig';

export function disappearingChance(y: number, phase: number): number {
  if (phase < config.HAZARDS_START_PHASE) {
    return 0;
  }
  const climbed = Math.max(0, config.START_Y - y);

  const progress = Math.min(climbed / config.DISAPPEARING_FULL_HEIGHT, 1);

  const chance =
    config.DISAPPEARING_CHANCE +
    (config.DISAPPEARING_CHANCE_MAX - config.DISAPPEARING_CHANCE) * progress;

  return phase === 2
    ? Math.min(chance + config.PHASE_2_DISAPPEARING_CHANCE_BONUS, 1)
    : chance;
}

export function enemyProgress(y: number): number | null {
  const climbed = config.START_Y - y;
  if (climbed < config.ENEMY_START_HEIGHT) {
    return null;
  }

  return Math.min(
    (climbed - config.ENEMY_START_HEIGHT) / (config.ENEMY_FULL_HEIGHT - config.ENEMY_START_HEIGHT),
    1,
  );
}

export function enemyChance(y: number, phase: number): number {
  if (phase < config.HAZARDS_START_PHASE) {
    return 0;
  }

  const progress = enemyProgress(y);
  if (progress === null) {
    return 0;
  }

  const chance = config.ENEMY_CHANCE + (config.ENEMY_CHANCE_MAX - config.ENEMY_CHANCE) * progress;

  return phase === 2
    ? Math.min(chance * config.PHASE_2_ENEMY_CHANCE_MULTIPLIER, 1)
    : chance;
}

export function maxActiveEnemies(y: number, phase: number): number {
  if (phase < config.HAZARDS_START_PHASE) {
    return 0;
  }

  const progress = enemyProgress(y);
  if (progress === null) {
    return 0;
  }

  return Math.round(
    config.ENEMY_MAX_ACTIVE_START +
      (config.ENEMY_MAX_ACTIVE_END - config.ENEMY_MAX_ACTIVE_START) * progress,
  );
}

export function enemyMinGap(y: number): number {
  const progress = enemyProgress(y) ?? 0;

  return (
    config.ENEMY_MIN_GAP_START +
    (config.ENEMY_MIN_GAP_END - config.ENEMY_MIN_GAP_START) * progress
  );
}

export function enemyMaxDryLevels(y: number): number {
  const progress = enemyProgress(y) ?? 0;

  return Math.round(
    config.ENEMY_MAX_DRY_LEVELS_START +
      (config.ENEMY_MAX_DRY_LEVELS_END - config.ENEMY_MAX_DRY_LEVELS_START) * progress,
  );
}