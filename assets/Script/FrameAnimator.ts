// FILE: /assets/Scripts/FrameAnimator.ts

import { _decorator, Component, Sprite, SpriteFrame, CCInteger } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('FrameAnimator')
export class FrameAnimator extends Component {
    @property({ type: [SpriteFrame], tooltip: "Drag sequence here" })
    public spriteFrames: SpriteFrame[] = [];

    @property({ type: CCInteger })
    public fps: number = 12;

    @property
    public loop: boolean = true;

    @property
    public playOnLoad: boolean = true; // <--- Set this to FALSE in Editor

    private sprite: Sprite = null;
    private timer: number = 0;
    private currentFrameIndex: number = 0;
    private isPlaying: boolean = false;
    private timePerFrame: number = 0;

    onLoad() {
        this.sprite = this.getComponent(Sprite);
        if (!this.sprite) this.sprite = this.addComponent(Sprite);
        
        if (this.fps > 0) this.timePerFrame = 1 / this.fps;
    }

    start() {
        // --- KEY LOGIC UPDATE ---
        // If we are NOT auto-playing, show the first frame so it isn't empty/invisible
        if (!this.playOnLoad && this.spriteFrames.length > 0) {
            this.sprite.spriteFrame = this.spriteFrames[0];
        }

        if (this.playOnLoad) {
            this.play();
        }
    }

    public play() {
        if (this.spriteFrames.length === 0) return;
        this.isPlaying = true;
        this.currentFrameIndex = 0;
        this.timer = 0;
        // Immediately verify frame
        this.sprite.spriteFrame = this.spriteFrames[0]; 
    }

    public stop() {
        this.isPlaying = false;
    }

    update(dt: number) {
        if (!this.isPlaying || this.spriteFrames.length === 0) return;

        this.timer += dt;
        if (this.timer >= this.timePerFrame) {
            this.timer -= this.timePerFrame;
            this.currentFrameIndex++;
            if (this.currentFrameIndex >= this.spriteFrames.length) {
                if (this.loop) this.currentFrameIndex = 0;
                else {
                    this.currentFrameIndex = this.spriteFrames.length - 1;
                    this.isPlaying = false;
                    return;
                }
            }
            this.sprite.spriteFrame = this.spriteFrames[this.currentFrameIndex];
        }
    }
}