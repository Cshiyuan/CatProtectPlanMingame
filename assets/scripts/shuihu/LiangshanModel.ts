/**
 * 梁山保卫战 — 独立战斗模型（无需 Cocos 依赖）
 * 目标: 保留原工程，新增真正具有兵营拦截、近战交战、远程攻击与主动英雄的单关垂直切片。
 */
export type TowerKind = 'archer' | 'barracks' | 'cannon' | 'magic';
export type EnemyKind = 'militia' | 'scout' | 'shield' | 'crossbow' | 'commander';
export type BattleStatus = 'ready' | 'battle' | 'win' | 'lose';
export interface Point { x: number; y: number }
export interface BuildSite extends Point { id: number }
export interface TowerDef { name: string; hero: string; cost: number; range: number; damage: number; period: number; color: string }
export interface EnemyDef { name: string; hp: number; speed: number; armor: number; atk: number; gold: number; leak: number; color: string }
export interface Tower { site: number; kind: TowerKind; level: number; cooldown: number; recruit: number }
export interface Enemy extends Point { id: number; kind: EnemyKind; hp: number; maxHp: number; progress: number; blockedBy: number | null; attackTimer: number; slow: number; stun: number; dead: boolean }
export interface Soldier extends Point { id: number; site: number; hp: number; maxHp: number; guard: Point; attackTimer: number }
export interface Effect extends Point { type: 'arrow' | 'blast' | 'magic' | 'strike' | 'skill'; time: number; radius: number }
export interface Hero extends Point { target: Point; hp: number; maxHp: number; attackTimer: number; cooldown: number; revive: number }

export const PATH: Point[] = [
    { x:-410, y:244 }, { x:-210, y:244 }, { x:-210, y:63 },
    { x:-42, y:63 }, { x:-42, y:-172 }, { x:115, y:-172 },
    { x:115, y:174 }, { x:250, y:174 }, { x:410, y:174 },
];
export const SITES: BuildSite[] = [
    { id:0, x:-310, y:350 }, { id:1, x:-60, y:330 }, { id:2, x:-320, y:-75 },
    { id:3, x:61, y:12 }, { id:4, x:-32, y:-323 },
    { id:5, x:265, y:-65 }, { id:6, x:278, y:338 },
];
export const TOWER_KINDS: TowerKind[] = ['archer','barracks','cannon','magic'];
export const TOWERS: Record<TowerKind, TowerDef> = {
    archer:   {name:'神射营', hero:'花荣',  cost:65,  range:185, damage:22, period:0.83, color:'#387667'},
    barracks: {name:'梁山兵营',hero:'林冲',  cost:90,  range:0,   damage:16, period:0.82, color:'#456c85'},
    cannon:   {name:'震天炮', hero:'李逵',  cost:110, range:166, damage:40, period:1.82, color:'#ba6e42'},
    magic:    {name:'天师观', hero:'公孙胜',cost:100, range:175, damage:29, period:1.28, color:'#806aa7'},
};
export const ENEMIES: Record<EnemyKind, EnemyDef> = {
    militia:  {name:'官兵',    hp:88,  speed:42, armor:0, atk:12,gold:18, leak:1,color:'#a95041'},
    scout:    {name:'斥候',    hp:56,  speed:68, armor:0, atk:9, gold:16, leak:1,color:'#b3824a'},
    shield:   {name:'盾甲兵',  hp:185, speed:30, armor:9, atk:16,gold:28, leak:2,color:'#7c8390'},
    crossbow: {name:'禁军弩手',hp:108, speed:38, armor:2, atk:13,gold:24, leak:1,color:'#9b5c61'},
    commander:{name:'禁军统领',hp:1100,speed:21, armor:11,atk:34,gold:220,leak:5,color:'#913e46'},
};
export const WAVES: EnemyKind[][] = [
    ['militia','militia','scout','militia','scout','militia'],
    ['scout','militia','shield','scout','militia','shield','scout'],
    ['shield','crossbow','militia','scout','shield','crossbow','militia','scout'],
    ['shield','shield','scout','crossbow','scout','shield','militia','crossbow','shield'],
    ['crossbow','shield','shield','commander','scout','shield','crossbow','militia'],
];
const lengths = PATH.slice(1).map((v,i)=>Math.hypot(v.x-PATH[i].x,v.y-PATH[i].y));
export const PATH_LENGTH = lengths.reduce((a,b)=>a+b,0);
export const distance = (a:Point,b:Point):number => Math.hypot(a.x-b.x,a.y-b.y);
export function pathAt(progress:number): Point {
    let rem=Math.max(0, Math.min(PATH_LENGTH,progress));
    for(let i=0;i<lengths.length;i++){
        if(rem<=lengths[i]) {
            const ratio=lengths[i]?rem/lengths[i]:0;
            return {x:PATH[i].x+(PATH[i+1].x-PATH[i].x)*ratio,y:PATH[i].y+(PATH[i+1].y-PATH[i].y)*ratio};
        }
        rem-=lengths[i];
    }
    return {...PATH[PATH.length-1]};
}
export function nearestRoad(pos:Point):Point {
    let best=PATH[0], d=Infinity;
    for(let i=0;i<PATH.length-1;i++){
        const a=PATH[i],b=PATH[i+1],dx=b.x-a.x,dy=b.y-a.y;
        const t=Math.max(0,Math.min(1,((pos.x-a.x)*dx+(pos.y-a.y)*dy)/(dx*dx+dy*dy)));
        const p={x:a.x+t*dx,y:a.y+t*dy},n=distance(p,pos);
        if(n<d){d=n;best=p;}
    }
    return {...best};
}
function towards(from:Point,to:Point,step:number):Point {
    const n=distance(from,to); if(n===0||step>=n)return {...to};
    return {x:from.x+(to.x-from.x)*step/n,y:from.y+(to.y-from.y)*step/n};
}

export class LiangshanModel {
    status:BattleStatus='ready';
    gold=375;
    lives=20;
    wave=0;
    kills=0;
    message='点选空地，修建梁山防线';
    readonly towers:Tower[]=[];
    readonly enemies:Enemy[]=[];
    readonly soldiers:Soldier[]=[];
    readonly effects:Effect[]=[];
    readonly hero:Hero={x:3,y:-313,target:{x:3,y:-313},hp:260,maxHp:260,attackTimer:0,cooldown:0,revive:0};
    private nextId=1;
    private pending:EnemyKind[]=[];
    private spawnTimer=0;

    getTower(site:number):Tower|undefined{return this.towers.find(t=>t.site===site);}
    getSite(site:number):BuildSite|undefined{return SITES.find(s=>s.id===site);}
    upgradeCost(t:Tower):number {return Math.round(TOWERS[t.kind].cost*(0.68+0.47*t.level));}
    private tell(message:string,ok:boolean):boolean{this.message=message;return ok;}
    get ended():boolean{return this.status==='win'||this.status==='lose';}
    build(site:number,kind:TowerKind):boolean{
        if(this.ended||!this.getSite(site)||this.getTower(site))return this.tell('无法在此建塔',false);
        const price=TOWERS[kind].cost;
        if(this.gold<price)return this.tell('银两不足',false);
        this.gold-=price;
        this.towers.push({site,kind,level:1,cooldown:0,recruit:0});
        return this.tell(TOWERS[kind].hero+' 率部驻守 '+TOWERS[kind].name,true);
    }
    upgrade(site:number):boolean{
        const t=this.getTower(site);
        if(!t||this.ended||t.level>=3)return this.tell('不可升级',false);
        const cost=this.upgradeCost(t);
        if(this.gold<cost)return this.tell('升级需要 '+cost+' 两',false);
        this.gold-=cost;t.level++;
        return this.tell(TOWERS[t.kind].name+' 提升至 '+t.level+' 级',true);
    }
    sell(site:number):boolean{
        const i=this.towers.findIndex(t=>t.site===site);
        if(i<0||this.ended)return this.tell('无法拆除',false);
        const t=this.towers[i],base=TOWERS[t.kind].cost;
        const refund=Math.floor((base+(t.level>1?base*1.15:0)+(t.level>2?base*1.62:0))*0.65);
        this.gold+=refund;this.towers.splice(i,1);
        for(let k=this.soldiers.length-1;k>=0;k--)if(this.soldiers[k].site===site)this.soldiers.splice(k,1);
        for(const e of this.enemies)if(e.blockedBy!==null&&!this.soldiers.some(s=>s.id===e.blockedBy))e.blockedBy=null;
        return this.tell('撤防，收回 '+refund+' 两',true);
    }
    moveHero(p:Point):void{
        if(this.ended)return;
        this.hero.target={x:Math.max(-325,Math.min(325,p.x)),y:Math.max(-388,Math.min(419,p.y))};
        this.message='武松正赶赴战场';
    }
    cast():boolean{
        const h=this.hero;
        if(this.status!=='battle'||h.hp<=0||h.cooldown>0)return this.tell('技能尚未准备就绪',false);
        h.cooldown=18;
        this.effects.push({x:h.x,y:h.y,type:'skill',time:0.64,radius:123});
        for(const e of this.enemies){
            if(e.dead||distance(e,h)>123)continue;
            this.hit(e,145,true);e.stun=Math.max(e.stun,2.1);
        }
        return this.tell('武松使出「景阳冈猛击」！',true);
    }
    startWave():boolean{
        if(this.ended){this.reset();return true;}
        if(this.status!=='ready')return false;
        if(this.wave>=WAVES.length)return false;
        this.wave++;
        this.pending=WAVES[this.wave-1].slice();
        this.spawnTimer=0;
        this.status='battle';
        return this.tell('第 '+this.wave+' 波官军来犯！',true);
    }
    reset():void{
        this.status='ready';this.gold=375;this.lives=20;this.wave=0;this.kills=0;
        this.message='点选空地，修建梁山防线';
        this.towers.length=0;this.enemies.length=0;this.soldiers.length=0;this.effects.length=0;
        Object.assign(this.hero,{x:3,y:-313,target:{x:3,y:-313},hp:260,maxHp:260,attackTimer:0,cooldown:0,revive:0});
        this.pending=[];this.spawnTimer=0;this.nextId=1;
    }
    tick(delta:number):void{
        if(this.ended)return;
        let pending=Math.min(0.20,Math.max(0,delta));
        while(pending>0.00001){
            const dt=Math.min(.035,pending);pending-=dt;this.step(dt);
            if(this.ended)break;
        }
    }
    private hit(e:Enemy,raw:number,magic=false):void{
        if(e.dead)return;
        e.hp-=Math.max(1,raw-(magic?0:ENEMIES[e.kind].armor));
        if(e.hp<=0){e.dead=true;this.gold+=ENEMIES[e.kind].gold;this.kills++;}
    }
    private step(dt:number):void{
        for(let i=this.effects.length-1;i>=0;i--)if((this.effects[i].time-=dt)<=0)this.effects.splice(i,1);
        this.moveSoldiers(dt);
        this.moveHero(dt);
        this.fireTowers(dt);
        if(this.status!=='battle')return;
        this.spawnTimer-=dt;
        if(this.pending.length&&this.spawnTimer<=0){
            const kind=this.pending.shift()!,v=ENEMIES[kind],p=pathAt(0);
            this.enemies.push({...p,id:this.nextId++,kind,hp:v.hp,maxHp:v.hp,progress:0,blockedBy:null,attackTimer:0,slow:0,stun:0,dead:false});
            this.spawnTimer=kind==='commander'?1.6:0.83;
        }
        for(const e of this.enemies){
            if(e.dead)continue;
            e.slow=Math.max(0,e.slow-dt);
            if(e.stun>0){e.stun=Math.max(0,e.stun-dt);continue;}
            const current=this.soldiers.find(s=>s.id===e.blockedBy);
            if(!current||current.hp<=0||distance(e,current)>40)e.blockedBy=null;
            if(e.blockedBy===null){
                const occupied=new Set(this.enemies.filter(v=>!v.dead&&v.blockedBy!==null).map(v=>v.blockedBy));
                const guard=this.soldiers.find(s=>!occupied.has(s.id)&&distance(s,s.guard)<16&&distance(s,e)<30);
                if(guard)e.blockedBy=guard.id;
            }
            if(e.blockedBy!==null){
                const defender=this.soldiers.find(s=>s.id===e.blockedBy);
                if(defender){
                    e.attackTimer-=dt;
                    if(e.attackTimer<=0){
                        defender.hp-=ENEMIES[e.kind].atk;
                        e.attackTimer=0.88;
                        if(defender.hp<=0){
                            this.soldiers.splice(this.soldiers.indexOf(defender),1);
                            e.blockedBy=null;
                            const tower=this.getTower(defender.site);
                            if(tower)tower.recruit=Math.max(tower.recruit,5);
                        }
                    }
                    continue;
                }
            }
            e.progress+=ENEMIES[e.kind].speed*(e.slow>0?.54:1)*dt;
            const p=pathAt(e.progress);e.x=p.x;e.y=p.y;
            if(e.progress>=PATH_LENGTH){
                e.dead=true;this.lives=Math.max(0,this.lives-ENEMIES[e.kind].leak);
                if(this.lives<=0){this.status='lose';this.message='防线失守，请重新布阵';break;}
            }
        }
        for(let i=this.enemies.length-1;i>=0;i--)if(this.enemies[i].dead)this.enemies.splice(i,1);
        if(this.status==='battle'&&!this.pending.length&&!this.enemies.length){
            this.status=this.wave===WAVES.length?'win':'ready';
            this.message=this.status==='win'?'守住梁山，五战告捷！':'第 '+this.wave+' 波已守住，准备下波';
        }
    }
    private fireTowers(dt:number):void{
        for(const t of this.towers){
            const cfg=TOWERS[t.kind],site=this.getSite(t.site)!;
            if(t.kind==='barracks'){
                const max=t.level>=3?3:2;
                const troops=this.soldiers.filter(s=>s.site===t.site);
                t.recruit-=dt;
                if(troops.length<max&&t.recruit<=0){
                    const guard=nearestRoad(site),offset=troops.length===0?-14:troops.length===1?14:0;
                    const pos={x:guard.x+offset,y:guard.y};
                    const hp=125+30*(t.level-1);
                    this.soldiers.push({id:this.nextId++,site:t.site,x:site.x,y:site.y,guard:pos,hp,maxHp:hp,attackTimer:0});
                    t.recruit=troops.length===0?1.1:troops.length===1?1.4:5.0;
                }
                continue;
            }
            if(this.status!=='battle')continue;
            t.cooldown-=dt;if(t.cooldown>0)continue;
            const target=this.enemies.filter(e=>!e.dead&&distance(e,site)<=cfg.range).sort((a,b)=>b.progress-a.progress)[0];
            if(!target)continue;
            t.cooldown=cfg.period/(1+.23*(t.level-1));
            const damage=cfg.damage*(1+.5*(t.level-1));
            if(t.kind==='cannon'){
                for(const e of this.enemies)if(!e.dead&&distance(e,target)<=67)this.hit(e,damage);
                this.effects.push({x:target.x,y:target.y,type:'blast',time:.35,radius:68});
            }else if(t.kind==='magic'){
                this.hit(target,damage,true);target.slow=Math.max(target.slow,2.1);
                this.effects.push({x:target.x,y:target.y,type:'magic',time:.31,radius:40});
            }else{
                this.hit(target,damage);
                this.effects.push({x:target.x,y:target.y,type:'arrow',time:.19,radius:20});
            }
        }
    }
    private moveSoldiers(dt:number):void{
        for(const s of this.soldiers){
            const p=towards(s,s.guard,108*dt);s.x=p.x;s.y=p.y;
            if(this.status!=='battle')continue;
            s.attackTimer-=dt;
            const enemy=this.enemies.filter(e=>!e.dead&&distance(s,e)<37).sort((a,b)=>b.progress-a.progress)[0];
            if(enemy&&s.attackTimer<=0){
                this.hit(enemy,16+5*(this.getTower(s.site)?.level||1));
                this.effects.push({x:enemy.x,y:enemy.y,type:'strike',time:.14,radius:18});
                s.attackTimer=.85;
            }
        }
    }
    private moveHero(dt:number):void{
        const h=this.hero;h.cooldown=Math.max(0,h.cooldown-dt);
        if(h.hp<=0){
            h.revive-=dt;
            if(h.revive<=0){h.hp=h.maxHp;h.x=3;h.y=-313;h.target={x:h.x,y:h.y};}
            return;
        }
        const p=towards(h,h.target,124*dt);h.x=p.x;h.y=p.y;
        if(this.status!=='battle')return;
        h.attackTimer-=dt;
        const target=this.enemies.filter(e=>!e.dead&&distance(e,h)<62).sort((a,b)=>b.progress-a.progress)[0];
        if(target&&h.attackTimer<=0){
            this.hit(target,34);
            this.effects.push({x:target.x,y:target.y,type:'strike',time:.15,radius:18});
            h.attackTimer=.72;
        }
    }
}
