import { _decorator, Component, Node } from 'cc';
import { GameBootstrap } from './systems/GameBootstrap';
import { LiangshanBattle } from './shuihu/LiangshanBattle';
const { ccclass, property } = _decorator;

/**
 * Scene entry: enable Liangshan battle by default; disable the toggle
 * to load the original CatProtectPlan game unchanged.
 */
@ccclass('GameScene')
export class GameScene extends Component {
    @property({ tooltip: '原版猫咪游戏启动器', type: GameBootstrap })
    public gameBootstrap: GameBootstrap | null = null;

    @property({ tooltip: '启动梁山保卫战垂直切片（关闭可回原版）' })
    public useLiangshanBattle: boolean = true;

    protected onLoad(): void {
        if (this.useLiangshanBattle) {
            const battleNode = new Node('LiangshanBattle');
            battleNode.parent = this.node;
            battleNode.addComponent(LiangshanBattle);
            return;
        }
        if (!this.gameBootstrap) {
            const node = new Node('GameBootstrap');
            node.parent = this.node;
            this.gameBootstrap = node.addComponent(GameBootstrap);
        }
    }

    protected start(): void {
        if (this.useLiangshanBattle) return;
        const state = this.gameBootstrap?.getInitializationState();
        if (state?.isFailed) console.error('[GameScene] 原版游戏初始化失败');
    }

    public getGameStatus(): { isInitialized: boolean; hasBootstrap: boolean; initPhase: string; canPlay: boolean } {
        if (this.useLiangshanBattle) return {isInitialized:true,hasBootstrap:false,initPhase:'liangshan',canPlay:true};
        const state = this.gameBootstrap?.getInitializationState();
        return {
            isInitialized: !!state?.isCompleted,
            hasBootstrap: !!this.gameBootstrap,
            initPhase: state?.phase || 'none',
            canPlay: !!state?.isCompleted && !state?.isFailed
        };
    }
}
