export const GOALS=Object.freeze([
  {id:"first-night",name:"Пережить первую ночь",done:s=>s.nightsSurvived>=1},
  {id:"two-nights",name:"Пережить две ночи",done:s=>s.nightsSurvived>=2},
  {id:"explorer",name:"Открыть три региона",done:s=>s.unlockedRegions.length>=3},
  {id:"hunter",name:"Победить регионального босса",done:s=>s.runStats.bosses>=1},
  {id:"sawmill",name:"Восстановить лесопилку",done:s=>s.sawmill.stage===3},
  {id:"raid",name:"Выдержать налёт",done:s=>s.raidsWon>=1},
  {id:"seven-nights",name:"Пережить семь ночей",done:s=>s.nightsSurvived>=7},
]);
const fresh=()=>({version:1,rows:[],goals:[]});
export function createRecordBook(storage){
  let data=fresh(),available=true;
  let encoded=null;try{encoded=storage.getItem("lumber-records-v1");}catch{available=false;}
  try{const v=JSON.parse(encoded||"null");if(v?.version===1){
    data.rows=(Array.isArray(v.rows)?v.rows:[]).filter(r=>typeof r.id==="string"&&typeof r.name==="string"&&["solo","coop"].includes(r.mode)&&[1,2.5].includes(r.speed)&&Number.isInteger(r.nights)&&r.nights>=0&&Number.isInteger(r.kills)&&r.kills>=0).slice(0,40);
    data.goals=(Array.isArray(v.goals)?v.goals:[]).filter(id=>GOALS.some(g=>g.id===id));
  }}catch{ /* A damaged record file starts a fresh book; storage may still work. */ }
  function record(id,name,mode,s){
    for(const g of GOALS)if(g.done(s)&&!data.goals.includes(g.id))data.goals.push(g.id);
    const row={id,name:String(name||"Лесоруб").trim().slice(0,32)||"Лесоруб",mode,speed:s.cycleSpeed||1,nights:s.nightsSurvived,kills:s.runStats.kills};
    data.rows=data.rows.filter(r=>r.id!==id);if(row.nights||row.kills)data.rows.push(row);
    data.rows.sort((a,b)=>b.nights-a.nights||b.kills-a.kills);
    data.rows=[...new Set(data.rows.map(r=>`${r.mode}:${r.speed}`))].flatMap(key=>data.rows.filter(r=>`${r.mode}:${r.speed}`===key).slice(0,10));
    try{storage.setItem("lumber-records-v1",JSON.stringify(data));}catch{available=false;}
    return row;
  }
  return {record,get data(){return data;},get available(){return available;},best:(mode,speed)=>data.rows.filter(r=>r.mode===mode&&r.speed===speed).sort((a,b)=>b.nights-a.nights||b.kills-a.kills)[0]||null};
}
