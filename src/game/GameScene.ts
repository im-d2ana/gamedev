import Phaser from 'phaser';

const PLAYER_SPEED = 280;
const JUMP_SPEED = 520;

const PLATFORM_WIDTH = 150;
const PLATFORM_HEIGHT = 20;

const PLAYER_SIZE = 38;

const START_Y = 540;

// Платформы одного уровня равномерно делят ширину экрана на слоты.
// Это гарантирует, что они далеко друг от друга и у игрока есть выбор.
const MIN_PLATFORM_SIDE_GAP = 100;

// Небольшой перепад высот внутри одного уровня, чтобы ряд не был плоским.
const PLATFORM_LEVEL_Y_JITTER = 20;

// Насколько низ игрока может уйти в платформу, чтобы отскок всё равно сработал.
const PLATFORM_LANDING_TOLERANCE = 24;

const PLATFORM_SPAWN_MARGIN = 300;
const PLATFORM_REMOVE_MARGIN = 200;

const MIN_PLATFORMS_PER_LEVEL = 2;
const MAX_PLATFORMS_PER_LEVEL = 3;

const MIN_LEVEL_GAP = 80;
const MAX_LEVEL_GAP = 130;

// Базовая доля исчезающих платформ и её рост с высотой.
const DISAPPEARING_CHANCE = 0.35;
const DISAPPEARING_CHANCE_MAX = 0.6;

// На сколько пикселей вверх надо подняться, чтобы доля стала максимальной.
const DISAPPEARING_FULL_HEIGHT = 4000;

const CAMERA_PLAYER_HEIGHT = 0.4;

export class GameScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Triangle;

  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private enemies!: Phaser.Physics.Arcade.Group;

  private highestPlatformY = Number.POSITIVE_INFINITY;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<
    'up' | 'down' | 'left' | 'right',
    Phaser.Input.Keyboard.Key
  >;

  private scoreText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;

  private score = 0;
  private gameOver = false;

  private lastPlatformY = START_Y;

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.score = 0;
    this.gameOver = false;
    this.lastPlatformY = START_Y;

    this.highestPlatformY = Number.POSITIVE_INFINITY;
    
    this.cameras.main.setScroll(0, 0);

    const { width, height } = this.scale;

    // Заголовок
    this.add
      .text(width / 2, 20, 'PLATFORM JUMP', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '28px',
        color: '#ffffff',
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0);

    // Управление
    this.add
      .text(
        width / 2,
        58,
        '← → / A D — движение. Игрок отскакивает от платформ сам',
        {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '16px',
          color: '#cbd5e1',
        },
      )
      .setOrigin(0.5, 0)
      .setScrollFactor(0);

    // Цель
    this.add
      .text(
        width / 2,
        82,
        'Прыгай по платформам и набери как можно больше очков!',
        {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '16px',
          color: '#94a3b8',
        },
      )
      .setOrigin(0.5, 0)
      .setScrollFactor(0);

    // Счёт
    this.scoreText = this.add.text(24, 24, 'Score: 0', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '22px',
      color: '#ffffff',
    })
    .setScrollFactor(0);

    // Статус
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

    this.createPlayer();
    this.createPlatforms();
    this.createEnemies();
    this.createControls();

    // Платформы как в Doodle Jump: проходимые.
    // Игрок не сталкивается с ними физически, а при падении сверху
    // получает отскок.
    this.physics.add.overlap(
      this.player,
      this.platforms,
      (_player, platformObject) => {
        const platform = platformObject as Phaser.GameObjects.Rectangle;
        const playerBody = this.player.body as Phaser.Physics.Arcade.Body;

        // Отскок возможен только когда игрок падает вниз.
        if (playerBody.velocity.y <= 0) {
          return;
        }

        // Игрок должен только что коснуться платформы сверху,
        // а не пролетать сквозь неё.
        const platformTop = platform.y - PLATFORM_HEIGHT / 2;

        if (playerBody.bottom > platformTop + PLATFORM_LANDING_TOLERANCE) {
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

    // Столкновение игрока с врагами
    this.physics.add.overlap(
      this.player,
      this.enemies,
      this.hitEnemy,
      undefined,
      this,
    );
  }

  update(): void {
    if (this.gameOver) {
      return;
    }

    this.handleMovement();
    this.updateEnemies();
    this.updateCamera();
    this.generatePlatformsAbove();
    this.removePlatformsBelow();
    this.checkFall();
    this.checkJumpScore();
  }

  /**
   * Создание игрока.
   *
   * Игрок представлен треугольником.
   */
  private createPlayer(): void {
    this.player = this.add.triangle(
      120,
      START_Y - PLAYER_SIZE,
      0,
      PLAYER_SIZE,
      PLAYER_SIZE,
      PLAYER_SIZE,
      PLAYER_SIZE / 2,
      0,
      0x38bdf8,
    );

    this.physics.add.existing(this.player);

    const body = this.player.body as Phaser.Physics.Arcade.Body;

    body.setSize(PLAYER_SIZE, PLAYER_SIZE);
    body.setAllowGravity(true);
    body.setCollideWorldBounds(false);
  }

  /**
   * Создание начальных платформ.
   *
   * Остальные платформы будут появляться автоматически.
   */
  private createPlatforms(): void {
    this.platforms = this.physics.add.staticGroup();

    // Стартовая платформа
    this.addPlatform(120, START_Y, false);

    // Основные платформы
    this.addPlatform(350, 470, false);
    this.addPlatform(600, 390, false);
    this.addPlatform(820, 310, false);

    this.addPlatform(620, 220, false);
    this.addPlatform(350, 160, false);

    this.addPlatform(700, 100, true);
  }

  /**
   * Добавляет прямоугольную платформу.
   */
  private addPlatform(
    x: number,
    y: number,
    disappearing: boolean,
  ): void {
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

    // Сохраняем информацию о платформе.
    platform.setData('disappearing', disappearing);
    platform.setData('used', false);

    if (y < this.highestPlatformY) {
      this.highestPlatformY = y;
    }
  }

  /**
   * Генерация платформ по принципу Doodle Jump.
   *
   * Платформы создаются уровнями. Платформы одного уровня делят ширину
   * экрана на равные слоты, поэтому всегда далеко друг от друга —
   * игрок выбирает маршрут. Внутри уровня платформы чуть различаются
   * по высоте.
   * Часть платформ исчезает после приземления. Их доля растёт с высотой,
   * но хотя бы одна платформа на уровне всегда остаётся надёжной.
   */
  private generatePlatformsAbove(): void {
    const camera = this.cameras.main;
    const spawnLimit = camera.scrollY - PLATFORM_SPAWN_MARGIN;

    while (this.highestPlatformY > spawnLimit) {
      const levelY =
        this.highestPlatformY -
        Phaser.Math.Between(MIN_LEVEL_GAP, MAX_LEVEL_GAP);

      const count = Phaser.Math.Between(
        MIN_PLATFORMS_PER_LEVEL,
        MAX_PLATFORMS_PER_LEVEL,
      );

      const slotWidth = this.scale.width / count;

      // Насколько можно сдвинуть платформу внутри слота,
      // сохранив зазор MIN_PLATFORM_SIDE_GAP между краями.
      const jitter = Math.floor(
        (slotWidth - PLATFORM_WIDTH - MIN_PLATFORM_SIDE_GAP) / 2,
      );

      const chance = this.disappearingChance(levelY);

      const disappearingSlots = this.pickDisappearingSlots(count, chance);

      for (let slot = 0; slot < count; slot++) {
        const offset = jitter > 0 ? Phaser.Math.Between(-jitter, jitter) : 0;

        const x = slotWidth * (slot + 0.5) + offset;

        const y =
          levelY + Phaser.Math.Between(-PLATFORM_LEVEL_Y_JITTER, 0);

        this.addPlatform(x, y, disappearingSlots.has(slot));
      }
    }
  }

  /**
   * Доля исчезающих платформ растёт с высотой:
   * от DISAPPEARING_CHANCE внизу до DISAPPEARING_CHANCE_MAX вверху.
   */
  private disappearingChance(y: number): number {
    const climbed = Math.max(0, START_Y - y);

    const progress = Math.min(climbed / DISAPPEARING_FULL_HEIGHT, 1);

    return (
      DISAPPEARING_CHANCE +
      (DISAPPEARING_CHANCE_MAX - DISAPPEARING_CHANCE) * progress
    );
  }

  /**
   * Выбирает номера платформ уровня, которые исчезнут.
   * Если по случайности исчезли все, одна платформа остаётся надёжной —
   * иначе уровень невозможно пройти.
   */
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

  /**
   * Камера поднимается, когда игрок достигает верхней части экрана.
   * Вниз камера не движется.
   */
  private updateCamera(): void {
    const camera = this.cameras.main;

    const targetY =
      this.player.y - camera.height * CAMERA_PLAYER_HEIGHT;

    if (targetY < camera.scrollY) {
      camera.scrollY = targetY;
    }
  }

  /**
   * Удаляем платформы, которые остались далеко ниже камеры.
   */
  private removePlatformsBelow(): void {
    const camera = this.cameras.main;

    const removeLimit =
      camera.scrollY + camera.height + PLATFORM_REMOVE_MARGIN;

    this.platforms.getChildren().forEach((child) => {
      const platform = child as Phaser.GameObjects.Rectangle;

      if (platform.y > removeLimit) {
        this.platforms.remove(platform, true, true);
      }
    });
  }

  /**
   * Создание врагов.
   *
   * Враг — простой круг.
   */
  private createEnemies(): void {
    this.enemies = this.physics.add.group();

    // this.addEnemy(470, 430);
    // // this.addEnemy(760, 270);
    // this.addEnemy(500, 120);
  }

  private addEnemy(x: number, y: number): void {
    const enemy = this.add.circle(x, y, 16, 0xef4444);

    this.enemies.add(enemy);

    const body = enemy.body as Phaser.Physics.Arcade.Body;

    body.setAllowGravity(false);

    // Направление движения врага.
    body.setVelocityX(100);

    enemy.setData('minX', x - 100);
    enemy.setData('maxX', x + 100);
  }

  /**
   * Управление.
   */
  private createControls(): void {
    if (!this.input.keyboard) {
      throw new Error('Keyboard input is unavailable.');
    }

    this.cursors = this.input.keyboard.createCursorKeys();

    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    }) as Record<
      'up' | 'down' | 'left' | 'right',
      Phaser.Input.Keyboard.Key
    >;
  }

  /**
   * Основное действие игры:
   * движение игрока и прыжки.
   */
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

    // Прыжок не нужен: игрок отскакивает от платформ сам
    // (см. коллайдер в create).

    // Ограничение движения по горизонтали.
    this.player.x = Phaser.Math.Clamp(
      this.player.x,
      PLAYER_SIZE / 2,
      this.scale.width - PLAYER_SIZE / 2,
    );
  }

  /**
   * Проверяем падение игрока.
   */
  private checkFall(): void {
    const bottomLimit = this.cameras.main.scrollY + this.cameras.main.height + 80;

    if (this.player.y > bottomLimit) {
      this.endGame('ТЫ УПАЛ!');
    }
  }

  /**
   * Проверяем столкновение с врагом.
   */
  private hitEnemy(): void {
    this.endGame('ТЫ ПОПАЛСЯ!');
  }

  /**
   * Движение врагов.
   */
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

  /**
   * Конец игры и автоматический перезапуск.
   */
  private endGame(message: string): void {
    if (this.gameOver) {
      return;
    }

    this.gameOver = true;

    const resultText =
      `${message}\n\n` +
      `Результат: ${this.score} очков\n\n` +
      `Новая игра через 1.5 сек...`;

    this.statusText.setText(resultText);

    this.player.setAlpha(0.5);

    const body = this.player.body as Phaser.Physics.Arcade.Body;

    body.setVelocity(0, 0);

    this.time.delayedCall(1500, () => {
      this.scene.restart();
    });
  }

  /**
   * Дополнительная проверка:
   * если игрок движется достаточно высоко,
   * создаём ощущение продвижения по уровню.
   */
  private checkJumpScore(): void {
    if (this.player.y < this.lastPlatformY - 80) {
      this.score += 1;

      this.scoreText.setText(`Score: ${this.score}`);

      this.lastPlatformY = this.player.y;
    }
  }
}