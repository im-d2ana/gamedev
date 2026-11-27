import Phaser from 'phaser';

import * as config from './GameConfig';

const PAIR_LAYOUT_ATTEMPTS = 10;

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

  // выбор координат платформ одного уровня без тупиковых веток
  nextPositions(count: number): number[] {
    if (this.previousLevelXs.length === 0) {
      return this.fillPositions([], count);
    }

    // если прошлых платформ несколько, а нужна одна — пробуем поставить общую связующую платформу
    if (count === 1 && this.previousLevelXs.length > 1) {
      const bridgeX = this.findBridgeX();
      if (bridgeX !== null) {
        this.previousLevelXs = [bridgeX];
        return [bridgeX];
      }
    }

    const positions = this.buildReachablePositions(count);

    // страховка от пустого уровня, чтобы генератор не зациклился
    if (positions.length === 0) {
      positions.push(this.fallbackX());
    }

    this.previousLevelXs = positions;

    return positions;
  }

  private buildReachablePositions(count: number): number[] {
    let best: number[] = [];

    for (let retry = 0; retry < PAIR_LAYOUT_ATTEMPTS; retry++) {
      const attemptPositions: number[] = [];
      const anchors = Phaser.Utils.Array.Shuffle([...this.previousLevelXs]);

      for (const anchor of anchors) {
        const x = this.pickReachableFrom(anchor, attemptPositions, this.minSiblingDistance());
        if (x !== null) {
          attemptPositions.push(x);
        }
      }

      if (attemptPositions.length > best.length) {
        best = attemptPositions;
      }

      if (attemptPositions.length === this.previousLevelXs.length) {
        break;
      }
    }

    if (best.length < this.previousLevelXs.length) {
      for (const anchor of this.previousLevelXs) {
        const alreadyCovered = best.some(
          (x) => Math.abs(x - anchor) <= config.MAX_LEVEL_X_SHIFT,
        );
        if (alreadyCovered) {
          continue;
        }
        const x = this.pickReachableFrom(anchor, best, config.PLATFORM_WIDTH);
        if (x !== null) {
          best.push(x);
        }
      }
    }

    return this.fillPositions(best, count);
  }

  private fillPositions(positions: number[], targetCount: number): number[] {
    for (
      let attempt = 0;
      positions.length < targetCount && attempt < config.LEVEL_POSITION_ATTEMPTS;
      attempt++
    ) {
      const x = this.candidateX();
      if (x === null) {
        continue;
      }

      if (this.isFarFromPrevious(x) && this.isFarFromSiblings(x, positions, this.minSiblingDistance())) {
        positions.push(x);
      }
    }

    return positions;
  }

  private findBridgeX(): number | null {
    const minReach = Math.ceil(
      Math.max(this.minX(), ...this.previousLevelXs.map((p) => p - config.MAX_LEVEL_X_SHIFT)),
    );
    const maxReach = Math.floor(
      Math.min(this.maxX(), ...this.previousLevelXs.map((p) => p + config.MAX_LEVEL_X_SHIFT)),
    );

    if (minReach > maxReach) {
      return null;
    }

    for (let attempt = 0; attempt < config.LEVEL_POSITION_ATTEMPTS; attempt++) {
      const x = Phaser.Math.Between(minReach, maxReach);
      if (this.isFarFromPrevious(x)) {
        return x;
      }
    }

    return null;
  }

  private pickReachableFrom(
    anchor: number,
    siblings: number[],
    minSiblingDist: number,
  ): number | null {
    for (let attempt = 0; attempt < config.LEVEL_POSITION_ATTEMPTS; attempt++) {
      const x = this.shiftedX(anchor);
      if (x === null) {
        continue;
      }

      if (this.isFarFromPrevious(x) && this.isFarFromSiblings(x, siblings, minSiblingDist)) {
        return x;
      }
    }

    return null;
  }

  private isFarFromPrevious(x: number): boolean {
    if (this.previousLevelXs.length === 0) {
      return true;
    }

    return this.distanceToPrevious(x) >= config.MIN_LEVEL_X_SHIFT;
  }

  private isFarFromSiblings(x: number, siblings: number[], minDistance: number): boolean {
    return siblings.every((used) => Math.abs(used - x) >= minDistance);
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
    return this.shiftedX(anchor);
  }

  private shiftedX(anchor: number): number | null {
    const shift = Phaser.Math.Between(config.MIN_LEVEL_X_SHIFT, config.MAX_LEVEL_X_SHIFT);
    const options = [anchor - shift, anchor + shift].filter(
      (x) => x >= this.minX() && x <= this.maxX(),
    );

    if (options.length === 0) {
      return null;
    }

    return Phaser.Utils.Array.GetRandom(options);
  }

  private fallbackX(): number {
    const anchor = this.previousLevelXs[0];
    if (anchor === undefined) {
      return this.randomX();
    }

    const towardCenter = anchor < this.width / 2 ? anchor + config.MIN_LEVEL_X_SHIFT : anchor - config.MIN_LEVEL_X_SHIFT;
    return Phaser.Math.Clamp(towardCenter, this.minX(), this.maxX());
  }

  private minSiblingDistance(): number {
    return config.PLATFORM_WIDTH + config.MIN_PLATFORM_SIDE_GAP;
  }

  private minX(): number {
    return config.PLATFORM_WIDTH / 2;
  }

  private maxX(): number {
    return this.width - config.PLATFORM_WIDTH / 2;
  }

  private randomX(): number {
    return Phaser.Math.Between(this.minX(), this.maxX());
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