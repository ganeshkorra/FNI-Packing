// FILE: CollectibleCoin.ts
import { _decorator, Component, Node, Sprite, Button, director, Vec3, AudioSource, tween, v3 } from 'cc';

const { ccclass, property } = _decorator;

export const COLLECT_COIN_EVENT = 'collect-coin';

@ccclass('CollectibleCoin')
export class CollectibleCoin extends Component {

    @property({ type: AudioSource })
    public collectSound: AudioSource | null = null;
    

    private isCollected: boolean = false;
    private spriteComponent: Sprite | null = null;
    private buttonComponent: Button | null = null;
    private originalScale: Vec3 = new Vec3();
    private originalPosition: Vec3 = new Vec3();

    protected onLoad() {
        this.spriteComponent = this.getComponent(Sprite);
        this.buttonComponent = this.getComponent(Button);
        this.originalScale.set(this.node.scale);
        this.originalPosition.set(this.node.position);

        if (this.buttonComponent) {
            this.buttonComponent.node.on(Button.EventType.CLICK, this.onCoinClicked, this);
        }
    }
    private onCoinClicked() {
        if (this.isCollected) return;

        if (this.buttonComponent) {
            this.buttonComponent.interactable = false;
        }
        if (this.collectSound) {
            this.collectSound.play();
        }
        if (this.spriteComponent && this.spriteComponent.spriteFrame) {
            director.emit(COLLECT_COIN_EVENT, this.node, this.spriteComponent.spriteFrame, this.node.worldPosition);
        }
    }
    
    public onCollectionStart() {
        this.isCollected = true;
        this.node.active = false;
    }

    public shakeIncorrectTarget() {
        if (this.isCollected) return;

        tween(this.node).stop();
        this.node.setPosition(this.originalPosition);

        const shakeOffset = 10;
        const startPos = this.originalPosition.clone();

        tween(this.node)
            .to(0.04, { position: v3(startPos.x + shakeOffset, startPos.y, startPos.z) }, { easing: 'quadOut' })
            .to(0.04, { position: v3(startPos.x - shakeOffset, startPos.y, startPos.z) }, { easing: 'quadInOut' })
            .to(0.04, { position: v3(startPos.x + shakeOffset * 0.6, startPos.y, startPos.z) }, { easing: 'quadInOut' })
            .to(0.04, { position: startPos }, { easing: 'backOut' })
            .call(() => {
                this.node.setPosition(this.originalPosition);
                if (this.buttonComponent) {
                    this.buttonComponent.interactable = true;
                }
            })
            .start();
    }

    public resetCoin() {
        this.isCollected = false;
        this.node.active = true;
        this.node.setScale(this.originalScale);
        this.node.setPosition(this.originalPosition);
        if (this.buttonComponent) {
            this.buttonComponent.interactable = true;
        }
    }
}
