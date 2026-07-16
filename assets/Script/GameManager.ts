// FILE: GameManager.ts (Final Version with 3-Second Hold)

import { _decorator, Component, Node, director, ProgressBar, Label, Button, tween, Vec3, UIOpacity, SpriteFrame, Sprite, UITransform, v3, Tween, AudioSource } from 'cc';
import { CollectibleCoin, COLLECT_COIN_EVENT } from './CollectibleCoin';
import { CollectionContainer, CONTAINER_COMPLETE_EVENT } from './CollectionContainer';
import { CameraPinchZoom } from './CameraPinchZoom';

declare const mraid: any;
const { ccclass, property } = _decorator;

type WaitingEntry = {
    itemNode: Node;
    spriteFrame: SpriteFrame;
    displayNode: Node;
    slotNode: Node;
    container: CollectionContainer;
};

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
    @property({ type: Number, tooltip: "Delay before the first tutorial highlight appears." })
    public tutorialStartDelay: number = 0.8;
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
public containerStartPos: Vec3 = v3(-220, 0, 0);
@property({ type: Node, tooltip: "Parent node containing the 5 waiting slots. Auto-found by name 'Waiting' if empty." })
public waitingBoard: Node | null = null;
@property({ type: [Node], tooltip: "Waiting slot nodes. Auto-filled from waitingBoard children if empty." })
public waitingSlots: Node[] = [];

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
    private activeCollectionContainers: CollectionContainer[] = [];
    private activeContainerIndex: number = 0;
    private waitingEntries: WaitingEntry[] = [];
    private routedItems: Node[] = [];
    private panelHomePositions: Vec3[] = [];
    private panelHomeScales: Vec3[] = [];
    private completedCollectionContainers: CollectionContainer[] = [];
    private visibleCollectionLanes: (CollectionContainer | null)[] = [];

    onLoad() {
        this.prepareCollectionSystem();
        this.setupEventListeners();
        director.on(CONTAINER_COMPLETE_EVENT, this.onContainerCompleted, this);
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
    private cleanupEventListeners() {
        director.off(COLLECT_COIN_EVENT, this.onAnyCoinClicked, this);
        director.off(CONTAINER_COMPLETE_EVENT, this.onContainerCompleted, this);
        director.off('PLAYER_ZOOMED', this.hideZoomInstruction, this);
    }

    private onAnyCoinClicked(coinNode: Node, spriteFrame: SpriteFrame, worldPos: Vec3) {

        if (this.isGameOver) return;
        if (!coinNode || this.routedItems.indexOf(coinNode) !== -1) return;
        
        // if (CameraPinchZoom.IsBusy) {
        //     console.log("Ignored tap: Camera is busy zooming or panning.");
        //     return;
        // }
        if (this.tapSound) { this.tapSound.play(); }
        if (!this.isGameStarted) { this.startGame(); }
        else { this.stopTutorial(); }

        const wasRouted = this.routeTappedItem(coinNode, spriteFrame, worldPos);
        if (!wasRouted) {
            const button = coinNode.getComponent(Button);
            if (button) button.interactable = true;
            return;
        }

        this.routedItems.push(coinNode);
        this.idleTimer = 0;
        const index = this.uncollectedCoins.indexOf(coinNode);
        if (index > -1) {
            this.uncollectedCoins.splice(index, 1);
        }

        this.currentCollectibleCount++;
        this.totalCoinsCollected++;
        this.updateMainProgressBar();

        // CHECK FOR FIRST ITEM COLLECTION
        if (this.totalCoinsCollected === 1 && !this._hasShownZoomHint) {
            this.showZoomInstruction();
            this.playZoomAnimation();
        }

        this.checkWinCondition();
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
    private onContainerCompleted(container: CollectionContainer) {
        if (this.isGameOver) return;
        if (this.completedCollectionContainers.indexOf(container) === -1) {
            this.completedCollectionContainers.push(container);
            this.completedContainers++;
        }

        const replacedLaneIndex = this.replaceCompletedLane(container);
        this.scheduleOnce(() => {
            this.layoutVisibleContainers(replacedLaneIndex);
            this.scheduleOnce(() => this.drainWaitingForVisibleContainers(), 0.45);
            this.checkWinCondition();
        }, 0.45);
    }

    private replaceCompletedLane(container: CollectionContainer): number {
        const laneIndex = this.visibleCollectionLanes.indexOf(container);
        if (laneIndex === -1) return -1;

        this.visibleCollectionLanes[laneIndex] = this.getNextPendingContainer();
        return laneIndex;
    }

    private getNextPendingContainer(): CollectionContainer | null {
        for (const container of this.activeCollectionContainers) {
            const isCompleted = this.completedCollectionContainers.indexOf(container) !== -1;
            const isVisible = this.visibleCollectionLanes.indexOf(container) !== -1;
            if (!isCompleted && !isVisible) {
                return container;
            }
        }
        return null;
    }

    private checkWinCondition() {
        if (this.isGameOver) return;
        if (this.completedCollectionContainers.length >= this.activeCollectionContainers.length && this.waitingEntries.length === 0) {
            this.scheduleOnce(() => this.endGame(true), 0.35);
        }
    }

    private prepareCollectionSystem() {
        this.activeCollectionContainers = this.collectionContainers.filter((container) => {
            return !!container
                && !!container.node
                && container.node.parent?.name === 'UIPanel'
                && container.getItemCount
                && container.getItemCount() >= 3;
        });

        if (!this.waitingBoard) {
            const canvas = this.node.scene.getChildByName('Canvas');
            this.waitingBoard = this.findNodeByName(canvas, 'Waiting');
        }

        if (this.waitingBoard && this.waitingSlots.length === 0) {
            this.waitingSlots = this.waitingBoard.children.slice(0, 5);
        }

        this.cachePanelHomeTransforms();
    }

    private cachePanelHomeTransforms() {
        this.activeCollectionContainers.slice(0, 2).forEach((container, index) => {
            if (!container.node || !container.node.isValid) return;
            if (!this.panelHomePositions[index]) {
                this.panelHomePositions[index] = container.node.position.clone();
            }
            if (!this.panelHomeScales[index]) {
                this.panelHomeScales[index] = container.node.scale.clone();
            }
        });
    }

    private findNodeByName(root: Node | null, name: string): Node | null {
        if (!root) return null;
        if (root.name === name) return root;
        for (const child of root.children) {
            const result = this.findNodeByName(child, name);
            if (result) return result;
        }
        return null;
    }

    private getActiveContainer(): CollectionContainer | null {
        return this.visibleCollectionLanes[0] || null;
    }

    private routeTappedItem(coinNode: Node, spriteFrame: SpriteFrame, worldPos: Vec3): boolean {
        const targetContainer = this.activeCollectionContainers.find(container => container.containsItem(coinNode));
        if (!targetContainer || !spriteFrame) return false;

        if (this.isContainerVisible(targetContainer)) {
            return targetContainer.collectItem(coinNode, spriteFrame, worldPos);
        }

        return this.moveItemToWaitingBoard(coinNode, spriteFrame, worldPos, targetContainer);
    }

    private isContainerVisible(container: CollectionContainer): boolean {
        return this.visibleCollectionLanes.indexOf(container) !== -1;
    }

    private moveItemToWaitingBoard(coinNode: Node, spriteFrame: SpriteFrame, worldPos: Vec3, targetContainer: CollectionContainer): boolean {
        const slotNode = this.getFreeWaitingSlot();
        if (!slotNode) {
            const button = coinNode.getComponent(Button);
            if (button) button.interactable = true;
            return false;
        }

        coinNode.getComponent(CollectibleCoin)?.onCollectionStart();
        const displayNode = this.createWaitingDisplay(spriteFrame, worldPos, slotNode);
        this.waitingEntries.push({ itemNode: coinNode, spriteFrame, displayNode, slotNode, container: targetContainer });
        return true;
    }

    private getFreeWaitingSlot(): Node | null {
        return this.waitingSlots.find(slot => {
            return !!slot && this.waitingEntries.every(entry => entry.slotNode !== slot);
        }) || null;
    }

    private createWaitingDisplay(spriteFrame: SpriteFrame, startWorldPos: Vec3, slotNode: Node): Node {
        const canvas = this.node.scene.getChildByName('Canvas');
        const displayNode = new Node('WaitingItem');
        const displayUIT = displayNode.addComponent(UITransform);
        const sprite = displayNode.addComponent(Sprite);
        sprite.spriteFrame = spriteFrame;
        this.copyWaitingVisualSize(spriteFrame, displayUIT, sprite);
        const slotScale = this.getWaitingFitScale(spriteFrame, slotNode);
        displayNode.setScale(slotScale);

        if (!canvas) {
            slotNode.addChild(displayNode);
            displayNode.setPosition(Vec3.ZERO);
            return displayNode;
        }

        canvas.addChild(displayNode);
        const canvasUIT = canvas.getComponent(UITransform)!;
        displayNode.setPosition(canvasUIT.convertToNodeSpaceAR(startWorldPos));
        const targetLocalPos = canvasUIT.convertToNodeSpaceAR(slotNode.worldPosition);

        tween(displayNode)
            .to(0.45, { position: targetLocalPos, scale: slotScale }, { easing: 'sineInOut' })
            .call(() => {
                if (!displayNode.isValid || !slotNode.isValid) return;
                displayNode.setParent(slotNode, true);
                displayNode.setPosition(Vec3.ZERO);
                displayNode.setScale(slotScale);
                tween(slotNode)
                    .to(0.1, { scale: v3(1.1, 1.1, 1) }, { easing: 'quadOut' })
                    .to(0.18, { scale: Vec3.ONE }, { easing: 'backOut' })
                    .start();
            })
            .start();

        return displayNode;
    }

    private copyWaitingVisualSize(spriteFrame: SpriteFrame, targetUIT: UITransform, sprite: Sprite) {
        const rect = spriteFrame.rect;
        targetUIT.setContentSize(rect.width, rect.height);
        (sprite as any).sizeMode = Sprite.SizeMode.CUSTOM;
    }

    private getWaitingFitScale(spriteFrame: SpriteFrame, slotNode: Node): Vec3 {
        const slotUIT = slotNode.getComponent(UITransform);
        const rect = spriteFrame.rect;

        if (!slotUIT || rect.width <= 0 || rect.height <= 0) {
            return v3(1, 1, 1);
        }

        const widthFit = (slotUIT.contentSize.width * 0.82) / rect.width;
        const heightFit = (slotUIT.contentSize.height * 0.82) / rect.height;
        const fit = Math.min(widthFit, heightFit);
        return v3(fit, fit, 1);
    }

    private drainWaitingForVisibleContainers() {
        if (this.isGameOver) return;
        const visibleContainers = this.visibleCollectionLanes.filter((container): container is CollectionContainer => !!container);

        const entry = this.waitingEntries
            .filter(waitingEntry => visibleContainers.indexOf(waitingEntry.container) !== -1)
            .sort((a, b) => {
                const containerOrder = visibleContainers.indexOf(a.container) - visibleContainers.indexOf(b.container);
                if (containerOrder !== 0) return containerOrder;
                return a.container.getSlotIndexForItem(a.itemNode) - b.container.getSlotIndexForItem(b.itemNode);
            })[0];

        if (!entry || !entry.displayNode || !entry.displayNode.isValid) return;

        const startWorldPos = entry.displayNode.worldPosition.clone();
        const accepted = entry.container.collectItem(
            entry.itemNode,
            entry.spriteFrame,
            startWorldPos,
            false,
            entry.displayNode,
            () => {
                const entryIndex = this.waitingEntries.indexOf(entry);
                if (entryIndex > -1) this.waitingEntries.splice(entryIndex, 1);
                this.scheduleOnce(() => this.drainWaitingForVisibleContainers(), 0.15);
            }
        );

        if (!accepted) {
            const entryIndex = this.waitingEntries.indexOf(entry);
            if (entryIndex > -1) this.waitingEntries.splice(entryIndex, 1);
        }
    }

    private layoutVisibleContainers(animatedLaneIndex: number = -1) {
        this.activeCollectionContainers.forEach((container, index) => {
            const panelNode = container.node;
            const visibleIndex = this.visibleCollectionLanes.indexOf(container);
            const opacity = panelNode.getComponent(UIOpacity) || panelNode.addComponent(UIOpacity);
            const homePosition = this.panelHomePositions[visibleIndex] || panelNode.position.clone();
            const homeScale = this.panelHomeScales[visibleIndex] || panelNode.scale.clone();

            if (visibleIndex < 0) {
                panelNode.active = false;
                return;
            }

            panelNode.active = true;
            opacity.opacity = 255;

            if (visibleIndex === animatedLaneIndex) {
                panelNode.setPosition(homePosition.x, homePosition.y + 120, homePosition.z);
                panelNode.setScale(v3(homeScale.x * 0.94, homeScale.y * 0.94, homeScale.z));
                tween(panelNode)
                    .to(0.45, { position: homePosition, scale: homeScale }, { easing: 'backOut' })
                    .start();
            } else {
                tween(panelNode)
                    .to(0.25, { position: homePosition, scale: homeScale }, { easing: 'expoOut' })
                    .start();
            }
        });
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
        this.prepareCollectionSystem();
        if (this.backgroundMusic) { this.backgroundMusic.stop(); }
        if (this.endScreenPanel) { this.endScreenPanel.active = false; }
        if (this.highlightOverlay) { this.highlightOverlay.active = false; }
        if (this.tutorialHintGlow) { this.tutorialHintGlow.active = false; }
        if (this.tutorialHintCoin) { this.tutorialHintCoin.active = false; }
        if (this.luckLevelPanel) { this.luckLevelPanel.active = false; }

        this.isGameStarted = false; this.isGameOver = false; this.isHintActive = false;
        this.totalCoinsCollected = 0; this.currentTime = this.gameDuration;
        this.activeContainerIndex = 0;
        this.routedItems.length = 0;
        this.completedCollectionContainers.length = 0;
        this.visibleCollectionLanes = [
            this.activeCollectionContainers[0] || null,
            this.activeCollectionContainers[1] || null
        ];
        this.clearWaitingBoard();

        this.completedContainers = 0;
        this.totalContainers = this.activeCollectionContainers.length;

        if (this.timerLabel) this.timerLabel.node.active = true;
        if (this.ctaButton) this.ctaButton.interactable = true;

        this.updateGameTimer(0);
        this.collectionContainers.forEach(container => {
            if (container && container.node && container.node.isValid) {
                container.resetContainer();
            }
        });
        this.allCollectibleItems = this.getUniqueCollectibleItems();
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
        this.layoutVisibleContainers(-1);
        this.drainWaitingForVisibleContainers();
        this.stopTutorial();
        this.scheduleOnce(() => { this.triggerTutorial(); }, this.tutorialStartDelay);
    }

    private getUniqueCollectibleItems(): Node[] {
        const uniqueItems: Node[] = [];
        this.activeCollectionContainers.forEach((container) => {
            container.collectibleItems.forEach((itemNode) => {
                if (itemNode && itemNode.isValid && uniqueItems.indexOf(itemNode) === -1) {
                    uniqueItems.push(itemNode);
                }
            });
        });
        return uniqueItems.length > 0 ? uniqueItems : this.allCollectibleItems;
    }

    private clearWaitingBoard() {
        this.waitingEntries.forEach((entry) => {
            if (entry.displayNode && entry.displayNode.isValid) entry.displayNode.destroy();
        });
        this.waitingEntries.length = 0;
        this.waitingSlots.forEach((slot) => {
            if (!slot || !slot.isValid) return;
            slot.children
                .filter(child => child.name === 'WaitingItem')
                .forEach(child => child.destroy());
            slot.setScale(Vec3.ONE);
        });
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

        const targetSprite = targetNode.getComponent(Sprite);
        const hintSprite = this.tutorialHintCoin.getComponent(Sprite);
        if (targetSprite && hintSprite) {
            hintSprite.spriteFrame = targetSprite.spriteFrame;
        }
        this.tutorialHintCoin.active = true;
        this.tutorialHintGlow.active = true;
        this.placeTutorialTargets(targetNode);

        if (this.coinTween) { this.coinTween.stop(); }
        this.coinTween = null;
        this.tutorialHintCoin.setScale(this.getTutorialCoinScale(targetNode, 1));

        if (this.glowTween) { this.glowTween.stop(); }
        const glowBaseScale = this.getTutorialGlowScale(targetNode, 1.25);
        this.glowTween = tween(this.tutorialHintGlow)
            .to(0.75, { scale: this.getTutorialGlowScale(targetNode, 1.45) }, { easing: 'sineInOut' })
            .to(0.75, { scale: glowBaseScale }, { easing: 'sineInOut' })
            .union().repeatForever().start();

        if (this.handNode) {
            this.handNode.active = true;
            this.handNode.setScale(v3(0, 0, 1));
        }
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
        if (this.isHintActive || (!this.isGameStarted && this.tutorialHintCoin?.active)) {
            this.syncTutorialElements();
        }

        if (!this.isGameStarted || this.isGameOver) return;
        this.updateGameTimer(deltaTime);
        this.updateIdleTimer(deltaTime);
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

    this.placeTutorialTargets(target);
}

private placeTutorialTargets(target: Node) {
    const localPos = this.getTutorialLayerPosition(target);
    if (!localPos) return;

    if (this.tutorialHintCoin) {
        this.tutorialHintCoin.setPosition(localPos);
    }
    if (this.tutorialHintGlow) {
        this.tutorialHintGlow.setPosition(localPos);
    }
    if (this.handNode) {
        this.handNode.setPosition(localPos.x + this.tutorialHandOffset.x, localPos.y + this.tutorialHandOffset.y, 0);
    }
}

private getTutorialLayerPosition(target: Node): Vec3 | null {
    if (!target || !target.isValid || !this.tutorialHintCoin?.parent) return null;

    const itemUIT = target.getComponent(UITransform);
    const tutorialParentUIT = this.tutorialHintCoin.parent.getComponent(UITransform);
    if (!itemUIT || !tutorialParentUIT) return null;

    const worldPos = itemUIT.convertToWorldSpaceAR(Vec3.ZERO);
    return tutorialParentUIT.convertToNodeSpaceAR(worldPos);
}

private getTutorialCoinScale(target: Node, multiplier: number = 1): Vec3 {
    const worldScale = target.worldScale;
    return v3(Math.abs(worldScale.x) * multiplier, Math.abs(worldScale.y) * multiplier, 1);
}

private getTutorialGlowScale(target: Node, multiplier: number = 1): Vec3 {
    const targetUIT = target.getComponent(UITransform);
    const glowUIT = this.tutorialHintGlow?.getComponent(UITransform);
    if (!targetUIT || !glowUIT || glowUIT.contentSize.width <= 0 || glowUIT.contentSize.height <= 0) {
        return v3(multiplier, multiplier, 1);
    }

    const worldScale = target.worldScale;
    const targetWidth = targetUIT.contentSize.width * Math.abs(worldScale.x);
    const targetHeight = targetUIT.contentSize.height * Math.abs(worldScale.y);
    const fit = Math.max(targetWidth / glowUIT.contentSize.width, targetHeight / glowUIT.contentSize.height) * multiplier;
    return v3(fit, fit, 1);
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
        const pressedScale = new Vec3(this.tutorialHandScale * 0.94, this.tutorialHandScale * 0.94, 1);

        this.handTween = tween(this.handNode)
            .to(0.28, { scale: baseScale }, { easing: 'backOut' })
            .delay(0.25)
            .repeatForever(
                tween()
                    .delay(0.55)
                    .call(() => { handSprite.spriteFrame = this.clickHandSprite!; })
                    .to(0.12, { scale: pressedScale }, { easing: 'sineOut' })
                    .delay(0.1)
                    .call(() => { handSprite.spriteFrame = this.idleHandSprite!; })
                    .to(0.18, { scale: baseScale }, { easing: 'sineIn' })
            )
            .start();
    }

    private getUIPosition(targetNode: Node): Vec3 | null { const referenceNode = this.handNode?.parent; if (!referenceNode || !targetNode.isValid) return null; const refUIT = referenceNode.getComponent(UITransform); if (!refUIT) return null; const worldPos = targetNode.getComponent(UITransform)!.convertToWorldSpaceAR(v3(0, 0, 0)); return refUIT.convertToNodeSpaceAR(worldPos); }
}
