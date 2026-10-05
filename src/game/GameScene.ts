import Phaser from 'phaser';

const PLAYER_SPEED = 280;
const JUMP_SPEED = 520;

const PLATFORM_WIDTH = 150;
const PLATFORM_HEIGHT = 20;

const PLAYER_SIZE = 38;

const START_Y = 540;

export class GameScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Triangle;

  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private enemies!: Phaser.Physics.Arcade.Group;

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

    const { width, height } = this.scale;

    // Заголовок
    this.add
      .text(width / 2, 20, 'PLATFORM JUMP', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '28px',
        color: '#ffffff',
      })
      .setOrigin(0.5, 0);

    // Управление
    this.add
      .text(
        width / 2,
        58,
        '← → / A D — движение    ↑ / W / SPACE — прыжок',
        {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '16px',
          color: '#cbd5e1',
        },
      )
      .setOrigin(0.5, 0);

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
      .setOrigin(0.5, 0);

    // Счёт
    this.scoreText = this.add.text(24, 24, 'Score: 0', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '22px',
      color: '#ffffff',
    });

    // Статус
    this.statusText = this.add
      .text(width / 2, height / 2, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '32px',
        color: '#ffffff',
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(100);

    this.createPlayer();
    this.createPlatforms();
    this.createEnemies();
    this.createControls();

    // Столкновение игрока с платформами
    this.physics.add.collider(
    this.player,
    this.platforms,
    (_player, platformObject) => {
      const platform = platformObject as Phaser.GameObjects.Rectangle;

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
   * Создание платформ.
   *
   * Большинство платформ обычные.
   * Некоторые имеют специальное свойство "исчезнуть".
   */
  private createPlatforms(): void {
    this.platforms = this.physics.add.staticGroup();

    // Стартовая платформа
    this.addPlatform(120, START_Y, false);

    // Основные платформы
    this.addPlatform(350, 470, false);
    this.addPlatform(600, 390, true);
    this.addPlatform(820, 310, false);

    this.addPlatform(620, 220, true);
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
  }

  /**
   * Создание врагов.
   *
   * Враг — простой круг.
   */
  private createEnemies(): void {
    this.enemies = this.physics.add.group();

    this.addEnemy(470, 430);
    this.addEnemy(760, 270);
    this.addEnemy(500, 120);
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

    // Прыжок.
    const jumpPressed =
      Phaser.Input.Keyboard.JustDown(this.cursors.up) ||
      Phaser.Input.Keyboard.JustDown(this.wasd.up) ||
      Phaser.Input.Keyboard.JustDown(
        this.input.keyboard!.addKey(
          Phaser.Input.Keyboard.KeyCodes.SPACE,
        ),
      );

    if (jumpPressed && body.blocked.down) {
      body.setVelocityY(-JUMP_SPEED);
    }

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
    if (this.player.y > this.scale.height + 80) {
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