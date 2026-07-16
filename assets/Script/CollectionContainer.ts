// FILE: CollectionContainer.ts (Final version with UI Panel Animation)

import { _decorator, Component, Node, Label, ProgressBar, director, Vec3,Layout,Size, tween, Sprite, SpriteFrame, AudioSource, UITransform, UIOpacity, Prefab, instantiate, ParticleSystem2D, v3, Color, Graphics } from 'cc';
import { CollectibleCoin, COLLECT_COIN_EVENT } from './CollectibleCoin';


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

    private totalItems: number = 0;
    private collectedItems: number = 0;
    private isComplete: boolean = false;
    private originalScale: Vec3 = new Vec3(1, 1, 1);

    onLoad() {
         if (this.collectibleItems) {
        this.totalItems = this.collectibleItems.length;
    } else {
        this.totalItems = 0;
        console.warn("No items assigned to container:", this.node.name);
    }
        this.totalItems = this.collectibleItems.length;
        this.updateUI();
        director.on(COLLECT_COIN_EVENT, this.onItemClicked, this);
        this.originalScale.set(this.node.scale); // Store the panel's original scale
    }

    onDestroy() {
        director.off(COLLECT_COIN_EVENT, this.onItemClicked, this);
    }

    private onItemClicked(itemNode: Node, spriteFrame: SpriteFrame, worldPos: Vec3) {
        if (this.isComplete || this.collectibleItems.indexOf(itemNode) === -1) {
            return;
        }
        itemNode.getComponent(CollectibleCoin)?.onCollectionStart();
        this.playCollectionEffects(spriteFrame, worldPos);
    }

    private playCollectionEffects(flyingSpriteFrame: SpriteFrame, startWorldPos: Vec3) {
    if (!this.itemIcon) return;
    const canvas = this.node.scene.getChildByName('Canvas');
    if (!canvas) return;

    const canvasUIT = canvas.getComponent(UITransform)!;
    const startLocalPos = canvasUIT.convertToNodeSpaceAR(startWorldPos);
    const targetLocalPos = canvasUIT.convertToNodeSpaceAR(this.itemIcon.node.worldPosition);
    
    const flightDuration = 0.6;
    let starSpawnTimer = 0;

    // --- 1. The Main Beam Trail ---
    const rayNode = new Node("CometTrail");
    canvas.addChild(rayNode);
    const mainGraphics = rayNode.addComponent(Graphics);

    // --- 2. The Flying Item ---
    const movingNode = new Node("FlyingItem");
    canvas.addChild(movingNode);
    const sprite = movingNode.addComponent(Sprite);
    sprite.spriteFrame = flyingSpriteFrame;
    movingNode.setPosition(startLocalPos);
    movingNode.setScale(1, 1, 1);

    tween(movingNode)
        .to(flightDuration, { position: targetLocalPos, scale: v3(0.6, 0.6, 1) }, { 
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

            // 2. Play UI Punch effect
            this.playCollectionBounce();

            // 3. Increment internal progress
            this.collectedItems++;
            
            // 4. Update the actual UI Bar and Numbers
            this.updateUI();

            // 5. Play sounds
            if (this.itemCollectSound) this.itemCollectSound.play();

            // 6. Check if THIS bucket is finished
            if (this.collectedItems >= this.totalItems) {
                this.onContainerComplete();
            }

            // --- THE CRITICAL FIX END ---
        })
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

    // 1. Scale Up Animation (Celebration)
    tween(this.node)
        .to(0.2, { scale: v3(1.15, 1.15, 1) }, { easing: 'quadOut' })
        .delay(0.4)
        .call(() => {
            // Tell GameManager to realign the other containers NOW
            // We pass this node so the manager knows which one to ignore
            director.emit('REARRANGE_CONTAINERS', this.node);

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
        this.collectedItems = 0;
        this.isComplete = false;
        this.updateUI();
    }
}
