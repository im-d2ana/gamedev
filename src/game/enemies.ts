import Phaser from 'phaser';

import * as config from './GameConfig';
import { enemyChance } from './difficulty';

export class Enemies {
  readonly group: Phaser.Physics.Arcade.Group;
  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.group = scene.physics.add.group();
  }

  spawn(levelY: number, previousLevelY: number, platformXs: number[], phase: number): void {
    if (Math.random() >= enemyChance(levelY, phase)) {
      return;
    }

    const y = Math.round((levelY + previousLevelY) / 2);

    for (let attempt = 0; attempt < config.ENEMY_POSITION_ATTEMPTS; attempt++) {
      const x = Phaser.Math.Between(config.ENEMY_RADIUS, this.scene.scale.width - config.ENEMY_RADIUS);

      // проверка, чтобы враг не находился прямо над платформой
      const blocksLanding = platformXs.some(
        (platformX) =>
          Math.abs(platformX - x) < config.PLATFORM_WIDTH / 2 + config.ENEMY_RADIUS,
      );

      if (!blocksLanding) {
        this.add(x, y, phase);
        return;
      }
    }
  }

  // движение врагов туда-обратно в пределах патруля
  update(): void {
    this.group.children.forEach((child: Phaser.GameObjects.GameObject) => {
      const enemy = child as Phaser.GameObjects.Arc;

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
    const outdated: Phaser.GameObjects.Arc[] = [];

    for (const child of this.group.children.values()) {
      const enemy = child as Phaser.GameObjects.Arc;

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
      const body = (child as Phaser.GameObjects.Arc).body as Phaser.Physics.Arcade.Body;
      body.setVelocityX(body.velocity.x * config.PHASE_2_ENEMY_SPEED_MULTIPLIER);
    });
  }

  private add(x: number, y: number, phase: number): void {
    const enemy = this.scene.add.circle(x, y, config.ENEMY_RADIUS, 0xef4444);

    this.group.add(enemy);

    const body = enemy.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
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