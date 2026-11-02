import * as config from './GameConfig';

export function disappearingChance(y: number, phase: number): number {
  const climbed = Math.max(0, config.START_Y - y);

  const progress = Math.min(climbed / config.DISAPPEARING_FULL_HEIGHT, 1);

  const chance =
    config.DISAPPEARING_CHANCE +
    (config.DISAPPEARING_CHANCE_MAX - config.DISAPPEARING_CHANCE) * progress;

  return phase === 2 ? chance + config.PHASE_2_DISAPPEARING_CHANCE_BONUS : chance;
}

export function enemyChance(y: number, phase: number): number {
  const climbed = config.START_Y - y;

  if (climbed < config.ENEMY_START_HEIGHT) {
    return 0;
  }

  const progress = Math.min(
    (climbed - config.ENEMY_START_HEIGHT) / (config.ENEMY_FULL_HEIGHT - config.ENEMY_START_HEIGHT),
    1,
  );

  const chance = config.ENEMY_CHANCE + (config.ENEMY_CHANCE_MAX - config.ENEMY_CHANCE) * progress;

  return phase === 2
    ? Math.min(chance * config.PHASE_2_ENEMY_CHANCE_MULTIPLIER, 1)
    : chance;
}