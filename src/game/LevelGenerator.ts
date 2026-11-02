import Phaser from 'phaser';

import * as config from './GameConfig';

export class LevelGenerator {
  private readonly width: number;
  private previousLevelXs: number[] = [];

  constructor(width: number) {
    this.width = width;
  }

  // X платформ предыдущего уровня, от которых считается сдвиг
  reset(previousXs: number[] = []): void {
    this.previousLevelXs = previousXs;
  }

  // выбор координат платформ одного уровня
  nextPositions(count: number): number[] {
    const positions: number[] = [];

    for (let attempt = 0; positions.length < count && attempt < config.LEVEL_POSITION_ATTEMPTS; attempt++) {
      const x = this.candidateX();

      if (x === null) {
        continue;
      }

      const farFromPrevious = this.distanceToPrevious(x) >= config.MIN_LEVEL_X_SHIFT;

      const farFromSiblings = positions.every(
        (used) => Math.abs(used - x) >= config.PLATFORM_WIDTH + config.MIN_PLATFORM_SIDE_GAP,
      );

      if (farFromPrevious && farFromSiblings) {
        positions.push(x);
      }
    }

    this.previousLevelXs = positions;

    return positions;
  }

  private distanceToPrevious(x: number): number {
    return Math.min(
      ...this.previousLevelXs.map((previous) => Math.abs(previous - x)),
    );
  }

  private candidateX(): number | null {
    if (this.previousLevelXs.length === 0) {
      return this.randomX();
    }

    const anchor = Phaser.Utils.Array.GetRandom(this.previousLevelXs);
    const shift = Phaser.Math.Between(config.MIN_LEVEL_X_SHIFT, config.MAX_LEVEL_X_SHIFT);

    const options = [anchor - shift, anchor + shift].filter(
      (x) => x >= config.PLATFORM_WIDTH / 2 && x <= this.width - config.PLATFORM_WIDTH / 2,
    );

    if (options.length === 0) {
      return null;
    }

    return Phaser.Utils.Array.GetRandom(options);
  }

  private randomX(): number {
    return Phaser.Math.Between(config.PLATFORM_WIDTH / 2, this.width - config.PLATFORM_WIDTH / 2);
  }
}

export function pickDisappearingSlots(count: number, chance: number): Set<number> {
  const slots = new Set<number>();

  for (let slot = 0; slot < count; slot++) {
    if (Math.random() < chance) {
      slots.add(slot);
    }
  }

  // хотя бы одна платформа уровня всегда остаётся постоянной
  if (slots.size === count) {
    slots.delete(Phaser.Math.Between(0, count - 1));
  }

  return slots;
}