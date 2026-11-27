import Phaser from 'phaser';
import * as config from './GameConfig';
import { disappearingChance } from './Difficulty';
import { LevelGenerator, pickDisappearingSlots } from './LevelGenerator';

export interface SpawnedLevel {
  levelY: number;
  previousLevelY: number;
  positions: number[];
}

export class Platforms {
  readonly group: Phaser.Physics.Arcade.StaticGroup;
  private readonly scene: Phaser.Scene;
  private readonly levelGenerator: LevelGenerator;
  private highestPlatformY = Number.POSITIVE_INFINITY;
  private highestPlatformX = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.group = scene.physics.add.staticGroup();
    this.levelGenerator = new LevelGenerator(scene.scale.width);
    this.createInitial();
  }

  // генерация новых платформ выше указанной границы
  generateAbove(spawnLimitY: number, phase: number): SpawnedLevel[] {
    const spawned: SpawnedLevel[] = [];

    while (this.highestPlatformY > spawnLimitY) {
      const previousLevelY = this.highestPlatformY;
      const levelY = previousLevelY - Phaser.Math.Between(config.MIN_LEVEL_GAP, config.MAX_LEVEL_GAP);
      const count = Phaser.Math.Between(config.MIN_PLATFORMS_PER_LEVEL, config.MAX_PLATFORMS_PER_LEVEL);

      const positions = this.levelGenerator.nextPositions(count);
      const chance = disappearingChance(levelY, phase);
      const disappearing = pickDisappearingSlots(positions.length, chance);

      positions.forEach((x, index) => {
        const y = levelY + Phaser.Math.Between(-config.PLATFORM_LEVEL_Y_JITTER, 0);
        this.add(x, y, disappearing.has(index));
      });

      spawned.push({ levelY, previousLevelY, positions });
    }

    return spawned;
  }

  removeBelow(limitY: number): void {
    this.group.getChildren().slice().forEach((child) => {
      const platform = child as Phaser.GameObjects.Rectangle;
      if (platform.y > limitY) {
        this.group.remove(platform, true, true);
      }
    });
  }

  // платформы выше экрана создавались по правилам фазы 1, поэтому при смене фазы генерируем их заново
  regenerateAbove(cutoffY: number): void {
    this.group.getChildren().slice().forEach((child) => {
      const platform = child as Phaser.GameObjects.Rectangle;
      if (platform.y < cutoffY) {
        this.group.remove(platform, true, true);
      }
    });

    const remaining = this.group.getChildren() as Phaser.GameObjects.Rectangle[];
    if (remaining.length === 0) {
      return;
    }

    // самая верхняя из оставшихся платформ снова становится точкой, от которой идёт генерация
    const topY = Math.min(...remaining.map((platform) => platform.y));
    const topLevelXs = remaining
      .filter((platform) => platform.y - topY <= config.PLATFORM_LEVEL_Y_JITTER)
      .map((platform) => platform.x);

    this.highestPlatformY = topY;
    this.highestPlatformX = topLevelXs[0];
    this.levelGenerator.reset(topLevelXs);
  }

  scheduleDisappear(platform: Phaser.GameObjects.Rectangle): void {
    const tiles = this.platformTiles(platform);
    const middle = (tiles.length - 1) / 2;

    // в момент прыжка тайлы слегка разъезжаются, проседают и дрожат — видно, что опора треснула
    tiles.forEach((tile, index) => {
      const offsetIndex = index - middle;
      const baseX = tile.x + offsetIndex * config.DISAPPEARING_CRACK_GAP;
      tile
        .setPosition(baseX, tile.y + config.DISAPPEARING_CRACK_SAG)
        .setAngle(offsetIndex * 4)
        .setAlpha(0.85);

      this.scene.tweens.add({
        targets: tile,
        x: baseX + config.DISAPPEARING_SHAKE_OFFSET,
        duration: config.DISAPPEARING_SHAKE_MS,
        yoyo: true,
        repeat: -1,
      });
    });

    this.scene.time.delayedCall(config.DISAPPEARING_PLATFORM_DELAY_MS, () => {
      if (!platform.active || !platform.getData('disappearing')) {
        return;
      }

      platform.setVisible(false);
      const body = platform.body as Phaser.Physics.Arcade.StaticBody;
      body.enable = false;

      this.playBreakEffect(tiles);
    });
  }

  // ищет самую нижнюю видимую платформу не ниже порога и при необходимости делает её постоянной
  findRespawnTarget(maxY: number): Phaser.GameObjects.Rectangle | null {
    let target: Phaser.GameObjects.Rectangle | null = null;

    for (const child of this.group.getChildren()) {
      const platform = child as Phaser.GameObjects.Rectangle;
      const body = platform.body as Phaser.Physics.Arcade.StaticBody;

      if (!platform.visible || !body.enable || platform.y > maxY) {
        continue;
      }

      if (target === null || platform.y > target.y) {
        target = platform;
      }
    }

    if (target !== null) {
      this.makePermanent(target);
    }

    return target;
  }

  private playBreakEffect(tiles: Phaser.GameObjects.Image[]): void {
    this.scene.tweens.killTweensOf(tiles);

    const middle = (tiles.length - 1) / 2;
    tiles.forEach((tile, index) => {
      const offsetIndex = index - middle;
      this.scene.tweens.add({
        targets: tile,
        x: tile.x + offsetIndex * config.DISAPPEARING_BREAK_SPREAD,
        y: tile.y + config.DISAPPEARING_BREAK_DROP + (offsetIndex === 0 ? 16 : 0),
        angle: offsetIndex * config.DISAPPEARING_BREAK_ANGLE,
        alpha: 0,
        duration: config.DISAPPEARING_BREAK_MS,
        ease: 'Quad.easeIn',
        onComplete: () => tile.setVisible(false),
      });
    });
  }

  private makePermanent(platform: Phaser.GameObjects.Rectangle): void {
    if (!platform.getData('disappearing')) {
      return;
    }

    platform.setData('disappearing', false);

    const tiles = this.platformTiles(platform);
    this.scene.tweens.killTweensOf(tiles);

    const tileSize = config.TILE_SIZE * config.SPRITE_SCALE;
    const left = platform.x - config.PLATFORM_WIDTH / 2 + tileSize / 2;
    const top = platform.y - config.PLATFORM_HEIGHT / 2 + tileSize / 2;

    tiles.forEach((tile, index) => {
      tile
        .setPosition(left + index * tileSize, top)
        .setAngle(0)
        .setAlpha(1)
        .setVisible(true)
        .setFrame(config.PLATFORM_FRAMES[index]);
    });
  }

  private createInitial(): void {
    for (const [x, y] of config.START_PLATFORMS) {
      this.add(x, y, false);
    }

    this.levelGenerator.reset([this.highestPlatformX]);
  }

  private add(x: number, y: number, disappearing: boolean): void {
    // прозрачный прямоугольник отвечает за физику, картинка рисуется из тайлов отдельно
    const platform = this.scene.add.rectangle(
      x,
      y,
      config.PLATFORM_WIDTH,
      config.PLATFORM_HEIGHT,
      0x000000,
      0,
    );

    this.group.add(platform);

    const body = platform.body as Phaser.Physics.Arcade.StaticBody;
    body.updateFromGameObject();

    platform.setData('disappearing', disappearing);
    platform.setData('used', false);
    platform.setData('tiles', this.createPlatformTiles(platform, disappearing));

    // обновление самой высокой платформы
    if (y < this.highestPlatformY) {
      this.highestPlatformY = y;
      this.highestPlatformX = x;
    }
  }

  // картинка платформы: ряд тайлов, верхний край совпадает с верхом физического тела
  private createPlatformTiles(
    platform: Phaser.GameObjects.Rectangle,
    disappearing: boolean,
  ): Phaser.GameObjects.Image[] {
    const frames = disappearing ? config.DISAPPEARING_PLATFORM_FRAMES : config.PLATFORM_FRAMES;
    const tileSize = config.TILE_SIZE * config.SPRITE_SCALE;
    const left = platform.x - config.PLATFORM_WIDTH / 2 + tileSize / 2;
    const top = platform.y - config.PLATFORM_HEIGHT / 2 + tileSize / 2;

    const tiles = frames.map((frame, index) =>
      this.scene.add
        .image(left + index * tileSize, top, config.TILE_SHEET_KEY, frame)
        .setOrigin(0.5, 0.5)
        .setScale(config.SPRITE_SCALE),
    );

    // когда платформа удаляется, вместе с ней удаляется и её картинка
    platform.once(Phaser.GameObjects.Events.DESTROY, () => {
      this.scene.tweens.killTweensOf(tiles);
      tiles.forEach((tile) => tile.destroy());
    });

    return tiles;
  }

  private platformTiles(platform: Phaser.GameObjects.Rectangle): Phaser.GameObjects.Image[] {
    return platform.getData('tiles') as Phaser.GameObjects.Image[];
  }
}