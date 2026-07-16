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
        return this.getOrderedItems().indexOf(itemNode);
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

        const slotIndex = this.getSlotIndexForItem(itemNode);
        if (slotIndex === -1 || this.collectedItemNodes.indexOf(itemNode) !== -1) {
            return false;
        }

        if (hideSourceItem) {
            itemNode.getComponent(CollectibleCoin)?.onCollectionStart();
        }
        if (sourceDisplayNode && sourceDisplayNode.isValid) {
            sourceDisplayNode.active = false;
        }

        this.playCollectionEffects(itemNode, spriteFrame, worldPos, slotIndex, sourceDisplayNode, onPlaced);
        return true;
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
                
                // DRAW THE BLUE BEAM
                mainGraphics.clear();
                mainGraphics.lineWidth = 18;
                mainGraphics.strokeColor = new Color(80, 180, 255, 150);
                mainGraphics.moveTo(startLocalPos.x, startLocalPos.y);
                mainGraphics.lineTo(currentPos.x, currentPos.y);
                mainGraphics.stroke();

               // Inside your tween(movingNode).to updates
starSpawnTimer += 0.016; 
if (starSpawnTimer > 0.02) { // Slightly slower spawn rate for bigger flakes
    const jitterPos = v3(
        currentPos.x + (Math.random() - 0.5) * 30, // Wider trail
        currentPos.y + (Math.random() - 0.5) * 30, 
        currentPos.z
    );
    this.createCodeSnow(canvas, jitterPos);
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
    const targetSprite = targetSlot.getComponent(Sprite);
    if (targetSprite) {
        targetSprite.spriteFrame = spriteFrame;
        targetSprite.enabled = true;
    }
    const originalSlotScale = this.slotOriginalScales[slotIndex] || targetSlot.scale.clone();
    this.slotOriginalScales[slotIndex] = originalSlotScale.clone();
    targetSlot.active = true;
    targetSlot.setScale(v3(originalSlotScale.x * 0.92, originalSlotScale.y * 0.92, originalSlotScale.z));
    tween(targetSlot)
        .to(0.18, { scale: v3(originalSlotScale.x * 1.08, originalSlotScale.y * 1.08, originalSlotScale.z) }, { easing: 'quadOut' })
        .to(0.22, { scale: originalSlotScale }, { easing: 'backOut' })
        .start();

    this.showSlotCheckmark(targetSlot, slotIndex);
}

private showSlotCheckmark(targetSlot: Node, slotIndex: number) {
    if (this.checkmarkNodes[slotIndex] && this.checkmarkNodes[slotIndex].isValid) {
        this.checkmarkNodes[slotIndex].active = true;
        return;
    }

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

/**
 * Creates a snowflake sparkle node entirely from code (no image files needed)
 */
/**
 * Creates a soft snowflake particle entirely from code
 */
private createCodeSnow(parent: Node, position: Vec3) {
    const snowNode = new Node("Snowflake");
    parent.addChild(snowNode);
    snowNode.setPosition(position);
    
    // Add UIOpacity so we can fade them out smoothly
    const opacityComp = snowNode.addComponent(UIOpacity);
    const g = snowNode.addComponent(Graphics);
    
    // 1. Drawing a soft round snowflake
    const size = 3 + Math.random() * 6; // Variety in snow size
    g.fillColor = new Color(255, 255, 255, 255); // Pure White
    g.circle(0, 0, size);
    g.fill();

    // 2. Add a slight "glow" or blur look (optional second circle)
    g.fillColor = new Color(255, 255, 255, 100); 
    g.circle(0, 0, size * 1.5);
    g.fill();

    // 3. Movement Logic: "Swaying Flutter"
    // Drift down significantly, but sway left and right like real snow
    const driftY = -(80 + Math.random() * 60);  // Falling down
    const swayX = (Math.random() - 0.5) * 50;   // Random horizontal drift
    const duration = 1.0 + Math.random() * 0.5; // Each flake lasts ~1-1.5s

    tween(snowNode)
        .parallel(
            // Position: Drifts down and sways
            tween().by(duration, { position: v3(swayX, driftY, 0) }, { easing: 'sineOut' }),
            // Scale: Shrinks slowly as it disappears
            tween().to(duration, { scale: v3(0.2, 0.2, 1) }),
            // Opacity: Fades out
            tween(opacityComp).to(duration, { opacity: 0 }, { easing: 'quadIn' })
        )
        .call(() => snowNode.destroy())
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
        const opacity = this.node.getComponent(UIOpacity) || this.node.addComponent(UIOpacity);
        opacity.opacity = 255;
        this.node.setScale(this.originalScale);
        this.updateUI();
    }
}
