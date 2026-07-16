// FILE: CollectibleCoin.ts (Simplified back to its original purpose)
import { CameraPinchZoom } from './CameraPinchZoom';
import { _decorator, Component, Node, Sprite, Button, director, Vec3, AudioSource, tween } from 'cc';

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

    protected onLoad() {
        this.spriteComponent = this.getComponent(Sprite);
        this.buttonComponent = this.getComponent(Button);
        this.originalScale.set(this.node.scale);

        if (this.buttonComponent) {
            this.buttonComponent.node.on(Button.EventType.CLICK, this.onCoinClicked, this);
        }
    }
// Inside CollectibleCoin.ts (the function called when the node is clicked)
 
    // Import CameraPinchZoom
public onCoinTapped() {
    // Check if the camera script is currently zooming or dragging
    // if (CameraPinchZoom.IsBusy) {
    //     return; // EXIT and do nothing
    // }

    // Normal logic to collect the coin below...
    // this.onCollectionStart(); 
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
// Inside CollectibleCoin.ts

public onItemTap() {
    // Immediate check of the Static Flag from Camera script
    // if (CameraPinchZoom.IsBusy) {
    //     console.log("Item click cancelled by CameraPinchZoom activity.");
    //     return; 
    // }

    // Proceed to collection
    director.emit(COLLECT_COIN_EVENT, this.node, );
}
    public resetCoin() {
        this.isCollected = false;
        this.node.active = true;
        this.node.setScale(this.originalScale);
        if (this.buttonComponent) {
            this.buttonComponent.interactable = true;
        }
    }
}