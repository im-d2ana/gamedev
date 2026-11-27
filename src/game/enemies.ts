import Phaser from 'phaser';

import * as config from './GameConfig';
import {
  enemyChance,
  enemyMaxDryLevels,
  enemyMinGap,
  maxActiveEnemies,
} from './Difficulty';

export class Enemies {
  readonly group: Phaser.Physics.Arcade.Group;
  private readonly scene: Phaser.Scene;
  private levelsSinceLastSpawn = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.group = scene.physics.add.group();
  }

  spawn(levelY: number, previousLevelY: number, platformXs: number[], phase: number): void {
    const chance = enemyChance(levelY, phase);
    if (chance <= 0 || platformXs.length === 0) {
      return;
    }

    this.levelsSinceLastSpawn += 1;

    if (this.group.getLength() >= maxActiveEnemies(levelY, phase)) {
      return;
    }

    const y = Math.round((levelY + previousLevelY) / 2);
    if (this.hasNearbyEnemy(y, enemyMinGap(levelY))) {
      return;
    }

    const mustSpawn = this.levelsSinceLastSpawn >= enemyMaxDryLevels(levelY);
    if (!mustSpawn && Math.random() >= chance) {
      return;
    }

    const x = this.pickSpawnX(platformXs);
    if (x !== null) {
      this.add(x, y, phase);
      this.levelsSinceLastSpawn = 0;
    }
  }

  // движение врагов туда-обратно в пределах патруля
  update(): void {
    this.group.children.forEach((child: Phaser.GameObjects.GameObject) => {
      const enemy = child as Phaser.GameObjects.Sprite;

      if (!enemy.active) {
        return;
      }

      const body = enemy.body as Phaser.Physics.Arcade.Body;
      const minX = enemy.getData('minX') as number;
      const maxX = enemy.getData('maxX') as number;

      if (enemy.x <= minX) {
        body.setVelocityX(Math.abs(body.velocity.x));
      }
      if (enemy.x >= maxX) {
        body.setVelocityX(-Math.abs(body.velocity.x));
      }
    });
  }

  removeBelow(limitY: number): void {
    const outdated: Phaser.GameObjects.Sprite[] = [];

    for (const child of this.group.children.values()) {
      const enemy = child as Phaser.GameObjects.Sprite;

      if (enemy.y > limitY) {
        outdated.push(enemy);
      }
    }

    outdated.forEach((enemy) => {
      this.group.remove(enemy, true, true);
    });
  }

  // уже существующие враги тоже ускоряются при переходе в фазу 2
  speedUpForPhase2(): void {
    this.group.children.forEach((child: Phaser.GameObjects.GameObject) => {
      const body = (child as Phaser.GameObjects.Sprite).body as Phaser.Physics.Arcade.Body;
      body.setVelocityX(body.velocity.x * config.PHASE_2_ENEMY_SPEED_MULTIPLIER);
    });
  }

  // ставит врага рядом с платформой, чтобы его патруль пересекал подлёт к ней, а не пустой край экрана
  private pickSpawnX(platformXs: number[]): number | null {
    const minOffset = config.PLATFORM_WIDTH / 2 + config.ENEMY_RADIUS;
    const maxOffset = config.PLATFORM_WIDTH / 2 + config.ENEMY_PATROL_RANGE;
    const minX = config.ENEMY_RADIUS;
    const maxX = this.scene.scale.width - config.ENEMY_RADIUS;

    for (let attempt = 0; attempt < config.ENEMY_POSITION_ATTEMPTS; attempt++) {
      const targetX = Phaser.Utils.Array.GetRandom(platformXs);
      const offset = Phaser.Math.Between(minOffset, maxOffset);
      const side = Math.random() < 0.5 ? -1 : 1;

      for (const dir of [side, -side]) {
        const x = targetX + dir * offset;
        if (x >= minX && x <= maxX && !this.blocksLanding(x, platformXs)) {
          return x;
        }
      }
    }

    return null;
  }

  private blocksLanding(x: number, platformXs: number[]): boolean {
    return platformXs.some(
      (platformX) => Math.abs(platformX - x) < config.PLATFORM_WIDTH / 2 + config.ENEMY_RADIUS,
    );
  }

  private hasNearbyEnemy(y: number, minGap: number): boolean {
    for (const child of this.group.children.values()) {
      const enemy = child as Phaser.GameObjects.Sprite;
      if (Math.abs(enemy.y - y) < minGap) {
        return true;
      }
    }

    return false;
  }

  private add(x: number, y: number, phase: number): void {
    const enemy = this.scene.add
      .sprite(x, y, config.CHARACTER_SHEET_KEY, config.ENEMY_FRAME)
      .setScale(config.SPRITE_SCALE)
      .setDepth(5);

    this.group.add(enemy);

    const body = enemy.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    // размер тела задаётся в пикселях исходного кадра, поэтому делим на масштаб
    body.setSize((config.ENEMY_RADIUS * 2) / config.SPRITE_SCALE, (config.ENEMY_RADIUS * 2) / config.SPRITE_SCALE);
    body.setVelocityX(this.speed(phase));

    const minX = Math.max(config.ENEMY_RADIUS, x - config.ENEMY_PATROL_RANGE);
    const maxX = Math.min(this.scene.scale.width - config.ENEMY_RADIUS, x + config.ENEMY_PATROL_RANGE);

    enemy.setData('minX', minX);
    enemy.setData('maxX', maxX);
  }

  private speed(phase: number): number {
    return phase === 2 ? config.ENEMY_SPEED * config.PHASE_2_ENEMY_SPEED_MULTIPLIER : config.ENEMY_SPEED;
  }
}