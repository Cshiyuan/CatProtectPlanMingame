import { _decorator, Component, Node, Graphics, Label, Color, UITransform, Layers, EventTouch, Vec3 } from 'cc';
import { LiangshanModel, PATH, SITES, TOWERS, ENEMIES, TOWER_KINDS, TowerKind, distance } from './LiangshanModel';
const { ccclass }=_decorator;
const C=(hex:string,a=255):Color=>{const n=parseInt(hex.slice(1),16);return new Color((n>>16)&255,(n>>8)&255,n&255,a);};
@ccclass('LiangshanBattle')
export class LiangshanBattle extends Component {
    private model=new LiangshanModel();
    private gfx:Graphics|null=null;
    private labels:Label[]=[];
    private siteLabels:Label[]=[];
    private selectedSite:number|null=null;
    private menu=false;
    private moving=false;
    private frame=0;
    private readonly xs=[-264,-88,88,264];
    protected onLoad():void{
        this.node.layer=Layers.Enum.UI_2D;
        let tr=this.node.getComponent(UITransform);
        if(!tr)tr=this.node.addComponent(UITransform);
        tr.setContentSize(720,1280);
        const host=this.node.parent?.getComponent(UITransform)?.contentSize;
        if(host){const scale=Math.min(host.width/720,host.height/1280);this.node.setScale(scale,scale,1);}
        this.gfx=this.node.addComponent(Graphics);
        for(const [i,text,x,y,size,w] of [
            [0,'梁山保卫战',0,580,44,640],[1,'',0,530,23,675],[2,'',0,488,22,680],
            [3,'发兵迎敌',257,483,21,175],[4,'',0,-428,19,695],
            [5,'',-264,-504,18,166],[6,'',-88,-504,18,166],[7,'',88,-504,18,166],[8,'',264,-504,18,166],
            [9,'武松调遣',-264,-583,18,162],[10,'升级箭楼',-88,-583,18,162],
            [11,'撤除塔楼',88,-583,18,162],[12,'景阳冈猛击',264,-583,18,162]
        ] as Array<[number,string,number,number,number,number]>) {
            this.labels[i]=this.makeLabel(text,x,y,size,w);
        }
        for(const s of SITES)this.siteLabels[s.id]=this.makeLabel('＋',s.x,s.y,34,68);
        this.node.on(Node.EventType.TOUCH_END,this.onTouch,this);
        this.render();
    }
    protected onDestroy():void{this.node.off(Node.EventType.TOUCH_END,this.onTouch,this);}
    protected update(dt:number):void {
        this.model.tick(dt);
        this.frame+=dt;
        if(this.frame>.06){this.frame=0;this.render();}
    }
    private makeLabel(text:string,x:number,y:number,size:number,width:number):Label{
        const n=new Node('BattleText');n.parent=this.node;n.layer=Layers.Enum.UI_2D;
        const t=n.addComponent(UITransform);t.setContentSize(width,size+15);
        n.setPosition(x,y);
        const l=n.addComponent(Label);l.string=text;l.fontSize=size;l.lineHeight=size+3;l.color=C('#f9edc7');
        l.horizontalAlign=Label.HorizontalAlign.CENTER;l.verticalAlign=Label.VerticalAlign.CENTER;l.overflow=Label.Overflow.SHRINK;
        return l;
    }
    private box(g:Graphics,x:number,y:number,w:number,h:number,hex:string):void{g.fillColor=C(hex);g.rect(x,y,w,h);g.fill();}
    private circle(g:Graphics,x:number,y:number,r:number,hex:string):void{g.fillColor=C(hex);g.circle(x,y,r);g.fill();}
    private stroke(g:Graphics,pts:ReadonlyArray<{x:number;y:number}>,width:number,hex:string):void{
        g.lineWidth=width;g.strokeColor=C(hex);g.lineCap=1;g.lineJoin=1;g.moveTo(pts[0].x,pts[0].y);
        for(let i=1;i<pts.length;i++)g.lineTo(pts[i].x,pts[i].y);g.stroke();
    }
    private health(g:Graphics,x:number,y:number,width:number,fraction:number,hex:string):void{
        this.box(g,x-width/2,y,width,5,'#382d24');this.box(g,x-width/2+1,y+1,(width-2)*Math.max(0,Math.min(1,fraction)),3,hex);
    }
    private render():void{
        const g=this.gfx;if(!g)return;g.clear();
        // Five-layer battlefield. All art is procedural; no borrowed copyrighted sprites.
        this.box(g,-360,-640,720,1280,'#cad7b8');
        this.box(g,-360,445,720,195,'#21382f');
        for(let i=0;i<11;i++){
            const x=-360+i*76;
            this.circle(g,x,420-(i%3)*16,56,i%2?'#829d78':'#a0b58a');
            this.circle(g,x-10,410-(i%3)*16,37,'#b8c9a0');
        }
        for(let i=0;i<50;i++){
            const x=-341+(i*139)%690,y=-385+(i*83)%801;
            this.circle(g,x,y,2+(i%4),i%2?'#aec59d':'#99b78a');
        }
        this.stroke(g,PATH,86,'#82936d');this.stroke(g,PATH,74,'#ba9f76');
        this.stroke(g,PATH,65,'#d1b892');this.stroke(g,PATH,2,'#e5d0ae');
        this.box(g,286,111,74,120,'#694e36');
        for(let i=0;i<6;i++)this.box(g,284+i*13,210,10,28,'#896944');
        this.box(g,304,125,35,72,'#392d25');
        // Fixed construction foundations.
        for(const s of SITES){
            const t=this.model.getTower(s.id);
            this.circle(g,s.x,s.y-3,47,'#706d51');
            this.circle(g,s.x,s.y+2,41,t?TOWERS[t.kind].color:'#cab895');
            this.circle(g,s.x,s.y+7,34,t?'#746249':'#e9dbbc');
            if(t){
                this.box(g,s.x-26,s.y-18,52,35,TOWERS[t.kind].color);
                this.box(g,s.x-31,s.y+8,62,13,'#4f4638');
                this.box(g,s.x-23,s.y+19,46,13,'#a78c64');
                if(t.kind==='archer')this.stroke(g,[{x:s.x-12,y:s.y+26},{x:s.x+13,y:s.y+34}],4,'#dcd5a0');
                else if(t.kind==='magic')this.circle(g,s.x,s.y+29,9,'#d9c3f3');
                else if(t.kind==='cannon')this.box(g,s.x-12,s.y+29,25,9,'#442e23');
            }
            if(this.selectedSite===s.id){
                g.lineWidth=4;g.strokeColor=C('#fce2a1');g.circle(s.x,s.y,50);g.stroke();
                if(t&&t.kind!=='barracks'){
                    g.lineWidth=2;g.strokeColor=C('#e7c47e',130);g.circle(s.x,s.y,TOWERS[t.kind].range);g.stroke();
                }
            }
            this.siteLabels[s.id].string=t?'Lv.'+t.level:'＋';
            this.siteLabels[s.id].node.setPosition(s.x,s.y-4);
        }
        for(const s of this.model.soldiers){
            this.circle(g,s.x,s.y-3,16,'#304455');this.circle(g,s.x,s.y+3,12,'#497d88');
            this.circle(g,s.x-2,s.y+10,6,'#efc99c');this.health(g,s.x,s.y+21,30,s.hp/s.maxHp,'#75b58d');
        }
        for(const e of this.model.enemies){
            if(e.dead)continue;
            const r=e.kind==='commander'?29:e.kind==='shield'?21:16;
            this.circle(g,e.x,e.y-4,r+4,'#544333');
            this.circle(g,e.x,e.y,r,ENEMIES[e.kind].color);
            this.circle(g,e.x-3,e.y+7,r*.4,'#e0b895');
            if(e.kind==='shield')this.box(g,e.x-15,e.y-4,16,21,'#bbc1c3');
            if(e.kind==='crossbow')this.stroke(g,[{x:e.x-14,y:e.y-8},{x:e.x+12,y:e.y+7}],3,'#6d4e34');
            this.health(g,e.x,e.y+r+10,e.kind==='commander'?67:39,e.hp/e.maxHp,'#d46c57');
            if(e.blockedBy!==null)this.circle(g,e.x,e.y+r+19,3,'#f6d57d');
        }
        const h=this.model.hero;
        if(h.hp>0){
            this.circle(g,h.x,h.y-3,28,'#573a2d');this.circle(g,h.x,h.y,23,'#ba8843');
            this.circle(g,h.x-3,h.y+10,11,'#f0c9a0');
            this.stroke(g,[{x:h.x-20,y:h.y-16},{x:h.x+22,y:h.y+17}],6,'#f7e9ce');
            this.health(g,h.x,h.y+35,50,h.hp/h.maxHp,'#6bc4ae');
        }
        for(const fx of this.model.effects){
            g.lineWidth=fx.type==='skill'?10:4;
            g.strokeColor=C(fx.type==='skill'?'#f9db70':fx.type==='magic'?'#d1a2f2':'#f2d2a0',195);
            g.circle(fx.x,fx.y,fx.radius*(.9+fx.time*.2));g.stroke();
        }
        // Command panels
        this.box(g,-360,457,720,183,'#243d32');
        this.box(g,-360,452,720,7,'#c09b5c');
        this.box(g,-360,-640,720,215,'#253b33');
        this.box(g,-360,-439,720,7,'#c09b5c');
        this.box(g,171,461,181,50,this.model.status==='battle'?'#617260':'#9c6738');
        for(let i=0;i<4;i++){
            const x=this.xs[i],active=this.selectedSite!==null&&this.model.getTower(this.selectedSite)===undefined;
            this.box(g,x-80,-533,160,64,active?'#926c43':'#476053');
            this.box(g,x-80,-615,160,62,'#44594d');
            this.labels[5+i].string=TOWERS[TOWER_KINDS[i]].hero+' '+TOWERS[TOWER_KINDS[i]].cost+'两';
        }
        if(this.menu&&this.selectedSite!==null){
            const s=this.model.getSite(this.selectedSite)!;
            const x=Math.min(240,Math.max(-240,s.x)),y=Math.min(310,Math.max(-250,s.y+92));
            this.box(g,x-168,y-33,336,65,'#293d35');
            this.labels[4].string='请选择塔型建造，或点其他塔基';
        }else this.labels[4].string=this.model.message;
        this.labels[1].string='银两 '+this.model.gold+'     梁山寨 '+this.model.lives+'/20     击退 '+this.model.kills;
        this.labels[2].string='第 '+Math.max(1,this.model.wave)+'/5 波    '+(this.model.status==='battle'?'官兵来犯':this.model.status==='ready'?'整军备战':this.model.status==='win'?'梁山大捷':'梁山失守');
        this.labels[3].string=this.model.ended?'再战一局':this.model.status==='battle'?'迎击中':'开始进攻';
        this.labels[12].string=this.model.hero.cooldown?'猛击 '+Math.ceil(this.model.hero.cooldown)+'s':'景阳冈猛击';
    }
    private onTouch(event:EventTouch):void{
        const ui=event.getUILocation();
        const local=this.node.getComponent(UITransform)!.convertToNodeSpaceAR(new Vec3(ui.x,ui.y,0));
        const x=local.x,y=local.y;
        if(y>455&&x>160){
            if(this.model.ended){this.model.reset();this.selectedSite=null;this.moving=false;}
            else this.model.startWave();
        }else if(y>-538&&y<-460){
            const i=this.which(x);
            if(i>=0&&this.selectedSite!==null){
                if(this.model.getTower(this.selectedSite))this.model.message='此处已有塔，先升级或拆除';
                else this.model.build(this.selectedSite,TOWER_KINDS[i]);
                this.menu=false;
            }else this.model.message='请先点击地图上的建塔点';
        }else if(y>-618&&y<-547){
            const i=this.which(x);
            if(i===0){this.moving=true;this.model.message='点击战场调遣武松';}
            if(i===1&&this.selectedSite!==null)this.model.upgrade(this.selectedSite);
            if(i===2&&this.selectedSite!==null)this.model.sell(this.selectedSite);
            if(i===3)this.model.cast();
        }else if(y>-415&&y<445){
            const s=SITES.find(p=>distance(p,{x,y})<52);
            if(s){this.selectedSite=s.id;this.menu=!this.model.getTower(s.id);this.moving=false;}
            else if(this.moving){this.model.moveHero({x,y});this.moving=false;}
            else{this.selectedSite=null;this.menu=false;}
        }
        this.render();
    }
    private which(x:number):number {return this.xs.findIndex(p=>Math.abs(x-p)<80);}
}