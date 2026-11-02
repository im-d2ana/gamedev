import Phaser from 'phaser';

import * as config from './GameConfig';
import { disappearingChance } from './difficulty';
import { Enemies } from './enemies';
import { LevelGenerator, pickDisappearingSlots } from './LevelGenerator';

export class GameScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Triangle;

  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private enemies!: Enemies;

  private highestPlatformY = Number.POSITIVE_INFINITY;

  private highestPlatformX = 0;

  private levelGenerator!: LevelGenerator;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<
    'left' | 'right',
    Phaser.Input.Keyboard.Key
  >;

  private scoreText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;

  private score = 0;
  private gameOver = false;

  private lives = 0;
  private invulnerable = false;
  private livesText!: Phaser.GameObjects.Text;

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
    this.isPaused = false;
    this.phase = 1;
    this.lives = config.PLAYER_LIVES;
    this.invulnerable = false;

    this.highestPlatformY = Number.POSITIVE_INFINITY;
    this.highestPlatformX = 0;
    
    this.cameras.main.setScroll(0, 0);

    const { width, height } = this.scale;
    this.levelGenerator = new LevelGenerator(width);

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
      .text(width / 2, 58, '← → или A D — движение   |   P — пауза', {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '16px',
          color: '#cbd5e1',
      })
      .setOrigin(0.5, 0)
      .setDepth(100)
      .setScrollFactor(0);

    this.add
      .text(width / 2, 82, 'Прыжок автоматический: двигайся влево-вправо и попадай на платформы!', {
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

    this.livesText = this.add
      .text(24, 54, `Lives: ${this.lives}`, {
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
    this.enemies = new Enemies(this);
    this.createControls();

    // сквозное поведение платформ
    this.physics.add.overlap(
      this.player,
      this.platforms,
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
      this.enemies.group,
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
    this.enemies.update();
    this.updateCamera();
    this.generatePlatformsAbove();
    this.removePlatformsBelow();
    this.enemies.removeBelow(this.removeLimitY());
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
    this.addPlatform(700, 100, false);

    this.levelGenerator.reset([this.highestPlatformX]);
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

      const positions = this.levelGenerator.nextPositions(count);

      const chance = disappearingChance(levelY, this.phase);
      const disappearing = pickDisappearingSlots(positions.length, chance);

      positions.forEach((x, index) => {
        const y = levelY + Phaser.Math.Between(-config.PLATFORM_LEVEL_Y_JITTER, 0);

        this.addPlatform(x, y, disappearing.has(index));
      });

      this.enemies.spawn(levelY, previousLevelY, positions, this.phase);
    }
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

  // платформы выше экрана создавались по правилам фазы 1, поэтому при смене фазы генерируем их заново
  private regenerateLevelsAbove(): void {
    const cutoff = this.cameras.main.scrollY - config.PLATFORM_HEIGHT;

    this.platforms.getChildren().slice().forEach((child) => {
      const platform = child as Phaser.GameObjects.Rectangle;

      if (platform.y < cutoff) {
        this.platforms.remove(platform, true, true);
      }
    });

    // самая верхняя из оставшихся платформ снова становится точкой, от которой идёт генерация
    const remaining = this.platforms.getChildren() as Phaser.GameObjects.Rectangle[];
    const topY = Math.min(...remaining.map((platform) => platform.y));
    const topLevelXs = remaining
      .filter((platform) => platform.y - topY <= config.PLATFORM_LEVEL_Y_JITTER)
      .map((platform) => platform.x);

    this.highestPlatformY = topY;
    this.highestPlatformX = topLevelXs[0];
    this.levelGenerator.reset(topLevelXs);
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

    if (this.player.y > bottomLimit && this.loseLife('ТЫ УПАЛ!')) {
      this.respawnPlayer();
    }
  }

  private hitEnemy(): void {
    if (this.invulnerable) {
      return;
    }

    this.loseLife('ТЫ ПОПАЛСЯ!');
  }

  private startPhase2(): void {
    this.phase = 2;

    this.time.delayedCall(0, () => this.regenerateLevelsAbove());

    this.enemies.speedUpForPhase2();

    this.statusText.setText('ФАЗА 2');
    this.time.delayedCall(config.PHASE_BANNER_MS, () => {
      if (!this.gameOver) {
        this.statusText.setText('');
      }
    });
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

    // возвращает true, если игрок ещё жив
  private loseLife(message: string): boolean {
    this.lives -= 1;
    this.livesText.setText(`Lives: ${Math.max(this.lives, 0)}`);

    if (this.lives <= 0) {
      this.endGame(message);
      return false;
    }

    this.invulnerable = true;
    this.player.setAlpha(0.5);

    this.time.delayedCall(config.INVULNERABLE_MS, () => {
      if (this.gameOver) {
        return;
      }
      this.invulnerable = false;
      this.player.setAlpha(1);
    });

    return true;
  }

  // ставит игрока на самую нижнюю видимую платформу
  private respawnPlayer(): void {
    const camera = this.cameras.main;
    const limit = camera.scrollY + camera.height - config.RESPAWN_BOTTOM_MARGIN;

    let target: Phaser.GameObjects.Rectangle | null = null;

    for (const child of this.platforms.getChildren()) {
      const platform = child as Phaser.GameObjects.Rectangle;
      const body = platform.body as Phaser.Physics.Arcade.StaticBody;

      if (!platform.visible || !body.enable || platform.y > limit) {
        continue;
      }

      if (target === null || platform.y > target.y) {
        target = platform;
      }
    }

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