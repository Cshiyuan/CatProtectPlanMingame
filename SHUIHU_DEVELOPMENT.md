# 梁山保卫战第一关（开发版）

本分支基于 Cocos Creator 3.8.6 原项目。

新增 LiangshanModel.ts：四种防御塔、五波敌人、固定道路、士兵拦截、武松技能、升级出售和胜负判定。
新增 LiangshanBattle.ts：Cocos Graphics 程序化战斗场景、塔基、单位和触摸 UI。
原 GameScene.ts 已加入 useLiangshanBattle 开关，可关闭并返回原版猫咪游戏。

## 测试方式

使用 Cocos Creator 3.8.6 打开项目，运行 assets/scene.scene，或构建到微信小游戏再用开发者工具预览。

## 操作

点击空塔基选中，再点底部四种塔建造；点击已有塔并升级/出售；点击发兵开启下一波；点击武松调遣后选地图位置；点击景阳冈猛击释放技能。

## 限制

这是一个玩法垂直切片，不是完成美术和动画的正式游戏。绘制仍为程序占位图，尚未通过 Cocos Creator 本机和微信真机验证。原仓库 LICENSE 保留。
