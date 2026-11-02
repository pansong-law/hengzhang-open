// Local calendar days keep the same saying all day, including across DST changes.
const MOTTOS = [
  "把今天过好，让明天从容。",
  "慢慢来，也在向前。",
  "留一点空白，给生活。",
  "把心放稳，把事做好。",
  "认真过的日子，都有回响。",
  "不必追赶，自有节奏。",
  "走好眼前一步，远方慢慢抵达。",
  "给时间一点耐心，给自己一点余地。",
  "心里有光，寻常也明亮。",
  "把纷繁放下，让心清楚。",
  "今天的认真，会成为明天的底气。",
  "日子不必匆忙，热爱自有回声。",
  "愿你忙有所值，闲有所趣。",
  "好好生活，就是向前。",
  "把脚步放慢，把目光放远。",
  "平常的一天，也值得认真喜欢。",
  "做一点小事，积一点心安。",
  "不慌不忙，自有力量。",
  "向着心里的方向，走自己的路。",
  "给今天一个微笑，给明天一份期待。",
  "愿每一份用心，都有安放之处。",
];

export function dailyMotto(now = new Date()) {
  const day = Math.floor(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000,
  );
  return MOTTOS[((day % MOTTOS.length) + MOTTOS.length) % MOTTOS.length];
}

export function mottoPreferences(db, now = new Date()) {
  const default_motto = dailyMotto(now);
  const custom_motto = db.meta.dashboard_motto || "";
  return {
    dashboard_motto: custom_motto || default_motto,
    custom_motto,
    default_motto,
    motto_date: now.toLocaleDateString("sv-SE"),
  };
}
