// FILE: CollectionContainer.ts

import { _decorator, Component, Node, Label, ProgressBar, director, Vec3, tween, Sprite, SpriteFrame, AudioSource, UITransform, UIOpacity, Prefab, v3, Color, Graphics } from 'cc';
import { CollectibleCoin } from './CollectibleCoin';


const { ccclass, property } = _decorator;

export const CONTAINER_COMPLETE_EVENT = 'container-complete';

@ccclass('CollectionContainer')
export class CollectionContainer extends Component {

    // --- All properties are the same ---
    @property(Sprite)
    public itemIcon: Sprite | null = null;
    @property(ProgressBar)
    public progressBar: ProgressBar | null = null;
    @property(Label)
    public progressLabel: Label | null = null;
    @property({ type: Node })
    public collectibleItems: Node[] = [];
    @property({ type: SpriteFrame })
    public highlightSpriteFrame: SpriteFrame | null = null;
    @property({ type: SpriteFrame })
    public ringSpriteFrame: SpriteFrame | null = null;
    @property({ type: Prefab })
    public confettiPrefab: Prefab | null = null;
    @property({ type: AudioSource })
    public itemCollectSound: AudioSource | null = null;
    @property({ type: AudioSource })
    public containerCompleteSound: AudioSource | null = null;
    @property(Node)
public completionCheckmark: Node | null = null; // A green checkmark or 'Done' text
    @property({ type: [Node], tooltip: 'Optional explicit target slots. If empty, the first children of this panel are used.' })
    public targetSlots: Node[] = [];

    private totalItems: number = 0;
    private collectedItems: number = 0;
    private isComplete: boolean = false;
    private originalScale: Vec3 = new Vec3(1, 1, 1);
    private collectedItemNodes: Node[] = [];
    private checkmarkNodes: Node[] = [];
    private placedVisualNodes: Node[] = [];
    private slotOriginalScales: Vec3[] = [];

    onLoad() {
        this.totalItems = this.getOrderedItems().length;
        this.updateUI();
        this.originalScale.set(this.node.scale); // Store the panel's original scale
    }

    onDestroy() {
        this.checkmarkNodes.length = 0;
    }

    public getItemCount(): number {
        return this.getOrderedItems().length;
    }

    public containsItem(itemNode: Node): boolean {
        return this.getSlotIndexForItem(itemNode) !== -1;
    }

    public getSlotIndexForItem(itemNode: Node): number {
        return (this.collectibleItems || []).indexOf(itemNode);
    }

    public collectItem(
        itemNode: Node,
        spriteFrame: SpriteFrame,
        worldPos: Vec3,
        hideSourceItem: boolean = true,
        sourceDisplayNode: Node | null = null,
        onPlaced: (() => void) | null = null
    ): boolean {
        if (this.isComplete || !itemNode || !spriteFrame) return false;

        const itemIndex = this.getSlotIndexForItem(itemNode);
        if (itemIndex === -1 || this.collectedItemNodes.indexOf(itemNode) !== -1) {
            return false;
        }

        const slotIndex = this.getNextPlacementSlotIndex();
        if (slotIndex === -1) return false;

        if (hideSourceItem) {
            itemNode.getComponent(CollectibleCoin)?.onCollectionStart();
        }
        if (sourceDisplayNode && sourceDisplayNode.isValid) {
            sourceDisplayNode.active = false;
        }

        this.playCollectionEffects(itemNode, spriteFrame, worldPos, slotIndex, sourceDisplayNode, onPlaced);
        return true;
    }

    private getNextPlacementSlotIndex(): number {
        const slotCount = Math.max(this.targetSlots.length, this.node.children.length, this.getOrderedItems().length);
        return this.collectedItemNodes.length < slotCount ? this.collectedItemNodes.length : -1;
    }

    private getOrderedItems(): Node[] {
        return (this.collectibleItems || []).filter((item): item is Node => !!item && item.isValid);
    }

    private getTargetSlot(slotIndex: number): Node | null {
        const explicitSlot = this.targetSlots && this.targetSlots[slotIndex];
        if (explicitSlot && explicitSlot.isValid) return explicitSlot;

        const childSlot = this.node.children[slotIndex];
        if (childSlot && childSlot.isValid) return childSlot;

        return this.createRuntimeSlot(slotIndex);
    }

    private createRuntimeSlot(slotIndex: number): Node {
        const slotNode = new Node(`Slot-${slotIndex + 1}`);
        this.node.addChild(slotNode);
        slotNode.addComponent(UITransform).setContentSize(80, 80);
        slotNode.addComponent(Sprite);
        slotNode.setPosition((slotIndex - 1) * 70, 0, 0);
        return slotNode;
    }

    private playCollectionEffects(
        itemNode: Node,
        flyingSpriteFrame: SpriteFrame,
        startWorldPos: Vec3,
        slotIndex: number,
        sourceDisplayNode: Node | null,
        onPlaced: (() => void) | null
    ) {
    const targetSlot = this.getTargetSlot(slotIndex) || this.itemIcon?.node || null;
    if (!targetSlot) return;
    const canvas = this.node.scene.getChildByName('Canvas');
    if (!canvas) return;

    const canvasUIT = canvas.getComponent(UITransform)!;
    const startLocalPos = canvasUIT.convertToNodeSpaceAR(startWorldPos);
    const targetLocalPos = canvasUIT.convertToNodeSpaceAR(targetSlot.worldPosition);
    const sourceScale = this.getCanvasSpaceScale(sourceDisplayNode || itemNode);
    const targetScale = this.getCanvasSpaceScale(targetSlot);
    
    const flightDuration = 0.6;
    let starSpawnTimer = 0;

    // --- 1. The Main Beam Trail ---
    const rayNode = new Node("CometTrail");
    canvas.addChild(rayNode);
    const mainGraphics = rayNode.addComponent(Graphics);

    // --- 2. The Flying Item ---
    const movingNode = new Node("FlyingItem");
    canvas.addChild(movingNode);
    const movingUIT = movingNode.addComponent(UITransform);
    const sprite = movingNode.addComponent(Sprite);
    sprite.spriteFrame = flyingSpriteFrame;
    this.copyVisualSize(targetSlot, movingUIT, sprite);
    movingNode.setPosition(startLocalPos);
    movingNode.setScale(sourceScale);

    tween(movingNode)
        .to(flightDuration, { position: targetLocalPos, scale: targetScale }, { 
            easing: 'sineIn',
            onUpdate: () => {
                const currentPos = movingNode.position;
                
                // Draw a soft golden trail behind the flying item.
                mainGraphics.clear();
                mainGraphics.lineWidth = 14;
                mainGraphics.strokeColor = new Color(255, 214, 74, 120);
                mainGraphics.moveTo(startLocalPos.x, startLocalPos.y);
                mainGraphics.lineTo(currentPos.x, currentPos.y);
                mainGraphics.stroke();

                starSpawnTimer += 0.016;
                if (starSpawnTimer > 0.035) {
                    const jitterPos = v3(
                        currentPos.x + (Math.random() - 0.5) * 34,
                        currentPos.y + (Math.random() - 0.5) * 34,
                        currentPos.z
                    );
                    this.createCodeStar(canvas, jitterPos);
                    starSpawnTimer = 0;
                }
            }
        })
       .call(() => {
            // --- THE CRITICAL FIX START ---
            
            // 1. Cleanup visuals
            movingNode.destroy();
            rayNode.destroy();
            if (sourceDisplayNode && sourceDisplayNode.isValid) {
                sourceDisplayNode.destroy();
            }

            this.settleItemInSlot(targetSlot, flyingSpriteFrame, slotIndex);

            // 2. Play UI Punch effect
            this.playCollectionBounce();

            // 3. Increment internal progress
            this.collectedItemNodes.push(itemNode);
            this.collectedItems = this.collectedItemNodes.length;
            
            // 4. Update the actual UI Bar and Numbers
            this.updateUI();

            // 5. Play sounds
            if (this.itemCollectSound) this.itemCollectSound.play();
            if (onPlaced) onPlaced();

            // 6. Check if THIS bucket is finished
            if (this.collectedItems >= this.totalItems) {
                this.onContainerComplete();
            }

            // --- THE CRITICAL FIX END ---
        })
        .start();
}

private getCanvasSpaceScale(node: Node): Vec3 {
    const worldScale = node.worldScale;
    return v3(Math.abs(worldScale.x), Math.abs(worldScale.y), 1);
}

private copyVisualSize(sizeSourceNode: Node, targetUIT: UITransform, sprite: Sprite) {
    const sourceUIT = sizeSourceNode.getComponent(UITransform);
    if (sourceUIT) {
        targetUIT.setContentSize(sourceUIT.contentSize);
        (sprite as any).sizeMode = Sprite.SizeMode.CUSTOM;
    }
}

private settleItemInSlot(targetSlot: Node, spriteFrame: SpriteFrame, slotIndex: number) {
    const visualNode = this.createSlotVisual(targetSlot, spriteFrame, slotIndex);
    const originalSlotScale = this.slotOriginalScales[slotIndex] || targetSlot.scale.clone();
    this.slotOriginalScales[slotIndex] = originalSlotScale.clone();
    targetSlot.active = true;
    visualNode.setScale(v3(0.86, 0.86, 1));
    tween(visualNode)
        .to(0.18, { scale: v3(1.08, 1.08, 1) }, { easing: 'quadOut' })
        .to(0.22, { scale: Vec3.ONE }, { easing: 'backOut' })
        .start();

    this.showSlotCheckmark(targetSlot, slotIndex);
}

private createSlotVisual(targetSlot: Node, spriteFrame: SpriteFrame, slotIndex: number): Node {
    if (this.placedVisualNodes[slotIndex] && this.placedVisualNodes[slotIndex].isValid) {
        this.placedVisualNodes[slotIndex].destroy();
    }

    const visualNode = new Node(`CollectedItemVisual-${slotIndex + 1}`);
    targetSlot.addChild(visualNode);
    visualNode.setPosition(Vec3.ZERO);

    const visualUIT = visualNode.addComponent(UITransform);
    const visualSprite = visualNode.addComponent(Sprite);
    visualSprite.spriteFrame = spriteFrame;
    this.copyVisualSize(targetSlot, visualUIT, visualSprite);
    visualSprite.enabled = true;

    this.placedVisualNodes[slotIndex] = visualNode;
    return visualNode;
}

private showSlotCheckmark(targetSlot: Node, slotIndex: number) {
    if (this.checkmarkNodes[slotIndex] && this.checkmarkNodes[slotIndex].isValid) {
        this.checkmarkNodes[slotIndex].active = true;
        return;
    }

    this.createClearSlotCheckmark(targetSlot, slotIndex);
    return;

    const checkNode = new Node(`Checkmark-${slotIndex + 1}`);
    targetSlot.addChild(checkNode);
    checkNode.addComponent(UITransform).setContentSize(42, 34);
    checkNode.setPosition(0, -45, 0);
    checkNode.setScale(v3(0, 0, 1));

    const shadow = new Node('CheckShadow');
    checkNode.addChild(shadow);
    shadow.setPosition(1.5, -1.5, 0);
    const shadowLabel = shadow.addComponent(Label);
    shadowLabel.string = '✓';
    shadowLabel.fontSize = 34;
    shadowLabel.lineHeight = 34;
    shadowLabel.color = new Color(206, 128, 0, 255);

    const front = new Node('CheckFront');
    checkNode.addChild(front);
    const label = front.addComponent(Label);
    label.string = '✓';
    label.fontSize = 34;
    label.lineHeight = 34;
    label.color = new Color(255, 234, 48, 255);

    this.checkmarkNodes[slotIndex] = checkNode;
    tween(checkNode)
        .to(0.18, { scale: v3(1.25, 1.25, 1) }, { easing: 'backOut' })
        .to(0.12, { scale: Vec3.ONE }, { easing: 'quadOut' })
        .start();
}

private createClearSlotCheckmark(targetSlot: Node, slotIndex: number) {
    const checkNode = new Node(`Checkmark-${slotIndex + 1}`);
    targetSlot.addChild(checkNode);
    checkNode.addComponent(UITransform).setContentSize(54, 42);
    checkNode.setPosition(0, -34, 0);
    checkNode.setScale(v3(0, 0, 1));

    const back = new Node('CheckBack');
    checkNode.addChild(back);
    const backLabel = back.addComponent(Label);
    backLabel.string = '\u2713';
    backLabel.fontSize = 46;
    backLabel.lineHeight = 46;
    backLabel.isBold = true;
    backLabel.color = new Color(119, 77, 0, 255);

    const middle = new Node('CheckMiddle');
    checkNode.addChild(middle);
    middle.setPosition(0, 1.5, 0);
    const middleLabel = middle.addComponent(Label);
    middleLabel.string = '\u2713';
    middleLabel.fontSize = 41;
    middleLabel.lineHeight = 41;
    middleLabel.isBold = true;
    middleLabel.color = new Color(255, 143, 0, 255);

    const front = new Node('CheckFront');
    checkNode.addChild(front);
    front.setPosition(0, 3, 0);
    const frontLabel = front.addComponent(Label);
    frontLabel.string = '\u2713';
    frontLabel.fontSize = 36;
    frontLabel.lineHeight = 36;
    frontLabel.isBold = true;
    frontLabel.color = new Color(255, 246, 72, 255);

    this.checkmarkNodes[slotIndex] = checkNode;
    tween(checkNode)
        .to(0.18, { scale: v3(1.3, 1.3, 1) }, { easing: 'backOut' })
        .to(0.12, { scale: Vec3.ONE }, { easing: 'quadOut' })
        .start();
}

private createCodeStar(parent: Node, position: Vec3) {
    const starNode = new Node("StarSparkle");
    parent.addChild(starNode);
    starNode.setPosition(position);
    starNode.setScale(v3(0.25, 0.25, 1));

    const opacityComp = starNode.addComponent(UIOpacity);
    const g = starNode.addComponent(Graphics);
    const outerRadius = 8 + Math.random() * 5;
    const innerRadius = outerRadius * 0.42;
    const points = 5;

    g.fillColor = new Color(255, 244, 106, 255);
    for (let i = 0; i < points * 2; i++) {
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const angle = -Math.PI / 2 + i * Math.PI / points;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
    }
    g.close();
    g.fill();

    g.strokeColor = new Color(255, 151, 24, 220);
    g.lineWidth = 2;
    g.stroke();

    const drift = v3((Math.random() - 0.5) * 42, 24 + Math.random() * 36, 0);
    const duration = 0.55 + Math.random() * 0.25;
    tween(starNode)
        .parallel(
            tween().by(duration, { position: drift, angle: (Math.random() > 0.5 ? 1 : -1) * 180 }, { easing: 'sineOut' }),
            tween().to(0.12, { scale: v3(1, 1, 1) }, { easing: 'backOut' }).to(duration - 0.12, { scale: v3(0.15, 0.15, 1) }),
            tween(opacityComp).delay(0.12).to(duration - 0.12, { opacity: 0 }, { easing: 'quadIn' })
        )
        .call(() => starNode.destroy())
        .start();
}
    
    // --- NEW: A dedicated function for the UI panel's animation ---
    private playCollectionBounce() {
        // Stop any previous animations on this node to prevent conflicts
        tween(this.node).stop();
        // Reset scale instantly in case a previous animation was interrupted
        this.node.setScale(this.originalScale);

        tween(this.node)
            // 1. Quickly scale up to give a 'punch' effect
            .to(0.1, { scale: new Vec3(this.originalScale.x * 1.15, this.originalScale.y * 1.15, this.originalScale.z) }, { easing: 'quadOut' })
            // 2. Return to the original scale with a nice bouncy feel
            .to(0.4, { scale: new Vec3(this.originalScale.x, this.originalScale.y, this.originalScale.z) }, { easing: 'elasticOut' })
            .start();
    }
    // ---

    private updateUI() {
        if (this.progressBar) {
            this.progressBar.progress = this.totalItems > 0 ? this.collectedItems / this.totalItems : 0;
        }
       if (this.progressLabel) { // This check is 'false' because progressLabel is null!
        // This line is NEVER RUNNING for the Apple container
        this.progressLabel.string = `${this.collectedItems}/${this.totalItems}`;
    }
    }

  // Inside CollectionContainer.ts
private onContainerComplete() {
    if (this.isComplete) return;
    this.isComplete = true;

    if (this.containerCompleteSound) this.containerCompleteSound.play();
    director.emit(CONTAINER_COMPLETE_EVENT, this);

    // 1. Scale Up Animation (Celebration)
    tween(this.node)
        .to(0.2, { scale: v3(1.15, 1.15, 1) }, { easing: 'quadOut' })
        .delay(0.4)
        .call(() => {
            // 2. Disappear Animation
            tween(this.node.getComponent(UIOpacity) || this.node.addComponent(UIOpacity))
                .to(0.3, { opacity: 0 })
                .start();

            tween(this.node)
                .to(0.3, { scale: v3(0, 0, 0) }, { easing: 'backIn' })
                .call(() => {
                    this.node.active = false;
                })
                .start();
        })
        .start();
}
    public resetContainer() {
        if (!this.node || !this.node.isValid) return;

        this.collectedItems = 0;
        this.isComplete = false;
        this.collectedItemNodes.length = 0;
        this.totalItems = this.getOrderedItems().length;
        this.checkmarkNodes.forEach((node) => {
            if (node && node.isValid) node.destroy();
        });
        this.checkmarkNodes.length = 0;
        this.placedVisualNodes.forEach((node) => {
            if (node && node.isValid) node.destroy();
        });
        this.placedVisualNodes.length = 0;
        const opacity = this.node.getComponent(UIOpacity) || this.node.addComponent(UIOpacity);
        opacity.opacity = 255;
        this.node.setScale(this.originalScale);
        this.updateUI();
    }
}
