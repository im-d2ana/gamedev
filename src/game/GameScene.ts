import Phaser from 'phaser';

const PLAYER_SPEED = 280;
const JUMP_SPEED = 520;

const PLATFORM_WIDTH = 150;
const PLATFORM_HEIGHT = 20;

const PLAYER_SIZE = 38;

const START_Y = 540;

// Платформы одного уровня стоят далеко друг от друга,
// чтобы у игрока был выбор маршрута.
const MIN_PLATFORM_SIDE_GAP = 200;

// Небольшой перепад высот внутри одного уровня, чтобы ряд не был плоским.
const PLATFORM_LEVEL_Y_JITTER = 20;

// Горизонтальный шаг между соседними уровнями. Прямо над платформой
// предыдущего уровня новой не бывает, поэтому игроку приходится
// управлять персонажем. MAX — предел одного прыжка.
const MIN_LEVEL_X_SHIFT = 140;
const MAX_LEVEL_X_SHIFT = 240;

// Сколько раз подобрать позицию платформы, прежде чем взять первую попавшуюся.
const LEVEL_POSITION_ATTEMPTS = 100;

// Насколько низ игрока может уйти в платформу, чтобы отскок всё равно сработал.
const PLATFORM_LANDING_TOLERANCE = 24;

const PLATFORM_SPAWN_MARGIN = 300;
const PLATFORM_REMOVE_MARGIN = 200;

const MIN_PLATFORMS_PER_LEVEL = 1;
const MAX_PLATFORMS_PER_LEVEL = 2;

const MIN_LEVEL_GAP = 80;
const MAX_LEVEL_GAP = 130;

// Базовая доля исчезающих платформ и её рост с высотой.
const DISAPPEARING_CHANCE = 0.35;
const DISAPPEARING_CHANCE_MAX = 0.6;

// На сколько пикселей вверх надо подняться, чтобы доля стала максимальной.
const DISAPPEARING_FULL_HEIGHT = 4000;

// Враги начинают появляться только после набора ENEMY_START_HEIGHT,
// дальше их шанс растёт до ENEMY_CHANCE_MAX к ENEMY_FULL_HEIGHT.
const ENEMY_CHANCE = 0.12;
const ENEMY_CHANCE_MAX = 0.35;

const ENEMY_START_HEIGHT = 400;
const ENEMY_FULL_HEIGHT = 4000;

const ENEMY_RADIUS = 16;
const ENEMY_SPEED = 90;

// Половина отрезка, по которому враг ходит туда-сюда.
const ENEMY_PATROL_RANGE = 90;

// Сколько раз подобрать горизонталь врага, чтобы он не висел
// прямо над платформой и не мешал приземляться.
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
    this.highestPlatformX = 0;
    this.previousLevelXs = [];
    
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
    this.removeEnemiesBelow();
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

    // Генерация отсчитывается от самой высокой стартовой платформы.
    this.previousLevelXs = [this.highestPlatformX];
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
      this.highestPlatformX = x;
    }
  }

  /**
   * Генерация платформ по принципу Doodle Jump.
   *
   * Платформы создаются уровнями по 2-3 штуки. Каждая платформа
   * смещена по горизонтали относительно платформ предыдущего уровня:
   * прямо над прежней опорой новой не бывает, поэтому игроку приходится
   * двигаться к новой платформе.
   * Часть платформ исчезает после приземления. Их доля растёт с высотой,
   * но хотя бы одна платформа на уровне всегда остаётся надёжной.
   * Часть уровней получает врага — его шанс тоже растёт с высотой.
   */
  private generatePlatformsAbove(): void {
    const camera = this.cameras.main;
    const spawnLimit = camera.scrollY - PLATFORM_SPAWN_MARGIN;

    while (this.highestPlatformY > spawnLimit) {
      const previousLevelY = this.highestPlatformY;

      const levelY =
        previousLevelY -
        Phaser.Math.Between(MIN_LEVEL_GAP, MAX_LEVEL_GAP);

      const count = Phaser.Math.Between(
        MIN_PLATFORMS_PER_LEVEL,
        MAX_PLATFORMS_PER_LEVEL,
      );

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

  /**
   * Шанс появления врага на уровне растёт с высотой:
   * от ENEMY_CHANCE после ENEMY_START_HEIGHT
   * до ENEMY_CHANCE_MAX после ENEMY_FULL_HEIGHT.
   * Ниже ENEMY_START_HEIGHT врагов нет — игрок осваивает управление.
   */
  private enemyChance(y: number): number {
    const climbed = START_Y - y;

    if (climbed < ENEMY_START_HEIGHT) {
      return 0;
    }

    const progress = Math.min(
      (climbed - ENEMY_START_HEIGHT) /
        (ENEMY_FULL_HEIGHT - ENEMY_START_HEIGHT),
      1,
    );

    return ENEMY_CHANCE + (ENEMY_CHANCE_MAX - ENEMY_CHANCE) * progress;
  }

  /**
   * Ставит врага между уровнем и предыдущим уровнем — на траектории
   * прыжка. Горизонталь подбирается так, чтобы враг не висел над
   * платформой: иначе он перекрыл бы приземление и уровень нельзя
   * было бы пройти.
   */
  private spawnEnemy(
    levelY: number,
    previousLevelY: number,
    platformXs: number[],
  ): void {
    if (Math.random() >= this.enemyChance(levelY)) {
      return;
    }

    const y = Math.round((levelY + previousLevelY) / 2);

    for (let attempt = 0; attempt < ENEMY_POSITION_ATTEMPTS; attempt++) {
      const x = Phaser.Math.Between(
        ENEMY_RADIUS,
        this.scale.width - ENEMY_RADIUS,
      );

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

  /**
   * Горизонтали платформ одного уровня.
   *
   * Каждая позиция отстоит не ближе MIN_LEVEL_X_SHIFT от любой платформы
   * предыдущего уровня (иначе получился бы вертикальный столб, который
   * проходится без управления) и не дальше MAX_LEVEL_X_SHIFT от неё
   * (иначе платформа будет недостижима за один прыжок).
   */
  private levelPositions(count: number): number[] {
    const positions: number[] = [];

    for (
      let attempt = 0;
      positions.length < count && attempt < LEVEL_POSITION_ATTEMPTS;
      attempt++
    ) {
      const x = this.candidateX();

      if (x === null) {
        continue;
      }

      const farFromPrevious =
        this.distanceToPrevious(x) >= MIN_LEVEL_X_SHIFT;

      const farFromSiblings = positions.every(
        (used) => Math.abs(used - x) >= PLATFORM_WIDTH + MIN_PLATFORM_SIDE_GAP,
      );

      if (farFromPrevious && farFromSiblings) {
        positions.push(x);
      }
    }

    // Уровень без платформ пройти нельзя, поэтому оставляем хотя бы одну.
    if (positions.length === 0) {
      positions.push(this.fallbackX());
    }

    this.previousLevelXs = positions;

    return positions;
  }

  /**
   * Запасная горизонталь для случая, когда валидную позицию подобрать
   * не удалось. Берётся вариант, максимально далёкий от платформ
   * предыдущего уровня, — вертикальный столб всё равно не получается.
   */
  private fallbackX(): number {
    let best = this.randomX();
    let bestDistance = -1;

    for (let attempt = 0; attempt < LEVEL_POSITION_ATTEMPTS; attempt++) {
      const x = this.candidateX();

      if (x === null) {
        continue;
      }

      const distance = this.distanceToPrevious(x);

      if (distance >= MIN_LEVEL_X_SHIFT) {
        return x;
      }

      if (distance > bestDistance) {
        bestDistance = distance;
        best = x;
      }
    }

    return best;
  }

  private distanceToPrevious(x: number): number {
    return Math.min(
      ...this.previousLevelXs.map((previous) => Math.abs(previous - x)),
    );
  }

  /**
   * Случайная горизонталь в пределах одного прыжка от платформы
   * предыдущего уровня, но не прямо над ней.
   */
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
    return Phaser.Math.Between(
      PLATFORM_WIDTH / 2,
      this.scale.width - PLATFORM_WIDTH / 2,
    );
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
   * Удаляем врагов, которые остались далеко ниже камеры.
   * Иначе они копились бы и замедляли игру.
   */
  private removeEnemiesBelow(): void {
    const camera = this.cameras.main;

    const removeLimit =
      camera.scrollY + camera.height + PLATFORM_REMOVE_MARGIN;

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

  /**
   * Создание группы врагов.
   *
   * Враги появляются автоматически по мере набора высоты,
   * см. spawnEnemy.
   */
  private createEnemies(): void {
    this.enemies = this.physics.add.group();
  }

  /**
   * Добавляет врага. Враг — круг, который ходит по горизонтальному
   * отрезку туда-сюда.
   */
  private addEnemy(x: number, y: number): void {
    const enemy = this.add.circle(x, y, ENEMY_RADIUS, 0xef4444);

    this.enemies.add(enemy);

    const body = enemy.body as Phaser.Physics.Arcade.Body;

    body.setAllowGravity(false);

    // Направление движения врага.
    body.setVelocityX(ENEMY_SPEED);

    // Отрезок патрулирования не выходит за границы экрана.
    const minX = Math.max(ENEMY_RADIUS, x - ENEMY_PATROL_RANGE);
    const maxX = Math.min(
      this.scale.width - ENEMY_RADIUS,
      x + ENEMY_PATROL_RANGE,
    );

    enemy.setData('minX', minX);
    enemy.setData('maxX', maxX);
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