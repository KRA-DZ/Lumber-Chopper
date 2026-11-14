import { stackOffset } from "../game/stack-layout.js";
import {cargoAmount} from '../game/material-cargo.js';
import {MATERIAL_FRAMES} from './camp-icons.js';
const snap = (v) => Math.round(v / 2) * 2;
export class StackView {
  constructor(scene) {
    this.scene = scene;
    this.logs = [];
  }
  render() {
    const { core: c, flights, heroView } = this.scene,
      { player: p, state: s, elapsed: t } = c;
    const goods=[];
    for(const id of ['logs','boards','stone','blocks','coal','kits']){
      const amount=cargoAmount(s,id),visible=id==='stone'?Math.min(10,Math.ceil(amount/4)):Math.min(80,amount);
      for(let i=0;i<visible;i++)goods.push(id);
    }
    const count = Math.min(120,goods.length),
      hidden = new Set();
    for (const f of flights) if (f.kind === "pickup" && (!c.coop || f.actor === p.id)) hidden.add(f.index);
    while (this.logs.length < count)
      this.logs.push(this.scene.addImage("log", 0, 0));
    this.logs.forEach((log, i) => {
      const kind=goods[i]||'logs';
      this.scene.assets.setFrame(log,MATERIAL_FRAMES[kind]);
      log.clearTint();
      if(kind==='boards')log.setDisplaySize(48,14);
      else if(kind==='logs')log.setScale(2);
      else {log.setDisplaySize(30,24);if(kind==='coal')log.setTint(0x555568);if(kind==='blocks')log.setTint(0xb7ad95);}
      const slot = stackOffset(i, count),
        height = (i % 28) / 27,
        load = Math.min(count / 20, 1.5);
      log
        .setVisible(i < count && !hidden.has(i))
        .setPosition(
          snap(
            p.x +
              slot.x +
              (p.moving
                ? Math.sin(t * 9 - height * 1.8) * (2 + height * 11) * load
                : 0),
          ),
          snap(
            p.y +
              slot.y +
              heroView.bob +
              (p.moving ? Math.sin(t * 12) * (1 + load) : 0),
          ),
        )
        .setDepth(p.y + 0.04 + i * 0.0001);
    });
  }
}
