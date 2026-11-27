import Phaser from 'phaser';

import * as config from './GameConfig';
import { Enemies } from './enemies';
import { Hud } from './Hud';
import { Platforms } from './Platforms';

export class GameScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Sprite;

  private platforms!: Platforms;
  private enemies!: Enemies;
  private hud!: Hud;

  private background!: Phaser.GameObjects.TileSprite;
  private clouds: { parts: Phaser.GameObjects.Image[]; factor: number }[] = [];

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'left' | 'right', Phaser.Input.Keyboard.Key>;

  private score = 0;
  private gameOver = false;

  private lives = 0;
  private invulnerable = false;
  private blinkTween: Phaser.Tweens.Tween | null = null;

  private isPaused = false;
  private pauseKey!: Phaser.Input.Keyboard.Key;
  private escKey!: Phaser.Input.Keyboard.Key;

  private phase = 1;

  constructor() {
    super('GameScene');
  }

  preload(): void {
    this.load.setPath(config.ASSETS_PATH);

    this.load.spritesheet(config.TILE_SHEET_KEY, 'tilemap_packed.png', {
      frameWidth: config.TILE_SIZE,
      frameHeight: config.TILE_SIZE,
    });
    this.load.spritesheet(config.CHARACTER_SHEET_KEY, 'tilemap-characters_packed.png', {
      frameWidth: config.CHARACTER_SIZE,
      frameHeight: config.CHARACTER_SIZE,
    });
    this.load.spritesheet(config.BACKGROUND_SHEET_KEY, 'tilemap-backgrounds_packed.png', {
      frameWidth: config.BACKGROUND_TILE_SIZE,
      frameHeight: config.BACKGROUND_TILE_SIZE,
    });
  }

  create(): void {
    // пиксельная графика без сглаживания (текст при этом остаётся гладким)
    this.textures.get(config.TILE_SHEET_KEY).setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures.get(config.CHARACTER_SHEET_KEY).setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures.get(config.BACKGROUND_SHEET_KEY).setFilter(Phaser.Textures.FilterMode.NEAREST);

    this.score = 0;
    this.gameOver = false;
    this.isPaused = false;
    this.phase = 1;
    this.lives = config.PLAYER_LIVES;
    this.invulnerable = false;
    this.blinkTween = null;

    this.cameras.main.setScroll(0, 0);
    // спрайты рисуются по целым пикселям, иначе пиксельная графика «дрожит» при движении
    this.cameras.main.setRoundPixels(true);

    const { width, height } = this.scale;

    this.background = this.add
      .tileSprite(0, 0, width, height, config.BACKGROUND_SHEET_KEY, config.BACKGROUND_FRAME)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(-10)
      .setTileScale(config.SPRITE_SCALE);

    this.createClouds(height);

    this.hud = new Hud(this);

    this.createPlayer();
    this.platforms = new Platforms(this);
    this.enemies = new Enemies(this);
    this.createControls();

    // сквозное поведение платформ
    this.physics.add.overlap(
      this.player,
      this.platforms.group,
      (_player, platformObject) => {
        if (this.gameOver) {
          return;
        }
        const platform = platformObject as Phaser.GameObjects.Rectangle;
        const playerBody = this.player.body as Phaser.Physics.Arcade.Body;

        if (playerBody.velocity.y <= 0) {
          return;
        }

        playerBody.setVelocityY(-config.JUMP_SPEED);

        if (platform.getData('used')) {
          return;
        }
        platform.setData('used', true);

        this.score += 1;
        this.hud.updateScore(this.score);

        if (this.phase === 1 && this.score >= config.PHASE_2_SCORE) {
          this.startPhase2();
        }

        if (platform.getData('disappearing')) {
          this.platforms.scheduleDisappear(platform);
        }
      },
      undefined,
      this,
    );

    this.physics.add.overlap(
      this.player,
      this.enemies.group,
      this.hitEnemy,
      undefined,
      this,
    );
  }

  update(): void {
    // обе клавиши читаются всегда, чтобы нажатие не «залипало» до следующего кадра
    const pausePressed = Phaser.Input.Keyboard.JustDown(this.pauseKey);
    const escPressed = Phaser.Input.Keyboard.JustDown(this.escKey);

    if ((pausePressed || escPressed) && !this.gameOver) {
      this.togglePause();
    }

    if (this.isPaused || this.gameOver) {
      return;
    }

    this.handleMovement();
    this.enemies.update();
    this.updateCamera();
    this.background.tilePositionY = this.cameras.main.scrollY * config.BACKGROUND_PARALLAX;
    this.updateClouds();
    this.generatePlatformsAbove();
    this.platforms.removeBelow(this.removeLimitY());
    this.enemies.removeBelow(this.removeLimitY());
    this.checkFall();
  }

  // облака двигаются медленнее платформ (параллакс), поэтому видно, что игрок набирает высоту
  private createClouds(height: number): void {
    this.clouds = [];

    for (let i = 0; i < config.CLOUD_COUNT; i++) {
      const factor = Phaser.Math.FloatBetween(config.CLOUD_PARALLAX_MIN, config.CLOUD_PARALLAX_MAX);
      const frames = [
        config.CLOUD_FRAME_LEFT,
        ...new Array<number>(Phaser.Math.Between(1, 3)).fill(config.CLOUD_FRAME_MIDDLE),
        config.CLOUD_FRAME_RIGHT,
      ];

      const parts = frames.map((frame) =>
        this.add
          .image(0, 0, config.TILE_SHEET_KEY, frame)
          .setOrigin(0, 0)
          .setScale(config.SPRITE_SCALE)
          .setAlpha(config.CLOUD_ALPHA)
          .setDepth(-5)
          .setScrollFactor(0, factor),
      );

      this.placeCloud(parts, Phaser.Math.Between(0, height));
      this.clouds.push({ parts, factor });
    }
  }

  private placeCloud(parts: Phaser.GameObjects.Image[], y: number): void {
    const tileSize = config.TILE_SIZE * config.SPRITE_SCALE;
    const x = Phaser.Math.Between(0, this.scale.width - parts.length * tileSize);

    parts.forEach((part, index) => part.setPosition(x + index * tileSize, y));
  }

  // облако, ушедшее за нижний край экрана, возвращается над верхним краем
  private updateClouds(): void {
    const camera = this.cameras.main;
    const tileSize = config.TILE_SIZE * config.SPRITE_SCALE;

    for (const cloud of this.clouds) {
      const screenY = cloud.parts[0].y - camera.scrollY * cloud.factor;

      if (screenY > camera.height) {
        const aboveTop = camera.scrollY * cloud.factor - tileSize;

        this.placeCloud(cloud.parts, aboveTop - Phaser.Math.Between(0, config.CLOUD_RESPAWN_RANGE));
      }
    }
  }

  private createPlayer(): void {
    this.player = this.add
      .sprite(
        config.PLAYER_START_X,
        config.START_Y - config.PLAYER_SIZE,
        config.CHARACTER_SHEET_KEY,
        config.PLAYER_FRAME,
      )
      .setScale(config.SPRITE_SCALE)
      .setDepth(10);

    this.physics.add.existing(this.player);

    const body = this.player.body as Phaser.Physics.Arcade.Body;

    // размер тела задаётся в пикселях исходного кадра, поэтому делим на масштаб
    body.setSize(
      config.PLAYER_SIZE / config.SPRITE_SCALE,
      config.PLAYER_SIZE / config.SPRITE_SCALE,
    );
    body.setAllowGravity(true);
    body.setCollideWorldBounds(false);
  }

  // генерация новых платформ и спавн врагов на новых уровнях
  private generatePlatformsAbove(): void {
    const spawnLimitY = this.cameras.main.scrollY - config.PLATFORM_SPAWN_MARGIN;
    const spawnedLevels = this.platforms.generateAbove(spawnLimitY, this.phase);

    for (const { levelY, previousLevelY, positions } of spawnedLevels) {
      this.enemies.spawn(levelY, previousLevelY, positions, this.phase);
    }
  }

  private updateCamera(): void {
    const camera = this.cameras.main;

    // позиция берётся из тела: спрайт Phaser подтягивает к телу уже после update(), и камера отставала бы на кадр
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const targetY = body.center.y - camera.height * config.CAMERA_PLAYER_HEIGHT;

    if (targetY < camera.scrollY) {
      camera.scrollY = targetY;
    }
  }

  // граница, ниже которой платформы и враги удаляются
  private removeLimitY(): number {
    const camera = this.cameras.main;

    return camera.scrollY + camera.height + config.PLATFORM_REMOVE_MARGIN;
  }

  private createControls(): void {
    if (!this.input.keyboard) {
      throw new Error('Keyboard input is unavailable.');
    }

    this.cursors = this.input.keyboard.createCursorKeys();

    this.wasd = this.input.keyboard.addKeys({
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    }) as Record<'left' | 'right', Phaser.Input.Keyboard.Key>;

    this.pauseKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P);

    this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
  }

  // движение игрока и прыжки.
  private handleMovement(): void {
    const body = this.player.body as Phaser.Physics.Arcade.Body;

    let direction = 0;
    if (this.cursors.left.isDown || this.wasd.left.isDown) {
      direction = -1;
    }
    if (this.cursors.right.isDown || this.wasd.right.isDown) {
      direction = 1;
    }

    body.setVelocityX(direction * config.PLAYER_SPEED);

    // ограничение выхода за экран
    this.player.x = Phaser.Math.Clamp(
      this.player.x,
      config.PLAYER_SIZE / 2,
      this.scale.width - config.PLAYER_SIZE / 2,
    );
  }

  private checkFall(): void {
    const bottomLimit =
      this.cameras.main.scrollY + this.cameras.main.height + config.FALL_DEATH_MARGIN;

    if (this.player.y > bottomLimit && this.loseLife('ТЫ УПАЛ!')) {
      this.respawnPlayer();

      if (!this.gameOver) {
        this.playRespawnEffect();
      }
    }
  }

  private hitEnemy(): void {
    if (this.invulnerable) {
      return;
    }

    this.loseLife('ТЫ ПОПАЛСЯ!');
    this.playHitEffect();
  }

  private startPhase2(): void {
    this.phase = 2;

    this.time.delayedCall(0, () => {
      const cutoffY = this.cameras.main.scrollY - config.PLATFORM_HEIGHT;
      this.platforms.regenerateAbove(cutoffY);
    });

    this.enemies.speedUpForPhase2();

    this.hud.setStatus('ФАЗА 2');
    this.time.delayedCall(config.PHASE_BANNER_MS, () => {
      if (!this.gameOver) {
        this.hud.setStatus('');
      }
    });
  }

  private togglePause(): void {
    this.isPaused = !this.isPaused;

    if (this.isPaused) {
      this.physics.world.pause();
      this.time.paused = true;
      this.tweens.pauseAll();
    } else {
      this.physics.world.resume();
      this.time.paused = false;
      this.tweens.resumeAll();
    }

    this.hud.setPaused(this.isPaused);
  }

  // возвращает true, если игрок ещё жив
  private loseLife(message: string): boolean {
    this.lives -= 1;
    const lostIndex = this.lives;

    this.hud.updateHearts(this.lives);
    this.hud.popLostHeart(lostIndex);

    if (this.lives <= 0) {
      this.endGame(message);
      return false;
    }

    this.invulnerable = true;
    this.startBlink();

    this.time.delayedCall(config.INVULNERABLE_MS, () => {
      if (this.gameOver) {
        return;
      }
      this.invulnerable = false;
      this.stopBlink();
    });

    return true;
  }

  // удар врага: красный силуэт и тряска экрана
  private playHitEffect(): void {
    this.flashPlayer(config.HIT_FLASH_COLOR, config.HIT_FLASH_MS);
    this.cameras.main.shake(config.HIT_SHAKE_MS, config.HIT_SHAKE_INTENSITY);
  }

  // возвращение после падения: зелёный силуэт и кольцо на месте появления
  private playRespawnEffect(): void {
    this.flashPlayer(config.RESPAWN_FLASH_COLOR, config.RESPAWN_FLASH_MS);

    const ring = this.add
      .circle(this.player.x, this.player.y, config.RESPAWN_RING_RADIUS)
      .setStrokeStyle(config.RESPAWN_RING_WIDTH, config.RESPAWN_FLASH_COLOR)
      .setDepth(9);

    this.tweens.add({
      targets: ring,
      scale: config.RESPAWN_RING_SCALE,
      alpha: 0,
      duration: config.RESPAWN_RING_MS,
      onComplete: () => ring.destroy(),
    });
  }

  // игрок на мгновение закрашивается одним цветом
  private flashPlayer(color: number, durationMs: number): void {
    this.player.setTint(color).setTintMode(Phaser.TintModes.FILL);
    this.time.delayedCall(durationMs, () => this.player.clearTint());
  }

  // пока игрок неуязвим, он мигает
  private startBlink(): void {
    this.stopBlink();

    this.blinkTween = this.tweens.add({
      targets: this.player,
      alpha: config.HIT_BLINK_ALPHA,
      duration: config.HIT_BLINK_MS,
      yoyo: true,
      repeat: -1,
    });
  }

  private stopBlink(): void {
    this.blinkTween?.stop();
    this.blinkTween = null;
    this.player.setAlpha(1);
  }

  // ставит игрока на самую нижнюю видимую платформу
  private respawnPlayer(): void {
    const camera = this.cameras.main;
    const limit = camera.scrollY + camera.height - config.RESPAWN_BOTTOM_MARGIN;
    const target = this.platforms.findRespawnTarget(limit);

    if (target === null) {
      this.endGame('ТЫ УПАЛ!');
      return;
    }

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.reset(
      target.x,
      target.y - config.PLATFORM_HEIGHT / 2 - config.PLAYER_SIZE / 2 - 1,
    );
  }

  private endGame(message: string): void {
    if (this.gameOver) {
      return;
    }
    this.gameOver = true;
    this.stopBlink();

    const resultText =
      `${message}\n\n` +
      `Результат: ${this.score} очков`;

    this.hud.setStatus(resultText);
    this.player.setAlpha(0.5);

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);

    this.time.delayedCall(config.RESTART_DELAY_MS, () => {
      this.scene.restart();
    });
  }
}