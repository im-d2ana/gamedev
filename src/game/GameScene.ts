import Phaser from 'phaser';

import * as config from './GameConfig';
import { disappearingChance, enemyChance } from './difficulty';

export class GameScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Triangle;

  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private enemies!: Phaser.Physics.Arcade.Group;

  private highestPlatformY = Number.POSITIVE_INFINITY;

  private highestPlatformX = 0;

  private previousLevelXs: number[] = [];

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<
    'left' | 'right',
    Phaser.Input.Keyboard.Key
  >;

  private scoreText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;

  private score = 0;
  private gameOver = false;

  private isPaused = false;
  private pauseText!: Phaser.GameObjects.Text;
  private pauseKey!: Phaser.Input.Keyboard.Key;

  private phase = 1;

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.score = 0;
    this.gameOver = false;
    this.phase = 1;

    this.highestPlatformY = Number.POSITIVE_INFINITY;
    this.highestPlatformX = 0;
    this.previousLevelXs = [];
    
    this.cameras.main.setScroll(0, 0);

    const { width, height } = this.scale;

    this.add
      .text(width / 2, 20, 'PLATFORM JUMP', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '28px',
        color: '#ffffff',
      })
      .setOrigin(0.5, 0)
      .setDepth(100)
      .setScrollFactor(0);

    this.add
      .text(width / 2, 58, '← → / A D — движение, P - паузу', {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '16px',
          color: '#cbd5e1',
      })
      .setOrigin(0.5, 0)
      .setDepth(100)
      .setScrollFactor(0);

    this.add
      .text(width / 2, 82, 'Прыгай по платформам и набери как можно больше очков!', {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '16px',
          color: '#94a3b8',
      })
      .setOrigin(0.5, 0)
      .setDepth(100)
      .setScrollFactor(0);

    this.scoreText = this.add.text(24, 24, 'Score: 0', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '22px',
      color: '#ffffff',
    })
    .setScrollFactor(0);

    this.statusText = this.add
      .text(width / 2, height / 2, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '32px',
        color: '#ffffff',
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(100)
      .setScrollFactor(0);

    this.pauseText = this.add
      .text(width / 2, height / 2, 'ПАУЗА', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '36px',
        color: '#ffffff',
        align: 'center',
        backgroundColor: '#0f172a',
        padding: { x: 20, y: 12 },
      })
      .setOrigin(0.5)
      .setDepth(200)
      .setScrollFactor(0)
      .setVisible(false);

    this.createPlayer();
    this.createPlatforms();
    this.createEnemies();
    this.createControls();

    // сквозное поведение платформ
    this.physics.add.overlap(
      this.player,
      this.platforms,
      (_player, platformObject) => {
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
        this.scoreText.setText(`Score: ${this.score}`);

        if (this.phase === 1 && this.score >= config.PHASE_2_SCORE) {
          this.startPhase2();
        }

        if (platform.getData('disappearing')) {
          this.time.delayedCall(500, () => {
            if (!platform.active) {
              return;
            }

            platform.setVisible(false);
            const body = platform.body as Phaser.Physics.Arcade.StaticBody;
            body.enable = false;
          });
        }
      },
      undefined,
      this,
    );

    this.physics.add.overlap(
      this.player,
      this.enemies,
      this.hitEnemy,
      undefined,
      this,
    );
  }

  update(): void {
    if (
      Phaser.Input.Keyboard.JustDown(this.pauseKey) &&
      !this.gameOver
    ) {
      this.togglePause();
    }

    if (this.isPaused || this.gameOver) {
      return;
    }

    this.handleMovement();
    this.updateEnemies();
    this.updateCamera();
    this.generatePlatformsAbove();
    this.removePlatformsBelow();
    this.removeEnemiesBelow();
    this.checkFall();
  }

  private createPlayer(): void {
    this.player = this.add.triangle(
      120, config.START_Y - config.PLAYER_SIZE,
      0, config.PLAYER_SIZE,
      config.PLAYER_SIZE, config.PLAYER_SIZE,
      config.PLAYER_SIZE / 2, 0,
      0x38bdf8,
    );

    this.physics.add.existing(this.player);

    const body = this.player.body as Phaser.Physics.Arcade.Body;

    body.setSize(config.PLAYER_SIZE, config.PLAYER_SIZE);
    body.setAllowGravity(true);
    body.setCollideWorldBounds(false);
  }

  private createPlatforms(): void {
    this.platforms = this.physics.add.staticGroup();

    this.addPlatform(120, config.START_Y, false);
    this.addPlatform(350, 470, false);
    this.addPlatform(600, 390, false);
    this.addPlatform(820, 310, false);
    this.addPlatform(620, 220, false);
    this.addPlatform(350, 160, false);
    this.addPlatform(700, 100, true);

    this.previousLevelXs = [this.highestPlatformX];
  }

  private addPlatform(x: number, y: number, disappearing: boolean): void {
    const color = disappearing ? 0xf97316 : 0x22c55e;

    const platform = this.add.rectangle(
      x,
      y,
      config.PLATFORM_WIDTH,
      config.PLATFORM_HEIGHT,
      color,
    );

    this.platforms.add(platform);

    const body = platform.body as Phaser.Physics.Arcade.StaticBody;
    body.updateFromGameObject();

    platform.setData('disappearing', disappearing);
    platform.setData('used', false);

    // обновление самой высокой платформы
    if (y < this.highestPlatformY) {
      this.highestPlatformY = y;
      this.highestPlatformX = x;
    }
  }

  // генерация новых платформ
  private generatePlatformsAbove(): void {
    const camera = this.cameras.main;
    const spawnLimit = camera.scrollY - config.PLATFORM_SPAWN_MARGIN;

    while (this.highestPlatformY > spawnLimit) {
      const previousLevelY = this.highestPlatformY;

      const levelY = previousLevelY - Phaser.Math.Between(config.MIN_LEVEL_GAP, config.MAX_LEVEL_GAP);
      const count = Phaser.Math.Between(config.MIN_PLATFORMS_PER_LEVEL, config.MAX_PLATFORMS_PER_LEVEL);

      const positions = this.levelPositions(count);

      const chance = disappearingChance(levelY, this.phase);
      const disappearing = this.pickDisappearingSlots(positions.length, chance);

      positions.forEach((x, index) => {
        const y = levelY + Phaser.Math.Between(-config.PLATFORM_LEVEL_Y_JITTER, 0);

        this.addPlatform(x, y, disappearing.has(index));
      });

      this.spawnEnemy(levelY, previousLevelY, positions);
    }
  }

  private spawnEnemy(levelY: number, previousLevelY: number, platformXs: number[]): void {
    if (Math.random() >= enemyChance(levelY, this.phase)) {
      return;
    }

    const y = Math.round((levelY + previousLevelY) / 2);

    for (let attempt = 0; attempt < config.ENEMY_POSITION_ATTEMPTS; attempt++) {
      const x = Phaser.Math.Between(config.ENEMY_RADIUS, this.scale.width - config.ENEMY_RADIUS);

      // проверка, чтобы враг не находился прямо над платформой
      const blocksLanding = platformXs.some(
        (platformX) =>
          Math.abs(platformX - x) < config.PLATFORM_WIDTH / 2 + config.ENEMY_RADIUS,
      );

      if (!blocksLanding) {
        this.addEnemy(x, y);
        return;
      }
    }
  }

  // выбор координат платформ одного уровня
  private levelPositions(count: number): number[] {
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
      (x) => x >= config.PLATFORM_WIDTH / 2 && x <= this.scale.width - config.PLATFORM_WIDTH / 2,
    );

    if (options.length === 0) {
      return null;
    }

    return Phaser.Utils.Array.GetRandom(options);
  }

  private randomX(): number {
    return Phaser.Math.Between(config.PLATFORM_WIDTH / 2, this.scale.width - config.PLATFORM_WIDTH / 2);
  }

  private pickDisappearingSlots(count: number, chance: number): Set<number> {
    const slots = new Set<number>();

    for (let slot = 0; slot < count; slot++) {
      if (Math.random() < chance) {
        slots.add(slot);
      }
    }

    if (slots.size === count) {
      slots.delete(Phaser.Math.Between(0, count - 1));
    }

    return slots;
  }

  private updateCamera(): void {
    const camera = this.cameras.main;

    const targetY = this.player.y - camera.height * config.CAMERA_PLAYER_HEIGHT;

    if (targetY < camera.scrollY) {
      camera.scrollY = targetY;
    }
  }

  // граница, ниже которой платформы и враги удаляются
  private removeLimitY(): number {
    const camera = this.cameras.main;

    return camera.scrollY + camera.height + config.PLATFORM_REMOVE_MARGIN;
  }

  private removePlatformsBelow(): void {
    const removeLimit = this.removeLimitY();

    this.platforms.getChildren().forEach((child) => {
      const platform = child as Phaser.GameObjects.Rectangle;

      if (platform.y > removeLimit) {
        this.platforms.remove(platform, true, true);
      }
    });
  }

  private removeEnemiesBelow(): void {
    const removeLimit = this.removeLimitY();

    const outdated: Phaser.GameObjects.Arc[] = [];

    for (const child of this.enemies.children.values()) {
      const enemy = child as Phaser.GameObjects.Arc;

      if (enemy.y > removeLimit) {
        outdated.push(enemy);
      }
    }

    outdated.forEach((enemy) => {
      this.enemies.remove(enemy, true, true);
    });
  }

  // cоздание группы врагов
  private createEnemies(): void {
    this.enemies = this.physics.add.group();
  }

  private addEnemy(x: number, y: number): void {
    const enemy = this.add.circle(x, y, config.ENEMY_RADIUS, 0xef4444);

    this.enemies.add(enemy);

    const body = enemy.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setVelocityX(this.enemySpeed());

    const minX = Math.max(config.ENEMY_RADIUS, x - config.ENEMY_PATROL_RANGE);
    const maxX = Math.min(this.scale.width - config.ENEMY_RADIUS, x + config.ENEMY_PATROL_RANGE);

    enemy.setData('minX', minX);
    enemy.setData('maxX', maxX);
  }

  private createControls(): void {
    if (!this.input.keyboard) {
      throw new Error('Keyboard input is unavailable.');
    }

    this.cursors = this.input.keyboard.createCursorKeys();

    this.wasd = this.input.keyboard.addKeys({
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    }) as Record<
      'left' | 'right',
      Phaser.Input.Keyboard.Key
    >;

    this.pauseKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.P
    );
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
    const bottomLimit = this.cameras.main.scrollY + this.cameras.main.height + 80;

    if (this.player.y > bottomLimit) {
      this.endGame('ТЫ УПАЛ!');
    }
  }

  private hitEnemy(): void {
    this.endGame('ТЫ ПОПАЛСЯ!');
  }

  // движение врагов
  private updateEnemies(): void {
    this.enemies.children.forEach((child: Phaser.GameObjects.GameObject) => {
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

  private startPhase2(): void {
    this.phase = 2;

    // уже существующие враги тоже ускоряются
    this.enemies.children.forEach((child: Phaser.GameObjects.GameObject) => {
      const body = (child as Phaser.GameObjects.Arc).body as Phaser.Physics.Arcade.Body;
      body.setVelocityX(body.velocity.x * config.PHASE_2_ENEMY_SPEED_MULTIPLIER);
    });

    this.statusText.setText('ФАЗА 2');
    this.time.delayedCall(config.PHASE_BANNER_MS, () => {
      if (!this.gameOver) {
        this.statusText.setText('');
      }
    });
  }

  private enemySpeed(): number {
    return this.phase === 2 ? config.ENEMY_SPEED * config.PHASE_2_ENEMY_SPEED_MULTIPLIER : config.ENEMY_SPEED;
  }

  private togglePause(): void {
    this.isPaused = !this.isPaused;

    if (this.isPaused) {
      this.physics.world.pause();
      this.time.paused = true;
      this.pauseText.setVisible(true);
    } else {
      this.physics.world.resume();
      this.time.paused = false;
      this.pauseText.setVisible(false);
    }
  }

  private endGame(message: string): void {
    if (this.gameOver) {
      return;
    }
    this.gameOver = true;

    const resultText =
      `${message}\n\n` +
      `Результат: ${this.score} очков`;

    this.statusText.setText(resultText);
    this.player.setAlpha(0.5);

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);

    this.time.delayedCall(1500, () => {
      this.scene.restart();
    });
  }
}