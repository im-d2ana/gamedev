import Phaser from 'phaser';
import * as config from './GameConfig';

export class Hud {
  private readonly scene: Phaser.Scene;
  private scoreDigits: Phaser.GameObjects.Image[] = [];
  private hearts: Phaser.GameObjects.Image[] = [];
  private readonly statusText: Phaser.GameObjects.Text;
  private readonly pauseOverlay: Phaser.GameObjects.Rectangle;
  private readonly pauseText: Phaser.GameObjects.Text;
  private readonly pauseHint: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const { width, height } = scene.scale;

    scene.add
      .text(width / 2, 20, '← → или A D — движение | P или Esc — пауза', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#e2e8f0',
        stroke: config.HUD_STROKE_COLOR,
        strokeThickness: config.HUD_STROKE_THICKNESS,
      })
      .setOrigin(0.5, 0)
      .setDepth(100)
      .setScrollFactor(0);

    scene.add
      .text(width / 2, 44, 'Двигайся влево-вправо и попадай на платформы!', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#e2e8f0',
        stroke: config.HUD_STROKE_COLOR,
        strokeThickness: config.HUD_STROKE_THICKNESS,
      })
      .setOrigin(0.5, 0)
      .setDepth(100)
      .setScrollFactor(0);

    this.updateScore(0);
    this.createHearts(width);

    this.statusText = scene.add
      .text(width / 2, height / 2, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '32px',
        color: '#ffffff',
        stroke: config.HUD_STROKE_COLOR,
        strokeThickness: config.HUD_STROKE_THICKNESS,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(100)
      .setScrollFactor(0);

    this.pauseOverlay = scene.add
      .rectangle(
        width / 2,
        height / 2,
        width,
        height,
        config.PAUSE_OVERLAY_COLOR,
        config.PAUSE_OVERLAY_ALPHA,
      )
      .setDepth(190)
      .setScrollFactor(0)
      .setVisible(false);

    this.pauseText = scene.add
      .text(width / 2, height / 2 - 20, 'ПАУЗА', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '56px',
        color: '#ffffff',
        stroke: config.HUD_STROKE_COLOR,
        strokeThickness: config.PAUSE_TITLE_STROKE_THICKNESS,
      })
      .setOrigin(0.5)
      .setDepth(200)
      .setScrollFactor(0)
      .setVisible(false);

    this.pauseHint = scene.add
      .text(width / 2, height / 2 + 40, 'P или Esc — продолжить', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '20px',
        color: '#e2e8f0',
        stroke: config.HUD_STROKE_COLOR,
        strokeThickness: config.HUD_STROKE_THICKNESS,
      })
      .setOrigin(0.5)
      .setDepth(200)
      .setScrollFactor(0)
      .setVisible(false);
  }

  updateScore(score: number): void {
    const digits = String(score);
    const step = config.TILE_SIZE * config.SPRITE_SCALE;

    while (this.scoreDigits.length < digits.length) {
      const digit = this.scene.add
        .image(
          config.HUD_MARGIN + this.scoreDigits.length * step,
          config.HUD_MARGIN,
          config.TILE_SHEET_KEY,
          config.DIGIT_FIRST_FRAME,
        )
        .setOrigin(0, 0)
        .setScale(config.SPRITE_SCALE)
        .setDepth(100)
        .setScrollFactor(0);

      this.scoreDigits.push(digit);
    }

    digits.split('').forEach((char, index) => {
      this.scoreDigits[index].setFrame(config.DIGIT_FIRST_FRAME + Number(char));
    });
  }

  updateHearts(lives: number): void {
    this.hearts.forEach((heart, index) => {
      heart.setFrame(index < lives ? config.HEART_FULL_FRAME : config.HEART_EMPTY_FRAME);
    });
  }

  // при любой потере жизни потерянное сердце на мгновение увеличивается
  popLostHeart(lostIndex: number): void {
    const lostHeart = this.hearts[lostIndex];
    if (lostHeart) {
      this.scene.tweens.add({
        targets: lostHeart,
        scale: config.SPRITE_SCALE * config.HEART_POP_SCALE,
        duration: config.HEART_POP_MS,
        yoyo: true,
      });
    }
  }

  setStatus(text: string): void {
    this.statusText.setText(text);
  }

  setPaused(paused: boolean): void {
    this.pauseOverlay.setVisible(paused);
    this.pauseText.setVisible(paused);
    this.pauseHint.setVisible(paused);
  }

  private createHearts(width: number): void {
    const size = config.TILE_SIZE * config.SPRITE_SCALE;
    const total = config.PLAYER_LIVES * size + (config.PLAYER_LIVES - 1) * config.HEART_GAP;
    const startX = width - config.HUD_MARGIN - total;

    this.hearts = [];

    for (let index = 0; index < config.PLAYER_LIVES; index++) {
      const heart = this.scene.add
        .image(
          startX + index * (size + config.HEART_GAP) + size / 2,
          config.HUD_MARGIN + size / 2,
          config.TILE_SHEET_KEY,
          config.HEART_FULL_FRAME,
        )
        .setScale(config.SPRITE_SCALE)
        .setDepth(100)
        .setScrollFactor(0);

      this.hearts.push(heart);
    }
  }
}