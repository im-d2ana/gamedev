import Phaser from 'phaser';

const PLAYER_SPEED = 280;
const JUMP_SPEED = 520;

const PLATFORM_WIDTH = 150;
const PLATFORM_HEIGHT = 20;

const PLAYER_SIZE = 38;

const START_Y = 540;

const MIN_PLATFORM_SIDE_GAP = 200;
const PLATFORM_LEVEL_Y_JITTER = 20;

const MIN_LEVEL_X_SHIFT = 140;
const MAX_LEVEL_X_SHIFT = 240;

const LEVEL_POSITION_ATTEMPTS = 100;

const PLATFORM_SPAWN_MARGIN = 300;
const PLATFORM_REMOVE_MARGIN = 200;

const MIN_PLATFORMS_PER_LEVEL = 1;
const MAX_PLATFORMS_PER_LEVEL = 2;

const MIN_LEVEL_GAP = 80;
const MAX_LEVEL_GAP = 130;

const DISAPPEARING_CHANCE = 0.35;
const DISAPPEARING_CHANCE_MAX = 0.6;
const DISAPPEARING_FULL_HEIGHT = 4000;

const ENEMY_CHANCE = 0.12;
const ENEMY_CHANCE_MAX = 0.35;

const ENEMY_START_HEIGHT = 400;
const ENEMY_FULL_HEIGHT = 4000;

const ENEMY_RADIUS = 16;
const ENEMY_SPEED = 90;

const ENEMY_PATROL_RANGE = 90;
const ENEMY_POSITION_ATTEMPTS = 40;

const CAMERA_PLAYER_HEIGHT = 0.4;

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

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.score = 0;
    this.gameOver = false;

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

        playerBody.setVelocityY(-JUMP_SPEED);

        if (platform.getData('used')) {
          return;
        }
        platform.setData('used', true);

        this.score += 1;
        this.scoreText.setText(`Score: ${this.score}`);

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
      120, START_Y - PLAYER_SIZE,
      0, PLAYER_SIZE,
      PLAYER_SIZE, PLAYER_SIZE,
      PLAYER_SIZE / 2, 0,
      0x38bdf8,
    );

    this.physics.add.existing(this.player);

    const body = this.player.body as Phaser.Physics.Arcade.Body;

    body.setSize(PLAYER_SIZE, PLAYER_SIZE);
    body.setAllowGravity(true);
    body.setCollideWorldBounds(false);
  }

  private createPlatforms(): void {
    this.platforms = this.physics.add.staticGroup();

    this.addPlatform(120, START_Y, false);
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
      PLATFORM_WIDTH,
      PLATFORM_HEIGHT,
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
    const spawnLimit = camera.scrollY - PLATFORM_SPAWN_MARGIN;

    while (this.highestPlatformY > spawnLimit) {
      const previousLevelY = this.highestPlatformY;

      const levelY = previousLevelY - Phaser.Math.Between(MIN_LEVEL_GAP, MAX_LEVEL_GAP);
      const count = Phaser.Math.Between(MIN_PLATFORMS_PER_LEVEL, MAX_PLATFORMS_PER_LEVEL);

      const positions = this.levelPositions(count);

      const chance = this.disappearingChance(levelY);
      const disappearing = this.pickDisappearingSlots(positions.length, chance);

      positions.forEach((x, index) => {
        const y = levelY + Phaser.Math.Between(-PLATFORM_LEVEL_Y_JITTER, 0);

        this.addPlatform(x, y, disappearing.has(index));
      });

      this.spawnEnemy(levelY, previousLevelY, positions);
    }
  }

  private enemyChance(y: number): number {
    const climbed = START_Y - y;

    if (climbed < ENEMY_START_HEIGHT) {
      return 0;
    }

    const progress = Math.min((climbed - ENEMY_START_HEIGHT) / (ENEMY_FULL_HEIGHT - ENEMY_START_HEIGHT), 1);

    return ENEMY_CHANCE + (ENEMY_CHANCE_MAX - ENEMY_CHANCE) * progress;
  }

  private spawnEnemy(levelY: number, previousLevelY: number, platformXs: number[]): void {
    if (Math.random() >= this.enemyChance(levelY)) {
      return;
    }

    const y = Math.round((levelY + previousLevelY) / 2);

    for (let attempt = 0; attempt < ENEMY_POSITION_ATTEMPTS; attempt++) {
      const x = Phaser.Math.Between(ENEMY_RADIUS, this.scale.width - ENEMY_RADIUS);

      // проверка, чтобы враг не находился прямо над платформой
      const blocksLanding = platformXs.some(
        (platformX) =>
          Math.abs(platformX - x) < PLATFORM_WIDTH / 2 + ENEMY_RADIUS,
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

    for (let attempt = 0; positions.length < count && attempt < LEVEL_POSITION_ATTEMPTS; attempt++) {
      const x = this.candidateX();

      if (x === null) {
        continue;
      }

      const farFromPrevious = this.distanceToPrevious(x) >= MIN_LEVEL_X_SHIFT;

      const farFromSiblings = positions.every(
        (used) => Math.abs(used - x) >= PLATFORM_WIDTH + MIN_PLATFORM_SIDE_GAP,
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
    const shift = Phaser.Math.Between(MIN_LEVEL_X_SHIFT, MAX_LEVEL_X_SHIFT);

    const options = [anchor - shift, anchor + shift].filter(
      (x) => x >= PLATFORM_WIDTH / 2 && x <= this.scale.width - PLATFORM_WIDTH / 2,
    );

    if (options.length === 0) {
      return null;
    }

    return Phaser.Utils.Array.GetRandom(options);
  }

  private randomX(): number {
    return Phaser.Math.Between(PLATFORM_WIDTH / 2, this.scale.width - PLATFORM_WIDTH / 2);
  }

  private disappearingChance(y: number): number {
    const climbed = Math.max(0, START_Y - y);

    const progress = Math.min(climbed / DISAPPEARING_FULL_HEIGHT, 1);

    return (
      DISAPPEARING_CHANCE + (DISAPPEARING_CHANCE_MAX - DISAPPEARING_CHANCE) * progress
    );
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

    const targetY = this.player.y - camera.height * CAMERA_PLAYER_HEIGHT;

    if (targetY < camera.scrollY) {
      camera.scrollY = targetY;
    }
  }

  private removePlatformsBelow(): void {
    const camera = this.cameras.main;

    const removeLimit = camera.scrollY + camera.height + PLATFORM_REMOVE_MARGIN;

    this.platforms.getChildren().forEach((child) => {
      const platform = child as Phaser.GameObjects.Rectangle;

      if (platform.y > removeLimit) {
        this.platforms.remove(platform, true, true);
      }
    });
  }

  private removeEnemiesBelow(): void {
    const camera = this.cameras.main;

    const removeLimit = camera.scrollY + camera.height + PLATFORM_REMOVE_MARGIN;

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
    const enemy = this.add.circle(x, y, ENEMY_RADIUS, 0xef4444);

    this.enemies.add(enemy);

    const body = enemy.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setVelocityX(ENEMY_SPEED);

    const minX = Math.max(ENEMY_RADIUS, x - ENEMY_PATROL_RANGE);
    const maxX = Math.min(this.scale.width - ENEMY_RADIUS, x + ENEMY_PATROL_RANGE);

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

    body.setVelocityX(direction * PLAYER_SPEED);

    // ограничение выхода за экран
    this.player.x = Phaser.Math.Clamp(
      this.player.x,
      PLAYER_SIZE / 2,
      this.scale.width - PLAYER_SIZE / 2,
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