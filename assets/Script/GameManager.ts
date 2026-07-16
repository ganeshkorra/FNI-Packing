// FILE: GameManager.ts (Final Version with 3-Second Hold)

import { _decorator, Component, Node, director, ProgressBar, Label, Button, tween, Vec3, UIOpacity, SpriteFrame, Sprite, UITransform, v3, Tween, AudioSource } from 'cc';
import { CollectibleCoin, COLLECT_COIN_EVENT } from './CollectibleCoin';
import { CollectionContainer, CONTAINER_COMPLETE_EVENT } from './CollectionContainer';
import { CameraPinchZoom } from './CameraPinchZoom';

declare const mraid: any;
const { ccclass, property } = _decorator;

@ccclass('GameManager')
export class GameManager extends Component {

    @property({ type: [CollectionContainer] })
    public collectionContainers: CollectionContainer[] = [];
    @property({ type: ProgressBar })
    public mainProgressBar: ProgressBar | null = null;
    @property({ type: Node })
    public instructionText: Node | null = null;
    @property({ type: Label })
    public timerLabel: Label | null = null;
    @property({ type: Node })
    public allCollectibleItems: Node[] = [];
    @property({ type: Node })
    public endScreenPanel: Node | null = null;
    @property({ type: Button })
    public ctaButton: Button | null = null;
    @property({ type: Node })
    public endScreenIcon: Node | null = null;
    @property({ type: Node })
    public handNode: Node | null = null;
    @property({ type: SpriteFrame })
    public idleHandSprite: SpriteFrame | null = null;
    @property({ type: SpriteFrame })
    public clickHandSprite: SpriteFrame | null = null;
    @property({ type: Node })
    public tutorialTargetCoin: Node | null = null;
    @property({ type: Number })
    public tutorialHandScale: number = 3.0;
    @property({ type: Vec3 })
    public tutorialHandOffset: Vec3 = v3(-20, 30, 0);
    @property({ type: AudioSource, tooltip: "The background music." })
    public backgroundMusic: AudioSource | null = null;
    @property({ type: AudioSource, tooltip: "The sound for tapping a collectible." })
    public tapSound: AudioSource | null = null;
    @property({ type: Number })
    public gameDuration: number = 60.0;
    @property({ type: Number })
    public hintInterval: number = 5.0;

    @property({ type: Node, tooltip: "The simple full-screen dark overlay node." })
    public highlightOverlay: Node | null = null;
    @property({ type: Node, tooltip: "The sprite node that glows behind the hint coin." })
    public tutorialHintGlow: Node | null = null;
    @property({ type: Node, tooltip: "The duplicate coin sprite that appears on top of the overlay." })
    public tutorialHintCoin: Node | null = null;

    @property({ type: Node, tooltip: "The parent node for the luck level UI." })
    public luckLevelPanel: Node | null = null;
    @property({ type: Label, tooltip: "The label that displays the luck percentage." })
    public luckLevelLabel: Label | null = null;
    @property({ type: ProgressBar, tooltip: "The progress bar for the luck level." })
    public luckLevelProgressBar: ProgressBar | null = null;
    @property({ type: Node, tooltip: "Instruction text for zooming" })
    public zoomInstructionText: Node | null = null;
    @property(Node)
    ZoomAnim: Node = null;
@property({ type: Number, tooltip: "The gap between container panels" })
public containerSpacing: number = 220;
@property({ type: Vec3, tooltip: "The starting position of the first container" })
public containerStartPos: Vec3 = v3(-220, 0, 0)

    private _zoomGuideActive: boolean = false;

    private _hasShownZoomHint: boolean = false;




    private isGameStarted: boolean = false;
    private isGameOver: boolean = false;
    private currentTime: number = 0;
    private idleTimer: number = 0;
    private uncollectedCoins: Node[] = [];
    private completedContainers: number = 0;
    private totalContainers: number = 0;
    private handTween: Tween<Node> | null = null;
    private coinTween: Tween<Node> | null = null;
    private glowTween: Tween<Node> | null = null;
    private isHintActive: boolean = false;
    private totalCoinsCollected: number = 0;
    private isHintInstructionVisible: boolean = false;
    private totalCollectibleCount: number = 0;
    private currentCollectibleCount: number = 0;

    onLoad() {
         director.on('REARRANGE_CONTAINERS', this.realignContainers, this);
    
    // Position them correctly at the very start
    this.realignContainers(null, 0); 
        this.setupEventListeners();
        director.on('PLAYER_ZOOMED', this.hideZoomInstruction, this);
        this.resetGame();
    }

/**
 * Manually calculates positions and slides containers into empty spots
 * @param finishedNode The node that just finished (we skip this one)
 * @param speed Speed of the sliding animation (default 0.5s)
 */
private realignContainers(finishedNode: Node | null = null, speed: number = 0.5) {
    let currentValidIndex = 0;

    this.collectionContainers.forEach((container) => {
        const node = container.node;

        // Skip the node that is currently disappearing or already hidden
        if (node === finishedNode || !node.active) {
            return; 
        }

        // CALCULATE TARGET POSITION
        // New X = StartX + (0, 1, 2...) * Spacing
        const targetX = this.containerStartPos.x + (currentValidIndex * this.containerSpacing);
        const targetPos = v3(targetX, this.containerStartPos.y, 0);

        // SLIDE ANIMATION
        // This makes the panel slide into the empty spot left by the old panel
        tween(node)
            .to(speed, { position: targetPos }, { easing: 'expoOut' })
            .start();

        currentValidIndex++;
    });
}
    onDestroy() { this.cleanupEventListeners(); }
    private setupEventListeners() { director.on(COLLECT_COIN_EVENT, this.onAnyCoinClicked, this); }
    private cleanupEventListeners() { director.off(COLLECT_COIN_EVENT, this.onAnyCoinClicked, this); }

    private onAnyCoinClicked(coinNode: Node) {

        if (this.isGameOver) return;
        
        // if (CameraPinchZoom.IsBusy) {
        //     console.log("Ignored tap: Camera is busy zooming or panning.");
        //     return;
        // }
        if (this.tapSound) { this.tapSound.play(); }
        if (!this.isGameStarted) { this.startGame(); }
        else { this.stopTutorial(); }

        this.idleTimer = 0;
        const index = this.uncollectedCoins.indexOf(coinNode);
        if (index > -1) {
            this.uncollectedCoins.splice(index, 1);
        }

        this.currentCollectibleCount++;
        if (this.totalCoinsCollected === 1 && !this._hasShownZoomHint) {
            this.showZoomInstruction();
            this.playZoomAnimation();
        }

        if (this.totalCoinsCollected >= this.totalCollectibleCount) {
            this.endGame(true);
        }
        this.updateMainProgressBar();
        this.totalCoinsCollected++;


        // CHECK FOR FIRST ITEM COLLECTION
        if (this.totalCoinsCollected === 1 && !this._hasShownZoomHint) {
            this.showZoomInstruction();
        }

        if (this.totalCoinsCollected >= this.totalCollectibleCount) {
            this.endGame(true);
        }
    }
    private playZoomAnimation() {
    if (!this.ZoomAnim) return;

    this._zoomGuideActive = true;
    this.ZoomAnim.active = true;

    // Assuming the Animation component is on the node itself
    const anim = this.ZoomAnim.getComponent('cc.Animation') as any;
    if (anim) {
        anim.play('run'); 
    }
}

    private showZoomInstruction() {
        if (!this.zoomInstructionText) return;
        this._hasShownZoomHint = true;
        this.ZoomAnim.active = true;
        this.zoomInstructionText.active = true;
        this.zoomInstructionText.setScale(Vec3.ZERO);
        const opacity = this.zoomInstructionText.getComponent(UIOpacity);
        if (opacity) opacity.opacity = 0;

        // Pop in animation
        if (opacity) tween(opacity).to(0.4, { opacity: 255 }).start();
        tween(this.zoomInstructionText)
            .to(0.5, { scale: Vec3.ONE }, { easing: 'backOut' })
            .call(() => {
                // Pulsing effect
                tween(this.zoomInstructionText!)
                    .repeatForever(
                        tween()
                            .to(0.8, { scale: v3(1.1, 1.1, 1) }, { easing: 'sineInOut' })
                            .to(0.8, { scale: v3(1, 1, 1) }, { easing: 'sineInOut' })
                    ).start();
            })
            .start();
    }

    private hideZoomInstruction() {
        this.ZoomAnim.active = false;
        // If the node isn't visible, don't do anything
        if (!this.zoomInstructionText || !this.zoomInstructionText.active) return;

        // REUSED ANIMATION LOGIC FROM YOUR REQUEST
        tween(this.zoomInstructionText).stop();
        const opacityComp = this.zoomInstructionText.getComponent(UIOpacity);

        if (opacityComp) {
            tween(opacityComp).to(0.3, { opacity: 0 }, { easing: 'backIn' }).start();
        }

        tween(this.zoomInstructionText)
            .to(0.3, { scale: Vec3.ZERO }, { easing: 'backIn' })
            .call(() => {
                if (this.zoomInstructionText) this.zoomInstructionText.active = false;
            })
            .start();
    }
    private onContainerCompleted() {
        if (this.isGameOver) return;
        this.completedContainers++;
    }

    private startGame() {
        this.isGameStarted = true;
        this.stopTutorial();
        this.ZoomAnim.active = false;
        this.hideInstructionText();
        if (this.backgroundMusic) {
            this.backgroundMusic.play();
        }
    }

   private endGame(didWin: boolean) {
    if (this.isGameOver) return;
    this.isGameOver = true;

    if (this.backgroundMusic) { this.backgroundMusic.stop(); }
    this.stopTutorial();
    
    // Disable interaction with all coins
    this.allCollectibleItems.forEach(itemNode => { 
        const button = itemNode.getComponent(Button);
        if(button) button.interactable = false; 
    });

    if (didWin) {
        // Option: Show the Luck Level bar if they won
        this.showLuckLevelSequence(); 
    } else {
        // --- FAIL SEQUENCE ---
        console.log("Player ran out of time. Showing End Screen.");
        // Short 0.5s delay for a more professional transition
        tween(this.node)
            .delay(0.5)
            .call(() => this.showEndScreen())
            .start();
    }
}
    // --- MODIFIED FUNCTION WITH NEW TIMING ---
    private showLuckLevelSequence() {
        if (!this.luckLevelPanel || !this.luckLevelLabel || !this.luckLevelProgressBar) {
            console.error("Luck Level UI not assigned in the Inspector! Skipping sequence.");
            this.showEndScreen();
            return;
        }

        // 1. Prepare UI
        const luckPercent = Math.floor(Math.random() * 21) + 80; // Random % from 80 to 100
        this.luckLevelLabel.string = `${luckPercent}%`;
        this.luckLevelProgressBar.progress = 0;

        const panelOpacity = this.luckLevelPanel.getComponent(UIOpacity)!;
        panelOpacity.opacity = 0;
        this.luckLevelPanel.setScale(v3(0.7, 0.7, 1));
        this.luckLevelPanel.active = true;

        // 2. Animate the sequence
        const barFillDuration = 1.5; // How long it takes for the progress bar to fill
        const holdDuration = 2.0;    // How long to show the panel after animation

        tween(this.node)
            // Animate the panel popping onto the screen
            .call(() => {
                tween(panelOpacity).to(0.4, { opacity: 255 }).start();
                tween(this.luckLevelPanel!).to(0.5, { scale: Vec3.ONE }, { easing: 'backOut' }).start();
            })
            .delay(0.7) // Short delay for a nice rhythm

            // Animate the progress bar filling up
            .call(() => {
                tween(this.luckLevelProgressBar!)
                    .to(barFillDuration, { progress: luckPercent / 100 }, { easing: 'cubicOut' })
                    .start();
            })
            .delay(barFillDuration) // IMPORTANT: Wait for the bar fill animation to complete

            // NOW, hold for the specified duration
            .delay(holdDuration)

            // Fade out the entire panel
            .call(() => {
                tween(panelOpacity)
                    .to(0.4, { opacity: 0 }, { easing: 'cubicIn' })
                    .call(() => {
                        if (this.luckLevelPanel) this.luckLevelPanel.active = false;
                    })
                    .start();
            })
            .delay(0.4) // Wait for fade-out to complete

            // Finally, show the real end screen
            .call(() => {
                this.showEndScreen();
            })
            .start();
    }

    private showEndScreen() {
        if (this.endScreenPanel) {
            this.endScreenPanel.active = true;

            const panelOpacity = this.endScreenPanel.getComponent(UIOpacity);
            const elementsToAnimate = [this.endScreenIcon, this.ctaButton?.node];

            if (panelOpacity) panelOpacity.opacity = 0;

            elementsToAnimate.forEach(el => {
                if (el) {
                    el.setScale(new Vec3(0.7, 0.7, 1));
                    const opacity = el.getComponent(UIOpacity);
                    if (opacity) opacity.opacity = 0;
                    el.active = true;
                }
            });

            if (panelOpacity) {
                tween(panelOpacity).to(0.3, { opacity: 200 }).start();
            }

            if (this.endScreenIcon) {
                const opacity = this.endScreenIcon.getComponent(UIOpacity);
                if (opacity) tween(opacity).delay(0.2).to(0.5, { opacity: 255 }, { easing: 'cubicOut' }).start();
                tween(this.endScreenIcon).delay(0.2).to(0.5, { scale: Vec3.ONE }, { easing: 'backOut' }).start();
            }

            if (this.ctaButton) {
                const opacity = this.ctaButton.node.getComponent(UIOpacity);
                if (opacity) tween(opacity).delay(0.5).to(0.5, { opacity: 255 }, { easing: 'cubicOut' }).start();
                tween(this.ctaButton.node).delay(0.5).to(0.6, { scale: Vec3.ONE }, { easing: 'backOut' }).start();
            }
        }
    }

    public resetGame() {
        if (this.backgroundMusic) { this.backgroundMusic.stop(); }
        if (this.endScreenPanel) { this.endScreenPanel.active = false; }
        if (this.highlightOverlay) { this.highlightOverlay.active = false; }
        if (this.tutorialHintGlow) { this.tutorialHintGlow.active = false; }
        if (this.tutorialHintCoin) { this.tutorialHintCoin.active = false; }
        if (this.luckLevelPanel) { this.luckLevelPanel.active = false; }

        this.isGameStarted = false; this.isGameOver = false; this.isHintActive = false;
        this.totalCoinsCollected = 0; this.currentTime = this.gameDuration;

        this.completedContainers = 0;
        this.totalContainers = this.collectionContainers.length;

        if (this.timerLabel) this.timerLabel.node.active = true;
        if (this.ctaButton) this.ctaButton.interactable = true;

        this.updateGameTimer(0);
        this.collectionContainers.forEach(container => container.resetContainer());
        this.allCollectibleItems.forEach(itemNode => {
            itemNode.getComponent(CollectibleCoin)?.resetCoin();
            const button = itemNode.getComponent(Button);
            if (button) button.interactable = true;
        });

        this.totalCollectibleCount = this.allCollectibleItems.length;
        this.currentCollectibleCount = 0;
        this.updateMainProgressBar();

        this.idleTimer = 0;
        this.uncollectedCoins = [...this.allCollectibleItems];
        this.stopTutorial();
        this.scheduleOnce(() => { this.triggerTutorial(); }, 0);
    }
  private updateGameTimer(deltaTime: number) { 
    if (this.isGameStarted) { 
        this.currentTime -= deltaTime; 
    } 

    if (this.timerLabel) { 
        const totalSeconds = Math.max(0, Math.ceil(this.currentTime)); 
        const minutes = Math.floor(totalSeconds / 60); 
        const seconds = totalSeconds % 60; 
        const fMin = minutes < 10 ? '0' + minutes : minutes.toString(); 
        const fSec = seconds < 10 ? '0' + seconds : seconds.toString(); 
        this.timerLabel.string = `${fMin}:${fSec}`; 
    } 

    // TRIGGER FAIL:
    if (this.currentTime <= 0 && this.isGameStarted) { 
        this.currentTime = 0; // Lock it at zero
        this.endGame(false); // Call fail endGame
    } 
}
    private updateIdleTimer(deltaTime: number) { if (this.isHintActive || this.uncollectedCoins.length === 0) return; this.idleTimer += deltaTime; if (this.idleTimer >= this.hintInterval) { this.triggerHint(); this.idleTimer = 0; } }

    // private triggerHint() { 
    //     if (this.uncollectedCoins.length === 0) return; 
    //     const randomIndex = Math.floor(Math.random() * this.uncollectedCoins.length); 
    //     const hintCoinNode = this.uncollectedCoins[randomIndex]; 
    //     if (hintCoinNode && hintCoinNode.isValid) { 
    //         this.isHintActive = true; 
    //         this.playTapTutorial(hintCoinNode, false); 
    //     } 
    // }

    private hideInstructionText() { if (!this.instructionText) return; tween(this.instructionText).stop(); const opacityComp = this.instructionText.getComponent(UIOpacity); if (opacityComp) { tween(opacityComp).to(0.3, { opacity: 0 }, { easing: 'backIn' }).start(); } tween(this.instructionText).to(0.3, { scale: Vec3.ZERO }, { easing: 'backIn' }).call(() => { if (this.instructionText) this.instructionText.active = false; }).start(); }
    private updateMainProgressBar() {
        if (this.mainProgressBar) {
            this.mainProgressBar.progress = this.totalCollectibleCount > 0 ? this.currentCollectibleCount / this.totalCollectibleCount : 0;
        }
    }

    private triggerTutorial() {
        if (this.isGameStarted) return;
        if (this.tutorialTargetCoin && this.tutorialTargetCoin.isValid) {
            this.playTapTutorial(this.tutorialTargetCoin, true);
        }
    }

    private playTapTutorial(targetNode: Node, showInstruction: boolean) {
        if (!this.highlightOverlay || !this.tutorialHintGlow || !this.tutorialHintCoin || !targetNode?.isValid) { return; }

        this.highlightOverlay.active = true;
        const overlayOpacity = this.highlightOverlay.getComponent(UIOpacity);
        if (overlayOpacity) {
            overlayOpacity.opacity = 0;
            tween(overlayOpacity).to(0.4, { opacity: 200 }).start();
        }

        if (showInstruction) {
            this.playHintInstructionAnimation();
        }

        const worldPos = targetNode.getComponent(UITransform)!.convertToWorldSpaceAR(v3(0, 0, 0));
        const localPos = this.tutorialHintCoin.parent!.getComponent(UITransform)!.convertToNodeSpaceAR(worldPos);
        this.tutorialHintCoin.setPosition(localPos);
        this.tutorialHintGlow.setPosition(localPos);

        const targetSprite = targetNode.getComponent(Sprite);
        const hintSprite = this.tutorialHintCoin.getComponent(Sprite);
        if (targetSprite && hintSprite) {
            hintSprite.spriteFrame = targetSprite.spriteFrame;
        }
        this.tutorialHintCoin.setScale(targetNode.getScale());
        this.tutorialHintCoin.active = true;
        this.tutorialHintGlow.active = true;

        if (this.coinTween) { this.coinTween.stop(); }
        this.coinTween = tween(this.tutorialHintCoin)
            .to(0, { scale: new Vec3(1, 1, 1) },)
            .union().repeatForever().start();

        if (this.glowTween) { this.glowTween.stop(); }
        const glowBaseScale = 1.5;
        this.tutorialHintGlow.setScale(new Vec3(glowBaseScale, glowBaseScale, 1));
        this.glowTween = tween(this.tutorialHintGlow)
            .to(1.0, { scale: new Vec3(glowBaseScale * 1.2, glowBaseScale * 1.2, 1) }, { easing: 'sineInOut' })
            .to(1.0, { scale: new Vec3(glowBaseScale, glowBaseScale, 1) }, { easing: 'sineInOut' })
            .union().repeatForever().start();

        if (this.handNode) { this.handNode.active = true; }
        this.runTapAnimationLoop(targetNode);
    }

    // --- MODIFIED FUNCTION ---
    private playHintInstructionAnimation() {
        if (!this.instructionText) return;

        this.isHintInstructionVisible = true;

        // Make sure to stop any previous animations on the node
        tween(this.instructionText).stop();
        this.instructionText.active = true;

        const opacityComp = this.instructionText.getComponent(UIOpacity);

        // Reset state before animating
        if (opacityComp) opacityComp.opacity = 0;
        this.instructionText.setScale(Vec3.ZERO);

        // Animate opacity separately for clarity
        if (opacityComp) {
            tween(opacityComp).to(0.4, { opacity: 255 }).start();
        }

        // Chain the animations: Pop-up first, then start the continuous pulse
        tween(this.instructionText)
            // 1. The Pop-up Animation
            .to(0.5, { scale: Vec3.ONE }, { easing: 'backOut' })

            // 2. This .call() starts the next animation after the pop-up is complete
            .call(() => {
                // Safety check in case the node is destroyed mid-animation
                if (!this.instructionText || !this.instructionText.isValid) return;

                // 3. The Continuous Pulse Animation (repeats forever)
                tween(this.instructionText)
                    .to(1.5, { scale: new Vec3(0.95, 0.95, 1) }, { easing: 'sineInOut' })
                    .to(1.5, { scale: new Vec3(1, 1, 1) }, { easing: 'sineInOut' })
                    .union()
                    .repeatForever()
                    .start();
            })
            .start();
    }
    // Inside GameManager class

    private _currentHintTarget: Node | null = null;

    // Add this to your update() method
    update(deltaTime: number) {
        if (!this.isGameStarted || this.isGameOver) return;
        this.updateGameTimer(deltaTime);
        this.updateIdleTimer(deltaTime);

        // --- ADD THIS: SYNC TUTORIAL POSITIONS EVERY FRAME ---
        if (this.isHintActive || (!this.isGameStarted && this.tutorialTargetCoin)) {
            this.syncTutorialElements();
        }
    }

    /**
     * RE-POSITIONS THE TUTORIAL ELEMENTS TO MATCH BACKGROUND ZOOM/DRAG
     */
   /**
 * BULLETPROOF SYNC: Fixes the hand being in the wrong position
 */
private syncTutorialElements() {
    // 1. Determine which coin we are pointing at
    const target = this.isHintActive ? this._currentHintTarget : this.tutorialTargetCoin;
    if (!target || !target.isValid || !this.tutorialHintCoin || !this.handNode) return;

    // --- STEP A: Get the World Position (The exact screen pixel) ---
    const itemUIT = target.getComponent(UITransform)!;
    // (0,0,0) is the center of the item. This returns where that center is on your screen.
    const worldPos = itemUIT.convertToWorldSpaceAR(new Vec3(0, 0, 0));

    // --- STEP B: Find the Canvas Layer (The fixed layer) ---
    // We convert the World Pixel to the space of the node that HOLDS the hand
    const uiParentUIT = this.handNode.parent!.getComponent(UITransform)!;
    const localPos = uiParentUIT.convertToNodeSpaceAR(worldPos);

    // --- STEP C: Apply Position ---
    this.tutorialHintCoin.setPosition(localPos);
    if (this.tutorialHintGlow) this.tutorialHintGlow.setPosition(localPos);

    // Add your offset so the hand points at the item instead of covering it
    const finalHandPos = new Vec3(localPos.x + this.tutorialHandOffset.x, localPos.y + this.tutorialHandOffset.y, 0);
    this.handNode.setPosition(finalHandPos);

    // --- STEP D: Sync Scale ---
    // Search the scene for the Camera Controller if we don't have a direct link
    let camScript = this.node.scene.getComponentInChildren(CameraPinchZoom);
    if (camScript) {
        const currentZoom = camScript.currentScale;
        // The Hint Item must match the background zoom scale
        this.tutorialHintCoin.setScale(v3(currentZoom, currentZoom, 1));
        
        // Match hand size slightly to the zoom (optional)
        // this.handNode.setScale(v3(this.tutorialHandScale * currentZoom, this.tutorialHandScale * currentZoom, 1));
    }
}

    // Update your triggerHint to store the current target
    private triggerHint() {
        if (this.uncollectedCoins.length === 0) return;
        const randomIndex = Math.floor(Math.random() * this.uncollectedCoins.length);
        this._currentHintTarget = this.uncollectedCoins[randomIndex]; // Store the target

        if (this._currentHintTarget && this._currentHintTarget.isValid) {
            this.isHintActive = true;
            this.playTapTutorial(this._currentHintTarget, false);
        }
    }


    private stopTutorial() {
        this.isHintActive = false;
        if (this.handTween) { this.handTween.stop(); this.handTween = null; }
        if (this.coinTween) { this.coinTween.stop(); this.coinTween = null; }
        if (this.glowTween) { this.glowTween.stop(); this.glowTween = null; }

        if (this.handNode) { this.handNode.active = false; }
        if (this.tutorialHintCoin) { this.tutorialHintCoin.active = false; }
        if (this.tutorialHintGlow) { this.tutorialHintGlow.active = false; }

        if (this.isHintInstructionVisible) {
            this.hideInstructionText();
            this.isHintInstructionVisible = false;
        }
        if (this.highlightOverlay && this.highlightOverlay.active) {
            const overlayOpacity = this.highlightOverlay.getComponent(UIOpacity);
            if (overlayOpacity) {
                tween(overlayOpacity).to(0.3, { opacity: 0 }).call(() => { if (this.highlightOverlay) this.highlightOverlay.active = false; }).start();
            } else { this.highlightOverlay.active = false; }
        }
    }

    private runTapAnimationLoop(targetNode: Node) {
        if (!this.handNode || !this.idleHandSprite || !this.clickHandSprite || !targetNode.isValid) {
            this.stopTutorial();
            return;
        }
        const handSprite = this.handNode.getComponent(Sprite)!;

        // Set initial position once
        this.syncTutorialElements();

        const baseScale = new Vec3(this.tutorialHandScale, this.tutorialHandScale, 1);
        const pressedScale = new Vec3(this.tutorialHandScale * 0.9, this.tutorialHandScale * 0.9, 1);

        this.handTween = tween(this.handNode)
            .repeatForever(
                tween()
                    .delay(0.6)
                    .call(() => { handSprite.spriteFrame = this.clickHandSprite!; })
                    .to(0.2, { scale: pressedScale }, { easing: 'sineOut' })
                    .delay(0.15)
                    .call(() => { handSprite.spriteFrame = this.idleHandSprite!; })
                    .to(0.3, { scale: baseScale }, { easing: 'sineIn' })
            )
            .start();
    }

    private getUIPosition(targetNode: Node): Vec3 | null { const referenceNode = this.handNode?.parent; if (!referenceNode || !targetNode.isValid) return null; const refUIT = referenceNode.getComponent(UITransform); if (!refUIT) return null; const worldPos = targetNode.getComponent(UITransform)!.convertToWorldSpaceAR(v3(0, 0, 0)); return refUIT.convertToNodeSpaceAR(worldPos); }
}