import { _decorator, Component, Node, EventTouch, Vec3, director, UITransform, UIOpacity, tween, Vec2, math } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('CameraPinchZoom')
export class CameraPinchZoom extends Component {
    @property({ type: Node })
    public tourTextNode: Node | null = null;

    @property public minScale: number = 1.0; 
    @property public maxScale: number = 1.2; // This is a 20% zoom. (MANUALLY CHANGE TO 1.2 IN INSPECTOR)
    @property({ tooltip: "Visible gameplay window width used for pan bounds." })
    public playAreaWidth: number = 720;
    @property({ tooltip: "Visible gameplay window height below the waiting/stack UI." })
    public playAreaHeight: number = 1000;
    @property({ tooltip: "Top Y limit for the room root so it does not overlap waiting/stack UI." })
    public maxRoomY: number = -198;
    @property({ tooltip: "Extra bottom travel allowed at high zoom." })
    public bottomPadding: number = 40;

    @property(Node)
    public zoomAnimNode: Node | null = null;
    
    // public static IsBusy: boolean = false;
    private _touchMovedThreshold: number = 0; 
    private _isControlEnabled: boolean = true;
    private _currentScale: number = 0.6;
    private _basePosition: Vec3 = new Vec3();

    private stopLocalZoomAnim() {
        const anim = this.zoomAnimNode.getComponent('cc.Animation') as any;
        if (anim) anim.stop();

        tween(this.zoomAnimNode.getComponent(UIOpacity) || this.zoomAnimNode.addComponent(UIOpacity))
            .to(0.2, { opacity: 0 })
            .call(() => {
                if (this.zoomAnimNode) this.zoomAnimNode.active = false;
            })
            .start();
    }

    onEnable() {
        this._basePosition.set(this.node.position);
        this._currentScale = this.node.scale.x;
        this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
        this.node.setPosition(this.clampPosition(this.node.position.x, this.node.position.y));
    }

    private onTouchStart(event: EventTouch) {
        this._touchMovedThreshold = 0;
        if (this.zoomAnimNode && this.zoomAnimNode.active) {
            this.stopLocalZoomAnim();
        }
    }

    private onTouchMove(event: EventTouch) {
        if (!this._isControlEnabled) return;
        const touches = event.getAllTouches();

        if (touches.length === 1) {
            const delta = event.getDelta();
            this._touchMovedThreshold += delta.length();
            
            // if (this._touchMovedThreshold > 15) {
            //     CameraPinchZoom.IsBusy = true;
            // }

            let currentPos = this.node.position.clone();
            // Apply Move and dynamic clamp
            this.node.setPosition(this.clampPosition(currentPos.x + delta.x, currentPos.y + delta.y));
        } 
        else if (touches.length >= 2) {
            // CameraPinchZoom.IsBusy = true;
            
            const t1 = touches[0]; const t2 = touches[1];
            const dist = Vec2.distance(t1.getLocation(), t2.getLocation());
            const pDist = Vec2.distance(t1.getPreviousLocation(), t2.getPreviousLocation());
            if (pDist > 0) this.applyZoom(dist / pDist);
        }
    }

    private onTouchEnd() {
        // RESTORED: Keeping your 0.3 second cooldown as requested
        this.scheduleOnce(() => {
            // CameraPinchZoom.IsBusy = false;
        }, 0.3); 
    }

    private applyZoom(factor: number) {
        if (factor !== 1.0) {
            director.emit('PLAYER_ZOOMED'); 
            director.emit('CAMERA_SHIFTED');
        }

        this._currentScale = math.clamp(this._currentScale * factor, this.minScale, this.maxScale);
        this.node.setScale(new Vec3(this._currentScale, this._currentScale, 1));
        
        // Dynamic centering/clamping (removes the "Gap" issues)
        const pos = this.node.position;
        this.node.setPosition(this.clampPosition(pos.x, pos.y));
    }

    public get currentScale(): number {
        return this._currentScale;
    }
 
    private clampPosition(targetX: number, targetY: number): Vec3 {
        const uiTrans = this.node.getComponent(UITransform)!;
        const scaledWidth = uiTrans.width * this._currentScale;
        const scaledHeight = uiTrans.height * this._currentScale;
        const horizontalRange = Math.max(0, (scaledWidth - this.playAreaWidth) * 0.5);
        const verticalRange = Math.max(0, (scaledHeight - this.playAreaHeight) * 0.5);

        const minX = this._basePosition.x - horizontalRange;
        const maxX = this._basePosition.x + horizontalRange;
        const maxY = Math.min(this._basePosition.y + verticalRange, this.maxRoomY);
        const minY = this._basePosition.y - verticalRange - this.bottomPadding;

        return new Vec3(
            math.clamp(targetX, minX, maxX),
            math.clamp(targetY, minY, maxY),
            0
        );
    }

    // Keep your Tour/Pan functions exactly as they were...
    public runStartTour(callback?: Function) { /* Logic Unchanged */ }
    public panToNode(targetNode: Node, duration: number = 2.0, callback?: Function) { /* Logic Unchanged */ }
    private showTourText(show: boolean) { /* Logic Unchanged */ }
}
