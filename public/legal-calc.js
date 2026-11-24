'use strict';
// 法律计算：顶栏快捷入口浮层。内置计算在本机浏览器完成；支持自由拖动排序、拖动窗口、自写小工具及使用范围配置。
(()=>{
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const svg=(p,size=20)=>`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;

 // 精绘双层法律与财税主题图标（柔和底色填充层 + 几何精细描边层）
 const ICONS={
  brand:'<rect x="3.2" y="3.2" width="17.6" height="17.6" rx="4.5" fill="currentColor" fill-opacity=".15"/><path d="M12 6.2v11.6M7.2 9.2h9.6M9 17.8h6"/><path d="M7.2 9.2 5.4 13a2 2 0 0 0 3.6 0zM16.8 9.2 15 13a2 2 0 0 0 3.6 0z"/>',
  seal:'<rect x="3.5" y="4" width="17" height="16" rx="3.2" fill="currentColor" fill-opacity=".14"/><path d="M7.5 4v16" stroke-dasharray="2 2" stroke-opacity=".45"/><path d="M11.2 8.2 13.8 11l2.6-2.8M10.8 11.6h6M10.8 14.3h6M13.8 11v5.6"/><circle cx="6.2" cy="8" r=".8" fill="currentColor"/>',
  calendar:'<rect x="3.2" y="4.8" width="17.6" height="15.7" rx="3" fill="currentColor" fill-opacity=".13"/><path d="M3.2 9.6h17.6M8 2.8v3.6M16 2.8v3.6"/><circle cx="15.6" cy="15.2" r="3.4" fill="currentColor" fill-opacity=".18"/><path d="M15.6 13.6v1.8l1.2.9M7.2 13.2h3.2M7.2 16.4h2.2"/>',
  abacus:'<rect x="3.5" y="3.5" width="17" height="17" rx="3.2" fill="currentColor" fill-opacity=".13"/><path d="M3.5 8.5h17M8.2 8.5v12M12 8.5v12M15.8 8.5v12"/><circle cx="8.2" cy="12" r="1.35" fill="currentColor"/><circle cx="12" cy="15.2" r="1.35" fill="currentColor"/><circle cx="15.8" cy="11.6" r="1.35" fill="currentColor"/><circle cx="15.8" cy="16.4" r="1.35" fill="currentColor"/><path d="M7.5 6h5"/>',
  gavel:'<path d="M12 4v16M7 20h10" /><circle cx="12" cy="4.2" r="1.4" fill="currentColor"/><path d="M4.5 7.5h15"/><path d="M4.5 7.5 2 13.2a2.9 2.9 0 0 0 5 0z" fill="currentColor" fill-opacity=".18"/><path d="M19.5 7.5 17 13.2a2.9 2.9 0 0 0 5 0z" fill="currentColor" fill-opacity=".18"/>',
  trend:'<path d="M4 18.5 9.2 13l3.6 2.8L19.8 7.5" stroke-width="1.85"/><path d="M4 18.5 9.2 13l3.6 2.8L19.8 7.5V18.5H4z" fill="currentColor" fill-opacity=".14" stroke="none"/><path d="M15.4 7.5h4.4v4.4"/><circle cx="9.2" cy="13" r="1.3" fill="currentColor"/><circle cx="12.8" cy="15.8" r="1.3" fill="currentColor"/>',
  shield:'<path d="M12 3.2 19 6v5.6c0 4.6-3 7.9-7 9.4-4-1.5-7-4.8-7-9.4V6z" fill="currentColor" fill-opacity=".14"/><path d="M8.3 13.6h7.4l-.9-2.8a1.2 1.2 0 0 0-1.1-.8h-3.4a1.2 1.2 0 0 0-1.1.8z"/><circle cx="9.4" cy="14.6" r="1" fill="currentColor"/><circle cx="14.6" cy="14.6" r="1" fill="currentColor"/>',
  briefcase:'<rect x="3.2" y="7.2" width="17.6" height="12.6" rx="2.8" fill="currentColor" fill-opacity=".14"/><path d="M8.8 7.2V5.4a1.6 1.6 0 0 1 1.6-1.6h3.2a1.6 1.6 0 0 1 1.6 1.6v1.8"/><path d="M3.2 12.2h17.6"/><rect x="10.3" y="10.7" width="3.4" height="3" rx=".8" fill="currentColor" fill-opacity=".26"/>',
  contract:'<path d="M6 3.5h8.5L19 8v12.5H6a1.8 1.8 0 0 1-1.8-1.8V5.3A1.8 1.8 0 0 1 6 3.5z" fill="currentColor" fill-opacity=".13"/><path d="M14.2 3.5V8H19M8.2 11.5h7.2M8.2 14.5h4.8"/><circle cx="15.4" cy="16.4" r="2.1" fill="currentColor" fill-opacity=".22"/>',
  pie:'<path d="M11 4.2a7.8 7.8 0 1 0 8.8 8.8H11z" fill="currentColor" fill-opacity=".14"/><path d="M13.5 3.5A7.5 7.5 0 0 1 20.5 10.5H13.5z" fill="currentColor" fill-opacity=".28"/>',
  tax:'<path d="M5.2 3.8h13.6v16.4l-2.3-1.5-2.2 1.5-2.3-1.5-2.3 1.5-2.2-1.5-2.3 1.5z" fill="currentColor" fill-opacity=".13"/><path d="m9.2 14.2 5.6-5.6"/><circle cx="9.4" cy="9" r="1.1" fill="currentColor"/><circle cx="14.6" cy="14" r="1.1" fill="currentColor"/>',
  house:'<path d="M3.5 10.8 12 4l8.5 6.8" /><path d="M5.8 9.5V19.8h12.4V9.5" fill="currentColor" fill-opacity=".14"/><rect x="9.8" y="13.5" width="4.4" height="6.3" rx=".8"/>',
  spark:'<rect x="4" y="4" width="16" height="16" rx="4" fill="currentColor" fill-opacity=".13"/><path d="m12 6.8 1.5 3.7 3.7 1.5-3.7 1.5L12 17.2l-1.5-3.7-3.7-1.5 3.7-1.5z" fill="currentColor" fill-opacity=".24"/>'
 };
 ICONS.hash=ICONS.seal;ICONS.calc=ICONS.abacus;ICONS.scale=ICONS.gavel;ICONS.car=ICONS.shield;

 const ICON_LABELS={
  seal:'票据大写',calendar:'期限日历',abacus:'分段筹算',gavel:'法槌天平',
  trend:'利率折线',shield:'护盾交强',briefcase:'劳动公文',contract:'合同文书',
  pie:'比例份额',tax:'税费折算',house:'房产评估',spark:'智算工具'
 };
 const ACCENTS_META={
  vermilion:{label:'朱砂金',dot:'#c84630'},
  amber:{label:'琥珀铜',dot:'#c2761a'},
  indigo:{label:'靛青蓝',dot:'#3f51b5'},
  teal:{label:'黛青色',dot:'#167974'},
  emerald:{label:'松石绿',dot:'#1e8253'},
  cobalt:{label:'霁蓝色',dot:'#1e6bc4'},
  plum:{label:'绛紫色',dot:'#883aa6'},
  slate:{label:'玄青灰',dot:'#415d70'}
 };

 // ───────────── 通用数据（默认值均可在计算器内手动修改） ─────────────
 // 贷款市场报价利率（LPR）：2019-08-20 起；数据核对至 2026-11-20，自 2025-05-20 起未再调整。
 const LPR=[['2019-08-20',4.25,4.85],['2019-09-20',4.20,4.85],['2019-11-20',4.15,4.80],['2020-02-20',4.05,4.75],['2020-04-20',3.85,4.65],['2021-12-20',3.80,4.65],['2022-01-20',3.70,4.60],['2022-05-20',3.70,4.45],['2022-08-22',3.65,4.30],['2023-06-20',3.55,4.20],['2023-08-21',3.45,4.20],['2024-02-20',3.45,3.95],['2024-07-22',3.35,3.85],['2024-10-21',3.10,3.60],['2025-05-20',3.00,3.50]];
 const LPR_CHECKED='2026-11-20';
 // 中国人民银行贷款基准利率（2019-08-19 前）：[生效日, 六个月至一年, 五年以上]
 const BENCH=[['2008-12-23',5.31,5.94],['2010-10-20',5.56,6.14],['2010-12-26',5.81,6.40],['2011-02-09',6.06,6.60],['2011-04-06',6.31,6.80],['2011-07-07',6.56,7.05],['2012-06-08',6.31,6.80],['2012-07-06',6.00,6.55],['2014-11-22',5.60,6.15],['2015-03-01',5.35,5.90],['2015-05-11',5.10,5.65],['2015-06-28',4.85,5.40],['2015-08-26',4.60,5.15],['2015-10-24',4.35,4.90]];
 // 国务院办公厅公布的放假与调休安排
 const HOLIDAYS={
  2024:{off:['01-01','02-10~02-17','04-04~04-06','05-01~05-05','06-10','09-15~09-17','10-01~10-07'],work:['02-04','02-18','04-07','04-28','05-11','09-14','09-29','10-12']},
  2025:{off:['01-01','01-28~02-04','04-04~04-06','05-01~05-05','05-31~06-02','10-01~10-08'],work:['01-26','02-08','04-27','09-28','10-11']},
  2026:{off:['01-01~01-03','02-15~02-23','04-04~04-06','05-01~05-05','06-19~06-21','09-25~09-27','10-01~10-07'],work:['01-04','02-14','02-28','05-09','09-20','10-10']}
 };
 // ── 地区数据（全国 31 个省级行政区）。默认值均可在计算器内修改，引用前请按受诉法院所在地核对 ──
 const PROVINCES=['北京','天津','河北','山西','内蒙古','辽宁','吉林','黑龙江','上海','江苏','浙江','安徽','福建','江西','山东','河南','湖北','湖南','广东','广西','海南','重庆','四川','贵州','云南','西藏','陕西','甘肃','青海','宁夏','新疆'];
 const INJURY_YEAR='2026 年度（2025 年统计数据）';
 /*__INJURY_STD__*/const INJURY_STD={"北京":{"income":96292,"consume":54122,"wage":145391,"meal":100,"note":"丧葬费按全口径城镇单位就业人员平均工资"},"天津":{"income":60099,"consume":39693,"wage":103608,"meal":100,"note":"丧葬费按市人社局公布的本市职工平均工资"},"河北":{"income":47544,"consume":30522,"wage":104098,"meal":100,"note":"丧葬费按城镇非私营单位在岗职工平均工资"},"山西":{"income":44649,"consume":27339,"wage":103673,"meal":100,"note":"丧葬费按城镇非私营单位在岗职工平均工资"},"内蒙古":{"income":52829,"consume":34183,"wage":117113,"meal":100,"note":"内蒙古高院 2020 年起统一按城镇标准；数据取自自治区 2025 年统计公报"},"辽宁":{"income":50057,"consume":31428,"wage":107204,"meal":100,"note":"依据《辽宁省2026年度道路交通事故损害赔偿标准》"},"吉林":{"income":40817,"consume":29745,"wage":102963,"meal":100,"note":""},"黑龙江":{"income":39901,"consume":28666,"wage":104712,"meal":100,"note":""},"上海":{"income":96842,"consume":57076,"wage":150924,"meal":20,"note":"住院伙食补助按上海法院实务 20 元／天；丧葬费按全口径城镇单位就业人员平均工资"},"江苏":{"income":68956,"consume":43917,"wage":134969,"meal":100,"note":"依据苏高法电〔2026〕31号"},"浙江":{"income":81649,"consume":53223,"wage":141902,"meal":100,"note":"丧葬费口径依据浙高法审〔2022〕2号"},"安徽":{"income":51737,"consume":30539,"wage":109374,"meal":50,"note":"住院伙食补助按当地机关出差伙食补助标准"},"福建":{"income":61437,"consume":41729,"wage":116510,"meal":60,"note":"住院伙食补助按当地机关出差伙食补助标准"},"江西":{"income":49580,"consume":30249,"wage":101263,"meal":60,"note":"丧葬费按城镇非私营单位在岗职工平均工资；住院伙食补助按当地机关出差伙食补助标准"},"山东":{"income":56444,"consume":32561,"wage":115463,"meal":100,"note":"参照《山东省道路交通事故损害赔偿项目计算标准（试行）》；丧葬费按城镇非私营单位在岗职工平均工资"},"河南":{"income":43926,"consume":27319,"wage":91023,"meal":100,"note":""},"湖北":{"income":49164,"consume":33376,"wage":93007,"meal":100,"note":"丧葬费按在岗职工平均工资"},"湖南":{"income":53369,"consume":33678,"wage":105294,"meal":100,"note":"丧葬费按城镇非私营单位在岗职工平均工资"},"广东":{"income":63974,"consume":42726,"wage":145651,"meal":100,"note":"丧葬费按全省城镇非私营单位在岗职工平均工资；深圳、珠海、汕头经济特区标准不同的就高适用（粤高法〔2023〕105号）"},"广西":{"income":44793,"consume":27163,"wage":103572,"meal":100,"note":"依据桂公通〔2026〕84号"},"海南":{"income":45829,"consume":32651,"wage":120853,"meal":100,"note":""},"重庆":{"income":51854,"consume":32764,"wage":125570,"meal":60,"note":"丧葬费按城镇非私营单位在岗职工平均工资（渝高法〔2018〕199号）；住院伙食补助按当地机关出差伙食补助标准"},"四川":{"income":49428,"consume":32181,"wage":115697,"meal":100,"note":"甘孜、阿坝、凉山三州住院伙食补助为 120 元／天"},"贵州":{"income":46289,"consume":29434,"wage":108193,"meal":100,"note":"住院伙食补助等定额以贵州高院 2024 年《人身损害赔偿案件赔偿项目计算标准》为准"},"云南":{"income":46699,"consume":30689,"wage":119353,"meal":100,"note":"依据《2026年云南省道路交通事故人身损害赔偿有关费用计算标准》"},"西藏":{"income":58794,"consume":33281,"wage":165649,"meal":120,"note":"住院伙食补助按区内机关出差伙食补助标准"},"陕西":{"income":49053,"consume":29807,"wage":118986,"meal":100,"note":"丧葬费按城镇非私营单位在岗职工平均工资"},"甘肃":{"income":43910,"consume":29052,"wage":110841,"meal":100,"note":"依据甘公交管〔2026〕82号"},"青海":{"income":43879,"consume":27586,"wage":127551,"meal":70,"note":"住院伙食补助按西宁市出差伙食补助标准，省内其他地区为 60 元／天"},"宁夏":{"income":46593,"consume":29686,"wage":125972,"meal":100,"note":""},"新疆":{"income":45106,"consume":29702,"wage":120806,"meal":120,"note":"住院伙食补助按区内机关出差伙食补助标准"}};
 /*__LAWYER_STD__*/const LAWYER_STD={"内蒙古":{"regime":"实行市场调节价（原内发改费字〔2010〕1851号政府指导价已不再适用于一般民事案件），由律所自定标准并备案"},"北京":{"regime":"2018 年 4 月 1 日起全面放开律师服务收费，实行市场调节价，无统一标准"},"天津":{"regime":"2017 年 12 月起放开，实行市场调节价；律所依《天津市律师服务费标准制定指引（试行）》（津律协发〔2025〕10号）自定比例并备案"},"河北":{"doc":"河北省律师协会《河北省律师服务收费指导意见》（冀律协〔2016〕7号），现行为市场调节价，指引供参考","tiers":[[100000.0,8,8],[1000000.0,6,6],[10000000.0,4,4],[null,2,2]],"min":3000},"辽宁":{"doc":"《辽宁省律师法律服务收费行业指导标准（2016）》，现行为市场调节价，各律所自主制定备案","tiers":[[100000.0,8,10],[500000.0,7,9],[1000000.0,6,8],[5000000.0,5,7],[10000000.0,4,6],[20000000.0,3,5],[50000000.0,2,4],[null,1,3]],"min":5000},"吉林":{"doc":"《吉林省律师法律服务收费行业指导标准（试行）》（吉林省律师协会，2017），现行为市场调节价","tiers":[[100000.0,8,10],[500000.0,7,9],[1000000.0,6,8],[5000000.0,5,7],[10000000.0,4,6],[20000000.0,3,5],[50000000.0,2,4],[null,1,3]],"min":5000},"上海":{"doc":"现行无统一标准（实行市场调节价，律所向上海律协备案）；以下为原《上海市律师服务收费管理办法》（沪发改规范〔2017〕3号，2022 年到期失效）政府指导价比例，仅供历史参考","tiers":[[100000.0,8,12],[1000000.0,5,7],[10000000.0,3,5],[100000000.0,1,3],[null,0.5,1]],"min":3000},"江苏":{"regime":"实行市场调节价；《江苏省律师服务收费指引（试行）》（苏律协发〔2023〕4号）未规定统一比例，由律所自定并备案"},"浙江":{"doc":"浙价服〔2011〕212号政府指导价，仅适用于劳动报酬、工伤赔偿等特定民生民事案件；一般民事案件实行市场调节价，按律所备案标准","tiers":[[100000.0,6,8],[500000.0,5,6],[1000000.0,4,5],[5000000.0,3,4],[10000000.0,2,3],[null,1,2]],"min":2500},"湖南":{"doc":"《湖南省律师服务收费行业指导标准》（湖南省律师协会，2017），现行为市场调节价；10 万元以下部分按 3000–10000 元计收","tiers":[[500000.0,6,8],[5000000.0,4,6],[20000000.0,2,4],[100000000.0,1,2],[null,0.5,1]],"min":3000},"广东":{"regime":"实行市场调节价，由律所自定比例并备案；原粤价〔2006〕298号政府指导价已于 2022 年废止"},"广西":{"doc":"桂价费〔2013〕41号政府指导价，仅适用于特定民生及公益群体性民事案件；一般民商事案件实行市场调节价","tiers":[[100000.0,5,5],[500000.0,4.5,4.5],[1000000.0,4,4],[5000000.0,3,3],[10000000.0,2,2],[null,1,1]],"min":1000},"海南":{"doc":"《海南省律师服务收费指引》（琼律协通〔2020〕58号），现行为市场调节价","tiers":[[100000.0,8,8],[500000.0,7,7],[1000000.0,6,6],[5000000.0,5,5],[10000000.0,4,4],[50000000.0,3,3],[100000000.0,2,2],[null,1,1]],"min":0},"四川":{"doc":"现行无全省统一标准（川律协〔2022〕73号制订指引比例留空，由律所自定并备案）；以下为原《四川省律师法律服务收费行业指导标准（试行）》（川律协〔2016〕39号）比例，部分律所仍沿用，仅供参考","tiers":[[100000.0,8,10],[500000.0,7,9],[1000000.0,6,8],[5000000.0,5,7],[10000000.0,4,6],[20000000.0,3,5],[50000000.0,2,4],[null,1,3]],"min":5000},"西藏":{"doc":"《西藏自治区律师诉讼代理服务收费政府指导价标准》（2018），仅适用于特定民生及公益民事案件；一般民事案件实行市场调节价","tiers":[[100000.0,5,6],[1000000.0,4,5],[5000000.0,3,4],[10000000.0,2,3],[50000000.0,1,2],[null,0.5,1]],"min":2000},"甘肃":{"doc":"《甘肃省律师服务收费指导意见》（甘肃省律师协会，2016），现行为市场调节价","tiers":[[100000.0,8,10],[500000.0,7,9],[1000000.0,6,8],[5000000.0,5,7],[10000000.0,4,6],[50000000.0,3,5],[100000000.0,2,4],[null,1,2]],"min":3000},"宁夏":{"doc":"《宁夏回族自治区律师业服务收费指导意见》（宁夏律师协会，2016），现行为市场调节价；1 万元以下按 1000–3000 元定额","tiers":[[100000.0,8,9],[1000000.0,6,8],[5000000.0,4,6],[10000000.0,2,4],[50000000.0,1,2],[null,0.5,1]],"min":1000},"山西":{"regime":"实行市场调节价，由律所自主制定收费标准并向律协备案，无全省统一公开比例"},"黑龙江":{"regime":"实行市场调节价，由律所自主制定收费标准并向律协备案，无全省统一公开比例"},"安徽":{"regime":"实行市场调节价，由律所自主制定收费标准并向律协备案，无全省统一公开比例"},"福建":{"regime":"实行市场调节价，由律所自主制定收费标准并向律协备案，无全省统一公开比例"},"江西":{"regime":"实行市场调节价，由律所自主制定收费标准并向律协备案，无全省统一公开比例"},"山东":{"regime":"实行市场调节价，由律所自主制定收费标准并向律协备案，无全省统一公开比例"},"河南":{"regime":"实行市场调节价，由律所自主制定收费标准并向律协备案，无全省统一公开比例"},"湖北":{"regime":"实行市场调节价，由律所自主制定收费标准并向律协备案，无全省统一公开比例"},"重庆":{"regime":"实行市场调节价，由律所自主制定收费标准并向律协备案，无全省统一公开比例"},"贵州":{"regime":"实行市场调节价，由律所自主制定收费标准并向律协备案，无全省统一公开比例"},"云南":{"regime":"实行市场调节价，由律所自主制定收费标准并向律协备案，无全省统一公开比例"},"陕西":{"regime":"实行市场调节价，由律所自主制定收费标准并向律协备案，无全省统一公开比例"},"青海":{"regime":"实行市场调节价，由律所自主制定收费标准并向律协备案，无全省统一公开比例"},"新疆":{"regime":"实行市场调节价，由律所自主制定收费标准并向律协备案，无全省统一公开比例"}};
 const LAWYER_GENERIC={doc:'通用参考比例（该地区无公开统一标准，律师服务收费实行市场调节价，可按律所备案标准修改）',tiers:[[1e5,8,10],[5e5,6,8],[1e6,5,7],[5e6,4,6],[1e7,3,5],[5e7,2,4],[null,1,3]],min:3000,note:''};
 const REGION_KEY='hengzhang-local-legal-calc-region';
 const loadRegion=()=>{try{const r=localStorage.getItem(REGION_KEY);if(r&&PROVINCES.includes(r))return r}catch{}return '四川'};
 const saveRegion=r=>{try{if(PROVINCES.includes(r))localStorage.setItem(REGION_KEY,r)}catch{}};
 const regionOpts=extra=>[...PROVINCES.map(x=>[x,x]),...extra];
 // 四川省 2025 年度工伤保险待遇计发基数（上年度全省城镇全部单位就业人员月平均工资）
 const SC_AVG_MONTH=7646;
 const SC_MIN_WAGE=2330;
 const NATIONAL_URBAN_INCOME=56502; // 2025 年全国城镇居民人均可支配收入，用于 2026 年一次性工亡补助金

 // ───────────── 工具函数 ─────────────
 const DAY=86400000;
 const pad=x=>String(x).padStart(2,'0');
 const toDay=s=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s||''));if(!m)return null;return Math.round(Date.UTC(+m[1],+m[2]-1,+m[3])/DAY)};
 const ymd=d=>{const x=new Date(d*DAY);return [x.getUTCFullYear(),x.getUTCMonth()+1,x.getUTCDate()]};
 const iso=d=>{const [y,m,dd]=ymd(d);return `${y}-${pad(m)}-${pad(dd)}`};
 const cn=d=>{const [y,m,dd]=ymd(d);return `${y}年${m}月${dd}日`};
 const WEEK='日一二三四五六';
 const weekday=d=>'星期'+WEEK[new Date(d*DAY).getUTCDay()];
 const dim=(y,m)=>new Date(Date.UTC(y,m,0)).getUTCDate();
 const addMonths=(d,k)=>{const [y,m,dd]=ymd(d);const t=y*12+(m-1)+k;const yy=Math.floor(t/12),mm=t-yy*12+1;return Math.round(Date.UTC(yy,mm-1,Math.min(dd,dim(yy,mm)))/DAY)};
 function diffYMD(a,b){if(b<a)return null;const [y1,m1]=ymd(a),[y2,m2]=ymd(b);let months=(y2-y1)*12+(m2-m1);while(months>0&&addMonths(a,months)>b)months--;while(addMonths(a,months+1)<=b)months++;return {years:Math.floor(months/12),months:months%12,days:b-addMonths(a,months),total:months}}
 const todayIso=()=>{const t=new Date();return `${t.getFullYear()}-${pad(t.getMonth()+1)}-${pad(t.getDate())}`};
 const holidayCache={};
 function holidaySets(y){
  if(!HOLIDAYS[y])return null;
  if(holidayCache[y])return holidayCache[y];
  const expand=list=>{const s=new Set();for(const item of list){const [a,b]=item.split('~');const s0=toDay(`${y}-${a}`),s1=toDay(`${y}-${b||a}`);for(let d=s0;d<=s1;d++)s.add(d)}return s};
  return holidayCache[y]={off:expand(HOLIDAYS[y].off),work:expand(HOLIDAYS[y].work)};
 }
 function isOff(d){const sets=holidaySets(ymd(d)[0]);if(sets){if(sets.work.has(d))return false;if(sets.off.has(d))return true}const w=new Date(d*DAY).getUTCDay();return w===0||w===6}
 function offReason(d){const sets=holidaySets(ymd(d)[0]);if(sets?.off.has(d))return '法定节假日';const w=new Date(d*DAY).getUTCDay();return w===0||w===6?'休息日（周末）':''}
 const yearsCovered=(a,b)=>{const out=[];for(let y=ymd(a)[0];y<=ymd(b)[0];y++)if(!HOLIDAYS[y])out.push(y);return out};

 function num(v,label){
  const s=String(v??'').replace(/[,，\s元¥￥%]/g,'');
  if(s==='')return 0;
  const x=Number(s);
  if(!Number.isFinite(x))throw Error((label||'输入')+'不是有效数字');
  return x;
 }
 const r2=x=>Math.round((x+Number.EPSILON)*100)/100;
 const money=x=>r2(x).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2})+' 元';
 const plain=x=>(Math.round(x*10000)/10000).toLocaleString('zh-CN',{maximumFractionDigits:4});
 const pct=x=>plain(x)+'%';
 const clamp=(x,lo,hi)=>Math.min(Math.max(x,lo),hi);

 // ───────────── 表单片段 ─────────────
 const cls=o=>o.full?' full':'';
 const hint=o=>o.hint?`<small>${o.hint}</small>`:'';
 const when=o=>o.when?` data-when="${o.when}"`:'';
 const fNum=(name,label,val='',o={})=>`<label class="lc-field${cls(o)}"${when(o)}><span>${label}</span><span class="lc-input"><input name="${name}" inputmode="decimal" autocomplete="off" value="${esc(val)}" placeholder="${esc(o.ph||'')}">${o.unit?`<em>${o.unit}</em>`:''}</span>${hint(o)}</label>`;
 const fDate=(name,label,val='',o={})=>`<label class="lc-field${cls(o)}"${when(o)}><span>${label}</span><span class="lc-input"><input type="date" name="${name}" value="${esc(val)}"></span>${hint(o)}</label>`;
 const fSel=(name,label,opts,val,o={})=>`<label class="lc-field${cls(o)}"${when(o)}><span>${label}</span><span class="lc-input"><select name="${name}">${opts.map(([v,t])=>`<option value="${esc(v)}"${String(v)===String(val)?' selected':''}>${esc(t)}</option>`).join('')}</select></span>${hint(o)}</label>`;
 const fChk=(name,label,checked,o={})=>`<label class="lc-check${cls(o)}"${when(o)}><input type="checkbox" name="${name}"${checked?' checked':''}><span>${label}</span></label>`;
 const fSeg=(name,opts,val,o={})=>`<div class="lc-seg${o.small?' is-small':''}" role="radiogroup"${when(o)}>${opts.map(([v,t])=>`<label><input type="radio" name="${name}" value="${esc(v)}"${String(v)===String(val)?' checked':''}><span>${esc(t)}</span></label>`).join('')}</div>`;
 const group=(title,inner,o={})=>`<fieldset class="lc-group"${when(o)}>${title?`<legend>${title}</legend>`:''}<div class="lc-fields">${inner}</div>${o.foot||''}</fieldset>`;
 const rowsBox=(kind,addLabel,o={})=>`<div class="lc-rows-box full"${when(o)}><div class="lc-rows" data-rows="${kind}"></div><button type="button" class="lc-add-row" data-add-row="${kind}">${addLabel}</button></div>`;
 const ROW_TPL={
  pay:()=>`<div class="lc-row" data-row-of="pay"><span class="lc-input"><input type="date" data-k="date" aria-label="还款日期"></span><span class="lc-input"><input data-k="amount" inputmode="decimal" placeholder="还款金额" aria-label="还款金额"><em>元</em></span><button type="button" class="lc-row-del" data-del-row aria-label="删除此行">×</button></div>`,
  dep:()=>`<div class="lc-row is-dep" data-row-of="dep"><span class="lc-input"><select data-k="type" aria-label="被扶养人类型"><option value="minor">未成年人</option><option value="adult">丧失劳动能力且无其他生活来源的成年人</option></select></span><span class="lc-input"><input data-k="age" inputmode="decimal" placeholder="年龄" aria-label="被扶养人年龄"><em>岁</em></span><span class="lc-input"><input data-k="count" inputmode="numeric" placeholder="扶养人数" value="1" aria-label="共同扶养人数"><em>人扶养</em></span><button type="button" class="lc-row-del" data-del-row aria-label="删除此行">×</button></div>`
 };

 // ───────────── 1. 数字大写 ─────────────
 const DIG='零壹贰叁肆伍陆柒捌玖';
 function intUpper(s){
  s=s.replace(/^0+/,'');
  if(!s)return '';
  const U=['','拾','佰','仟'],G=['','万','亿','万'];
  let out='',zero=false;
  for(let i=0;i<s.length;i++){
   const d=+s[i],pos=s.length-1-i,u=pos%4,g=Math.floor(pos/4);
   if(d===0)zero=true;else{if(zero){out+='零';zero=false}out+=DIG[d]+U[u]}
   if(u===0&&g>0){
    const grp=s.slice(Math.max(0,i-3),i+1);
    if(/[1-9]/.test(grp))out+=G[g];
    else if(g===2&&/[1-9]/.test(s.slice(0,i+1)))out+='亿';
   }
  }
  return out;
 }
 function rmbUpper(raw){
  let s=String(raw||'').replace(/[,，\s元¥￥]/g,'');
  if(!s)return null;
  if(!/^-?\d+(\.\d+)?$/.test(s))throw Error('请输入数字金额，例如 1234567.89');
  const neg=s.startsWith('-');if(neg)s=s.slice(1);
  const [ip,dp='']=s.split('.');
  if(ip.replace(/^0+/,'').length>13)throw Error('金额过大，最多支持到万亿级');
  let cents=BigInt(ip||'0')*100n+BigInt((dp+'00').slice(0,2));
  if((dp[2]||'0')>='5')cents+=1n;
  const intStr=(cents/100n).toString(),jiao=Number(cents%100n/10n),fen=Number(cents%10n);
  const iu=intUpper(intStr);
  let out=iu?iu+'元':'';
  if(!jiao&&!fen)out=(out||'零元')+'整';
  else{if(jiao)out+=DIG[jiao]+'角';else if(iu)out+='零';if(fen)out+=DIG[fen]+'分'}
  const small=Number(intStr).toLocaleString('zh-CN')+'.'+jiao+fen;
  return {text:(neg&&cents>0n?'负':'')+out,small:(neg&&cents>0n?'-':'')+small};
 }
 const toolRmb={
  id:'rmb',title:'数字大写转换器',desc:'数字转中文大写金额，支持角分。',icon:'seal',accent:'vermilion',
  form:()=>group('',fNum('amount','金额（小写）','',{unit:'元',full:true,ph:'例如 1234567.89',hint:'支持千分位逗号与负数；金额保留到分（第三位小数四舍五入），最大至万亿级。'})),
  calc(v){
   const r=rmbUpper(v.amount);if(!r)return null;
   return {headline:{label:'人民币（大写）',value:r.text},rows:[['小写金额','¥'+r.small],['书写格式','人民币（大写）'+r.text]],notes:['按《支付结算办法》书写规范：到“元”为止的写“整”字，“角”“分”之后不写“整”字；元位为零而角位不为零时只写一个“零”字。']};
  }
 };

 // ───────────── 2. 天数计算 ─────────────
 const toolDays={
  id:'days',title:'天数计算器',desc:'计算日期间隔，或按天数推算日期。',icon:'calendar',accent:'amber',
  form:()=>`${fSeg('mode',[['interval','计算日期间隔'],['add','按期间推算日期']],'interval')}
   ${group('',`${fDate('start','起始日期',todayIso())}${fDate('end','结束日期','')}
    ${fSel('count','计算方式',[['tail','算头不算尾（起始日不计入）'],['both','首尾两日都计入'],['none','首尾两日都不计入']],'tail',{full:true})}`,{when:'mode:interval'})}
   ${group('',`${fDate('base','起算日期（事件发生日／送达日）',todayIso())}
    <div class="lc-field lc-inline"><span>期间</span><div class="lc-inline-row"><span class="lc-input"><input name="len" inputmode="numeric" placeholder="例如 15" autocomplete="off"></span><span class="lc-input lc-narrow"><select name="unit"><option value="day">日</option><option value="month">个月</option><option value="year">年</option></select></span><span class="lc-input lc-narrow"><select name="dir"><option value="after">之后</option><option value="before">之前</option></select></span></div></div>
    ${fSel('incl','起算日',[['exclude','不计入（民法典第 201 条，自次日起算）'],['include','计入（按约定或特别规定）']],'exclude',{full:true})}
    ${fChk('defer','届满日为法定休假日的，顺延至其后第一个工作日',true,{full:true})}`,{when:'mode:add'})}`,
  calc(v){
   if(v.mode==='add'){
    const a=toDay(v.base),k=Math.floor(num(v.len,'期间'));
    if(a==null||!k)return null;
    if(k<0)throw Error('期间请填写正数，并用“之前／之后”选择方向');
    const sg=v.dir==='before'?-1:1;
    let t=v.unit==='day'?a+sg*k:addMonths(a,sg*k*(v.unit==='year'?12:1));
    if(v.incl==='include')t-=sg;
    const rows=[],notes=[],warn=[];
    let final=t;
    if(v.defer&&sg>0){while(isOff(final))final++}
    if(final!==t)rows.push(['原届满日',`${cn(t)}（${weekday(t)}）`,offReason(t)+'，依法顺延']);
    rows.push(['期间届满日',`${cn(final)}（${weekday(final)}）`,'',true]);
    rows.push(['起算日',`${cn(a)}（${weekday(a)}）`]);
    rows.push(['相隔自然日',`${Math.abs(final-a)} 天`]);
    if(v.unit!=='day')notes.push('按月、年计算的，到期月的对应日为期间最后一日；没有对应日的，以月末日为最后一日（民法典第 202 条）。');
    notes.push('期间开始的日不计算在期间内；期间届满的最后一日是法定休假日的，以法定休假日后的第一日为期间届满的日期（民事诉讼法第 85 条、民法典第 203 条）。');
    notes.push('期间不包括在途时间；诉讼文书在期满前交邮的，不算过期。');
    const miss=v.defer&&sg>0?yearsCovered(t,final):[];
    if(miss.length)warn.push(`${miss.join('、')} 年放假安排未内置，仅按周末判断顺延，请核对国务院当年通知。`);
    return {headline:{label:'期间届满日',value:iso(final),sub:weekday(final)},rows,notes,warn};
   }
   const a=toDay(v.start),b=toDay(v.end);
   if(a==null||b==null)return null;
   const lo=Math.min(a,b),hi=Math.max(a,b),raw=hi-lo;
   const days=v.count==='both'?raw+1:v.count==='none'?Math.max(raw-1,0):raw;
   const from=v.count==='both'?lo:lo+1,to=v.count==='none'?hi-1:hi;
   let work=0;for(let d=from;d<=to;d++)if(!isOff(d))work++;
   const dd=diffYMD(lo,hi);
   const warn=[];const miss=yearsCovered(lo,hi);
   if(miss.length)warn.push(`${miss.join('、')} 年放假安排未内置，工作日仅扣除周末。`);
   if(b<a)warn.push('结束日期早于起始日期，已按两者之间的间隔计算。');
   return {headline:{label:'间隔天数',value:days+' 天'},rows:[
    ['折合周数',`${Math.floor(days/7)} 周 ${days%7} 天`],
    ['自然时长',`${dd.years} 年 ${dd.months} 个月 ${dd.days} 天`,'按日历对应日计算'],
    ['其中工作日',`${work} 天`,'扣除周末及法定节假日，计入调休上班日'],
    ['起始日期',`${cn(lo)}（${weekday(lo)}）`],['结束日期',`${cn(hi)}（${weekday(hi)}）`]
   ],warn};
  }
 };

 // ───────────── 3. 律师费 ─────────────
 const RISK_CAPS=[[0,1e6,18],[1e6,5e6,15],[5e6,1e7,12],[1e7,5e7,9],[5e7,Infinity,6]];
 const wan=x=>x===Infinity?'以上':(x/1e4).toLocaleString('zh-CN')+' 万';
 const rangeLabel=(lo,hi)=>hi===Infinity?`${wan(lo)}以上部分`:lo===0?`${wan(hi)}以下（含）`:`${wan(lo)}–${wan(hi)}`;
 const lawyerStd=r=>{const d=LAWYER_STD[r];if(d?.tiers?.length)return {note:'',...d};return {...LAWYER_GENERIC,doc:d?.regime?d.regime+'；以下为通用参考比例，可按律所备案标准修改':LAWYER_GENERIC.doc}};
 function tierRowsHtml(tiers){
  let prev=0;
  return tiers.map(([up,lo,hi])=>{const top=up==null?Infinity:up;const row=`<div class="lc-tier-row" data-row-of="tier"><input type="hidden" data-k="from" value="${prev}"><input type="hidden" data-k="to" value="${top===Infinity?'':top}"><span>${rangeLabel(prev,top)}</span><span class="lc-input"><input data-k="lo" inputmode="decimal" value="${lo}" aria-label="下限比例"><em>%</em></span><span class="lc-input"><input data-k="hi" inputmode="decimal" value="${hi}" aria-label="上限比例"><em>%</em></span></div>`;prev=top;return row}).join('');
 }
 const lawNote=(r,std)=>`${esc(r==='generic'?'通用参考':r)}：${esc(std.doc)}${std.note?'。'+esc(std.note):''}。律师服务收费以律所备案标准及书面委托合同为准。`;
 const toolLawyer={
  id:'lawyer',title:'律师费计算器',desc:'按案件类型与标的额估算律师费。',icon:'abacus',accent:'indigo',
   form:()=>{const r=loadRegion(),std=lawyerStd(r);return `${fSeg('kind',[['tier','按标的额分段'],['risk','风险代理上限'],['hour','计时收费']],'tier')}
   ${group('',`${fSel('region','地区（律所所在地）',regionOpts([['generic','通用参考（自定义）']]),r,{full:true})}${fNum('amount','争议标的额','',{unit:'元',ph:'例如 3000000'})}${fNum('minfee','最低收费',std.min||'',{unit:'元／件'})}
    ${fNum('coef','阶段系数','100',{unit:'%',hint:'一审按 100%；二审、再审、执行等阶段可按约定比例调整。'})}`,{when:'kind:tier',foot:`<div class="lc-tier-table"><div class="lc-tier-head"><span>标的额区间（分段累进）</span><span>下限比例</span><span>上限比例</span></div><div data-tier-box>${tierRowsHtml(std.tiers)}</div></div><p class="lc-tip" data-law-note>${lawNote(r,std)}</p>`})}
   ${group('',`${fNum('ramount','标的额／预期回款额','',{unit:'元'})}${fNum('rrate','约定风险代理比例（可选）','',{unit:'%'})}`,{when:'kind:risk'})}
   ${group('',`${fNum('hours','预计工作时长','',{unit:'小时'})}${fNum('hrate','小时费率','',{unit:'元／小时',ph:'例如 1500'})}`,{when:'kind:hour'})}`},
  bind(form){
   form.querySelector('[name=region]')?.addEventListener('change',e=>{
    const r=e.target.value,std=lawyerStd(r);saveRegion(r);
    form.querySelector('[data-tier-box]').innerHTML=tierRowsHtml(std.tiers);
    form.querySelector('[name=minfee]').value=std.min||'';
    form.querySelector('[data-law-note]').innerHTML=lawNote(r,std);
   });
  },
  calc(v,rowsOf){
   if(v.kind==='hour'){
    const h=num(v.hours,'工作时长'),rate=num(v.hrate,'小时费率');if(!h||!rate)return null;
    return {headline:{label:'预计律师费',value:money(h*rate)},rows:[['计算方式',`${plain(h)} 小时 × ${plain(rate)} 元／小时`]],notes:['计时收费以律所备案的小时费率及书面委托合同为准。']};
   }
   if(v.kind==='risk'){
    const amt=num(v.ramount,'标的额');if(!amt)return null;
    let cap=0;const rows=[];
    for(const [lo,hi,p] of RISK_CAPS){if(amt<=lo)break;const part=Math.min(amt,hi)-lo;cap+=part*p/100;rows.push([rangeLabel(lo,hi),money(part*p/100),`${money(part)} × ${p}%`])}
    const warn=[];const out={headline:{label:'风险代理收费上限',value:money(cap),sub:`占标的额 ${pct(cap/amt*100)}`},rows,warn,notes:[
     '依据司法部、国家发展改革委、市场监管总局《关于进一步规范律师服务收费的意见》（司发通〔2021〕87号）：风险代理收费最高金额按标的额分段累进计算，且含律所已收取的前期基础收费。',
     '禁止风险代理：婚姻、继承案件；请求给予社会保险待遇或最低生活保障待遇，请求给付赡养费、抚养费、扶养费、抚恤金、救济金、工伤赔偿，请求支付劳动报酬等；刑事诉讼、行政诉讼、国家赔偿案件及群体性诉讼案件。']};
    const rr=num(v.rrate,'约定比例');
    if(rr){const fee=amt*rr/100;rows.unshift(['按约定比例计算',money(fee),`${money(amt)} × ${plain(rr)}%`,true]);if(fee>cap+0.005)warn.push(`约定金额超过上限 ${money(fee-cap)}，需调整约定比例。`)}
    return out;
   }
   const amt=num(v.amount,'标的额');if(!amt)return null;
   let lo=0,hi=0;const table=[];
   for(const t of rowsOf('tier')){
    const from=num(t.from),to=t.to===''?Infinity:num(t.to);
    if(amt<=from)continue;
    const part=Math.min(amt,to)-from,pl=num(t.lo,'下限比例'),ph=num(t.hi,'上限比例');
    lo+=part*pl/100;hi+=part*ph/100;
    table.push([rangeLabel(from,to),money(part),`${plain(pl)}%–${plain(ph)}%`,`${money(part*pl/100)} – ${money(part*ph/100)}`]);
   }
   const min=num(v.minfee,'最低收费'),coef=num(v.coef,'阶段系数')||100;
   const notes=[];
   if(min&&(lo<min||hi<min))notes.push(`分段计算结果低于最低收费的，按 ${money(min)} 计。`);
   lo=Math.max(lo,min)*coef/100;hi=Math.max(hi,min)*coef/100;
   if(coef!==100)notes.push(`已乘阶段系数 ${plain(coef)}%。`);
   const std=lawyerStd(v.region);
   notes.push(`比例依据：${v.region==='generic'?'通用参考':v.region}，${std.doc}${std.note?'；'+std.note:''}。`);
   notes.push('结果为收费区间参考，不含差旅、调查取证、鉴定、诉讼费等由委托人另行承担的费用。');
   return {headline:{label:'律师费参考区间',value:`${money(lo)} – ${money(hi)}`,sub:`中间值 ${money((lo+hi)/2)}`},tables:[{title:'分段计算明细',head:['标的额区间','计费金额','比例','金额'],rows:table}],notes};
  }
 };

 // ───────────── 4. 诉讼费 ─────────────
 const PROP_TIERS=[[1e4,1e5,2.5],[1e5,2e5,2],[2e5,5e5,1.5],[5e5,1e6,1],[1e6,2e6,0.9],[2e6,5e6,0.8],[5e6,1e7,0.7],[1e7,2e7,0.6],[2e7,Infinity,0.5]];
 const EXEC_TIERS=[[1e4,5e5,1.5],[5e5,5e6,1],[5e6,1e7,0.5],[1e7,Infinity,0.1]];
 const SAVE_TIERS=[[1e3,1e5,1],[1e5,Infinity,0.5]];
 function tiered(amt,base,baseCap,tiers){
  const rows=[[`${wan(baseCap)}以下（含）`,'—','—',money(base)]];let sum=base;
  if(baseCap<1e4)rows[0][0]=`${baseCap.toLocaleString('zh-CN')} 元以下（含）`;
  for(const [lo,hi,p] of tiers){if(amt<=lo)break;const part=Math.min(amt,hi)-lo;sum+=part*p/100;rows.push([rangeLabel(lo,hi),money(part),p+'%',money(part*p/100)])}
  return {sum,rows};
 }
 const propertyFee=a=>tiered(a,50,1e4,PROP_TIERS);
 function saveFee(a){const t=tiered(a,30,1e3,SAVE_TIERS);const capped=Math.min(t.sum,5000);return {...t,sum:capped,capped:t.sum>5000}}
 const COURT_TYPES=[['property','财产案件'],['divorce','离婚案件'],['personality','侵害人格权案件'],['nonprop','其他非财产案件'],['ip','知识产权民事案件'],['labor','劳动争议案件'],['admin','行政案件'],['exec','申请执行'],['save','申请财产保全（单独计算）'],['payorder','申请支付令'],['notice','申请公示催告'],['arbit','撤销仲裁裁决／认定仲裁协议效力'],['bankrupt','破产案件']];
 const AMOUNT_TYPES='property,divorce,personality,ip,exec,save,payorder,bankrupt';
 const toolCourt={
  id:'court',title:'诉讼费计算器',desc:'计算诉讼费与财产保全费。',icon:'gavel',accent:'teal',
  form:()=>group('',`${fSel('ctype','案件类型',COURT_TYPES,'property',{full:true})}
   ${fNum('amount','争议金额／标的额','',{unit:'元',full:true,when:'ctype:'+AMOUNT_TYPES,hint:'离婚案件填财产分割总额，人格权案件填损害赔偿金额，知识产权案件无争议金额的留空。'})}
   ${fSel('admin','行政案件类别',[['general','其他行政案件'],['special','商标、专利、海事行政案件']],'general',{full:true,when:'ctype:admin'})}
   ${fChk('half','适用简易程序／调解结案／撤诉，受理费减半',false,{full:true,when:'ctype:property,divorce,personality,nonprop,ip,labor,admin'})}
   ${fChk('withSave','同时申请财产保全',false,{full:true,when:'ctype:property,ip'})}
   ${fNum('saveAmount','保全金额','',{unit:'元',full:true,when:'withSave:on',ph:'留空则按标的额计算'})}`),
  calc(v){
   const t=v.ctype,amt=num(v.amount,'金额'),rows=[],tables=[],notes=[],warn=[];
   let low=0,high=0,label='案件受理费';
   const range=(a,b)=>{low=a;high=b};
   const addProp=(a,title='案件受理费分段明细')=>{const p=propertyFee(a);tables.push({title,head:['区间','计费金额','比例','金额'],rows:p.rows});return p.sum};
   if(t==='property'||(t==='ip'&&amt)){if(!amt)return null;const s=addProp(amt);range(s,s)}
   else if(t==='ip'){range(500,1000);notes.push('知识产权民事案件没有争议金额或价额的，每件交纳 500 元至 1000 元；有争议金额的按财产案件标准交纳。')}
   else if(t==='divorce'){range(50,300);if(amt>2e5){const ex=(amt-2e5)*0.005;low+=ex;high+=ex;rows.push(['财产分割超过 20 万元部分',money(ex),`${money(amt-2e5)} × 0.5%`])}notes.push('离婚案件每件交纳 50 元至 300 元；涉及财产分割、财产总额不超过 20 万元的不另行交纳，超过 20 万元的部分按 0.5% 交纳。')}
   else if(t==='personality'){range(100,500);let ex=0;if(amt>5e4){ex+=(Math.min(amt,1e5)-5e4)*0.01}if(amt>1e5){ex+=(amt-1e5)*0.005}if(ex){low+=ex;high+=ex;rows.push(['损害赔偿加收部分',money(ex),'5–10 万元部分 1%，超过 10 万元部分 0.5%'])}notes.push('侵害姓名权、名称权、肖像权、名誉权、荣誉权以及其他人格权的案件，每件交纳 100 元至 500 元；赔偿金额不超过 5 万元的不另行交纳。')}
   else if(t==='nonprop'){range(50,100)}
   else if(t==='labor'){range(10,10)}
   else if(t==='admin'){if(v.admin==='special')range(100,100);else range(50,50)}
   else if(t==='exec'){
    label='申请执行费';
    if(!amt){range(50,500);notes.push('没有执行金额或者价额的，每件交纳 50 元至 500 元。')}
    else{const p=tiered(amt,50,1e4,EXEC_TIERS);tables.push({title:'申请执行费分段明细',head:['区间','计费金额','比例','金额'],rows:p.rows});range(p.sum,p.sum)}
    notes.push('申请执行费执行后交纳，由被执行人负担。');
   }
   else if(t==='save'){label='财产保全费';if(!amt)return null;const p=saveFee(amt);tables.push({title:'保全费分段明细',head:['区间','计费金额','比例','金额'],rows:p.rows});range(p.sum,p.sum);if(p.capped)rows.push(['封顶说明','按 5,000 元封顶','分段合计超过 5,000 元'])}
   else if(t==='payorder'){label='支付令申请费';if(!amt)return null;const p=propertyFee(amt);range(p.sum/3,p.sum/3);rows.push(['计算方式',`财产案件受理费 ${money(p.sum)} × 1/3`])}
   else if(t==='notice'){label='公示催告申请费';range(100,100)}
   else if(t==='arbit'){label='申请费';range(50,400)}
   else if(t==='bankrupt'){label='破产申请费';if(!amt)return null;const s=addProp(amt,'按财产案件标准计算');const h=Math.min(s/2,3e5);range(h,h);rows.push(['计算方式',`财产案件受理费 ${money(s)} 减半${s/2>3e5?'，最高不超过 30 万元':''}`])}
   const halfOk=v.half&&['property','divorce','personality','nonprop','ip','labor','admin'].includes(t);
   const full=[low,high];
   if(halfOk){low/=2;high/=2}
   const fmt=(a,b)=>a===b?money(a):`${money(a)} – ${money(b)}`;
   rows.unshift([label,fmt(low,high),halfOk?`全额 ${fmt(full[0],full[1])}，减半收取`:'',true]);
   let headVal=fmt(low,high),headLabel=label;
   if(v.withSave&&(t==='property'||t==='ip')){
    const sa=num(v.saveAmount,'保全金额')||amt;
    if(sa){const p=saveFee(sa);rows.push(['财产保全费',money(p.sum),`保全金额 ${money(sa)}${p.capped?'，按 5,000 元封顶':''}`,true]);tables.push({title:'保全费分段明细',head:['区间','计费金额','比例','金额'],rows:p.rows});headLabel='受理费 + 保全费';headVal=fmt(low+p.sum,high+p.sum)}
   }
   notes.push('依据《诉讼费用交纳办法》（国务院令第 481 号）。二审按不服一审判决部分的上诉请求数额交纳；各地法院对角分取舍做法不一，以法院缴费通知为准。');
   return {headline:{label:headLabel,value:headVal},rows,tables,notes,warn};
  }
 };

 // ───────────── 5. 利息 / 执行款 ─────────────
 const RATE_TABLE=(kind)=>[...BENCH.map(r=>({d:toDay(r[0]),v:r[kind],src:'贷款基准利率'})),...LPR.map(r=>({d:toDay(r[0]),v:r[kind],src:kind===1?'1年期LPR':'5年期以上LPR'}))];
 function rateAt(table,d){let cur=table[0];for(const t of table){if(t.d<=d)cur=t;else break}return cur}
 function rateCfg(v){
  const c={type:v.rate_type,basis:Number(v.basis)||365};
  if(c.type==='lpr1'||c.type==='lpr5'){c.kind=c.type==='lpr5'?2:1;c.table=RATE_TABLE(c.kind);c.mult=num(v.mult,'倍数')||1;c.add=num(v.add,'加点');c.fixed=v.lpr_mode==='fixed'}
  else if(c.type==='fixed'){c.annual=num(v.fixed_rate,'年利率');if(!c.annual)throw Error('请填写年利率')}
  else{c.daily=num(v.daily_rate,'日利率');if(!c.daily)throw Error('请填写日利率')}
  return c;
 }
 function rateLabel(c){
  if(c.type==='fixed')return `年利率 ${pct(c.annual)}`;
  if(c.type==='daily')return `日利率万分之 ${plain(c.daily)}`;
  return `${c.kind===2?'5年期以上':'1年期'}LPR${c.mult!==1?' × '+plain(c.mult):''}${c.add?(c.add>0?' + ':' − ')+plain(Math.abs(c.add))+' 个百分点':''}${c.fixed?'（固定为起息日利率）':'（随 LPR 调整分段）'}`;
 }
 // 半开区间 [a,b) 的利率分段
 function segments(a,b,c,fixDay){
  if(b<=a)return [];
  if(c.type!=='lpr1'&&c.type!=='lpr5')return [{a,b,annual:c.type==='fixed'?c.annual:null}];
  const eff=t=>({base:t.v,src:t.src,annual:t.v*c.mult+c.add});
  if(c.fixed)return [{a,b,...eff(rateAt(c.table,fixDay??a))}];
  const pts=[a,...c.table.filter(t=>t.d>a&&t.d<b).map(t=>t.d),b];
  const out=[];
  for(let i=0;i<pts.length-1;i++){
   const s={a:pts[i],b:pts[i+1],...eff(rateAt(c.table,pts[i]))},prev=out[out.length-1];
   // 另一期限品种调整时本品种利率不变，合并为同一段
   if(prev&&prev.base===s.base&&prev.src===s.src)prev.b=s.b;else out.push(s);
  }
  return out;
 }
 function accrue(P,a,b,c,fixDay){
  const segs=segments(a,b,c,fixDay).map(s=>{const days=s.b-s.a;const amt=P<=0?0:c.type==='daily'?P*c.daily/10000*days:P*s.annual/100*days/c.basis;return {...s,days,amt}});
  return {amt:segs.reduce((x,s)=>x+s.amt,0),segs};
 }
 const rpct=x=>(Math.round(x*10000)/10000).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:4})+'%';
 const segRow=(s,c)=>[`${iso(s.a)} 至 ${iso(s.b-1)}`,s.days+' 天',c.type==='daily'?`万分之 ${plain(c.daily)}／日`:rpct(s.annual)+(s.base==null?'':(c.mult!==1||c.add)?`（${s.src} ${rpct(s.base)}）`:s.src==='贷款基准利率'?'（基准利率）':''),money(s.amt)];
 function readPays(rows){return rows.map(r=>({d:toDay(r.date),amt:num(r.amount,'还款金额')})).filter(p=>p.d!=null&&p.amt>0).sort((x,y)=>x.d-y.d)}
 const rateFields=()=>`${fSel('rate_type','利率类型',[['lpr1','1年期 LPR（2019-08-20 前为同期贷款基准利率）'],['lpr5','5年期以上 LPR（2019-08-20 前为五年以上基准利率）'],['fixed','固定年利率'],['daily','日利率（万分之）']],'lpr1',{full:true})}
  ${fNum('mult','LPR 倍数','1',{when:'rate_type:lpr1,lpr5',hint:'如逾期利息上浮 50% 填 1.5'})}
  ${fNum('add','加点','0',{unit:'个百分点',when:'rate_type:lpr1,lpr5',hint:'减点填负数'})}
  ${fSel('lpr_mode','LPR 适用方式',[['float','随 LPR 调整分段计算'],['fixed','固定适用起息日的 LPR']],'float',{full:true,when:'rate_type:lpr1,lpr5'})}
  ${fNum('fixed_rate','年利率','',{unit:'%',full:true,when:'rate_type:fixed'})}
  ${fNum('daily_rate','日利率','',{unit:'‱',full:true,when:'rate_type:daily',hint:'万分之五填 5'})}
  ${fSel('basis','年天数基数',[['365','365 天'],['360','360 天']],'365')}
  ${fChk('incl','起止两日均计息',true)}`;
 const toolInterest={
  id:'interest',title:'利息 / 执行款计算器',desc:'计算 LPR 利息、执行款、还款抵扣和迟延履行利息。',icon:'trend',accent:'emerald',
  form:()=>`${fSeg('mode',[['interest','利息计算'],['repay','还款抵扣'],['delay','执行款／迟延履行利息']],'interest')}
   ${group('本金与期间',`${fNum('principal','本金','',{unit:'元',full:true})}
    ${fDate('start','起息日','',{when:'mode:interest,repay'})}${fDate('end','计算截止日',todayIso(),{when:'mode:interest,repay'})}
    ${fNum('costs','实现债权的费用','',{unit:'元',when:'mode:repay',hint:'如保全费、律师费等可主张的费用，留空为 0'})}
    ${fDate('deadline','生效文书确定的履行期间届满日','',{when:'mode:delay'})}${fDate('dend','计算至（实际履行日）',todayIso(),{when:'mode:delay'})}
    ${fNum('other','文书确定的其他金钱债务','',{unit:'元',when:'mode:delay',hint:'违约金、已确定金额的利息、赔偿金等'})}
    ${fNum('dcosts','由被执行人负担的诉讼费等','',{unit:'元',when:'mode:delay',hint:'受理费、保全费、公告费等'})}
    ${fChk('dcostsIn','诉讼费等计入加倍部分债务利息基数',true,{full:true,when:'mode:delay'})}`)}
   ${group('利率',`${fChk('gi','计算一般债务利息（文书判定的利息）',true,{full:true,when:'mode:delay'})}
    ${fDate('gstart','一般债务利息起算日','',{full:true,when:'mode:delay'})}${rateFields()}`)}
   ${group('还款／履行记录',rowsBox('pay','＋ 添加一笔还款',{}),{when:'mode:repay,delay'})}`,
  bind(body){const box=body.querySelector('[data-rows="pay"]');if(box&&!box.children.length)box.insertAdjacentHTML('beforeend',ROW_TPL.pay())},
  calc(v,rowsOf){
   const P0=num(v.principal,'本金');if(!P0)return null;
   const warn=[],notes=[];
   if(v.mode==='delay')return calcDelay(v,P0,rowsOf('pay'));
   const a=toDay(v.start),e=toDay(v.end);if(a==null||e==null)return null;
   if(e<a)throw Error('计算截止日早于起息日');
   const c=rateCfg(v),B=v.incl?e+1:e;
   if((c.type==='lpr1'||c.type==='lpr5')&&a<toDay(BENCH[0][0]))warn.push('起息日早于 2008-12-23，之前的基准利率未内置，已按 2008-12-23 利率计算。');
   if(e>toDay(LPR_CHECKED)&&(c.type==='lpr1'||c.type==='lpr5'))notes.push(`LPR 数据核对至 ${LPR_CHECKED}，之后按最新报价利率延续计算。`);
   if(v.mode==='interest'){
    const r=accrue(P0,a,B,c,a);
    const days=B-a;
    if(c.type==='fixed'&&c.annual>12)notes.push('民间借贷约定利率超过合同成立时一年期 LPR 4 倍的部分不受保护（2025-05-20 起为 12%）。');
    return {headline:{label:'利息合计',value:money(r.amt),sub:`本息合计 ${money(P0+r.amt)}`},rows:[['本金',money(P0)],['计息期间',`${iso(a)} 至 ${iso(B-1)}，共 ${days} 天`],['利率',rateLabel(c)],['年天数基数',c.type==='daily'?'不适用':c.basis+' 天']],tables:[{title:'分段明细',head:['期间','天数','年利率','利息'],rows:r.segs.map(s=>segRow(s,c))}],notes,warn};
   }
   // 还款抵扣：费用 → 利息 → 本金（民法典第 561 条）
   const pays=readPays(rowsOf('pay'));
   let P=P0,I=0,F=num(v.costs,'费用'),cur=a,totalI=0;const table=[];
   for(const p of pays){
    if(p.d>e){warn.push(`${iso(p.d)} 的还款晚于计算截止日，未计入。`);continue}
    const cut=Math.max(cur,v.incl?p.d+1:p.d);
    const acc=accrue(P,cur,cut,c,a);I+=acc.amt;totalI+=acc.amt;cur=cut;
    let left=p.amt;const tf=Math.min(left,F);F-=tf;left-=tf;const ti=Math.min(left,I);I-=ti;left-=ti;const tp=Math.min(left,P);P-=tp;left-=tp;
    table.push([iso(p.d),money(p.amt),money(tf),money(ti),money(tp),money(P),money(I)]);
    if(left>0.004)warn.push(`${iso(p.d)} 的还款在清偿全部债务后仍余 ${money(left)}。`);
   }
   const last=accrue(P,cur,B,c,a);I+=last.amt;totalI+=last.amt;
   return {headline:{label:`截至 ${iso(e)} 尚欠合计`,value:money(P+I+F)},rows:[['剩余本金',money(P)],['未付利息',money(I)],['未付费用',money(F)],['期间累计产生利息',money(totalI)],['利率',rateLabel(c)]],tables:[{title:'还款抵扣明细',head:['还款日','还款额','抵扣费用','抵扣利息','抵扣本金','剩余本金','未付利息'],rows:table}],notes:['还款依次抵充实现债权的有关费用、利息、主债务（民法典第 561 条）；当事人另有约定的从其约定。',...notes],warn};
  }
 };
 function calcDelay(v,P0,payRows){
  const dl=toDay(v.deadline),e=toDay(v.dend);if(dl==null||e==null)return null;
  if(e<dl)throw Error('计算日期早于履行期间届满日');
  const warn=[],notes=[];
  const gi=Boolean(v.gi),gs=toDay(v.gstart);
  let c=null;
  if(gi){if(gs==null)throw Error('请填写一般债务利息起算日');c=rateCfg(v)}
  const B=v.incl?e+1:e,inBase=Boolean(v.dcostsIn);
  let P=P0,S=num(v.other,'其他金钱债务'),F=num(v.dcosts,'诉讼费'),GI=0,D=0,totGI=0,totD=0,cur=gi?Math.min(gs,dl):dl;
  const RATE=1.75/10000;
  const step=to=>{
   if(to<=cur)return;
   if(gi){const a=Math.max(cur,gs);if(to>a){const r=accrue(P,a,to,c,gs);GI+=r.amt;totGI+=r.amt}}
   const da=Math.max(cur,dl);if(to>da){const base=P+S+(inBase?F:0);const amt=base*RATE*(to-da);D+=amt;totD+=amt}
   cur=to;
  };
  const table=[];
  for(const p of readPays(payRows)){
   if(p.d>e){warn.push(`${iso(p.d)} 的履行款晚于计算日期，未计入。`);continue}
   step(Math.max(cur,v.incl?p.d+1:p.d));
   let left=p.amt;const take=x=>{const t=Math.min(left,x);left-=t;return t};
   const tf=take(F);F-=tf;const tg=take(GI);GI-=tg;const ts=take(S);S-=ts;const tp=take(P);P-=tp;const td=take(D);D-=td;
   table.push([iso(p.d),money(p.amt),money(tf+tg+ts+tp),money(td),money(P+S+F+GI),money(D)]);
   if(left>0.004)warn.push(`${iso(p.d)} 的履行款在清偿全部债务后仍余 ${money(left)}。`);
  }
  step(B);
  if(dl<toDay('2014-08-01'))warn.push('履行期间届满日早于 2014-08-01，此前的迟延履行利息计算方法不同，请分段核对。');
  const total=P+S+F+GI+D;
  const rows=[['剩余本金',money(P)],['剩余其他金钱债务',money(S)],['剩余诉讼费等',money(F)]];
  if(gi)rows.push(['未付一般债务利息',money(GI),`期间累计 ${money(totGI)}；${rateLabel(c)}`]);
  rows.push(['未付加倍部分债务利息',money(D),`期间累计 ${money(totD)}；日万分之 1.75，自 ${iso(dl)} 起算`]);
  notes.push('加倍部分债务利息 = 尚未清偿的生效法律文书确定的除一般债务利息之外的金钱债务 × 日万分之 1.75 × 迟延履行期间（最高法《关于执行程序中计算迟延履行期间的债务利息适用法律若干问题的解释》第一条）。');
  notes.push('加倍部分债务利息自履行期间届满之日起计算，分次履行的相应部分计算至每次履行完毕之日（同解释第三条）。');
  notes.push('被执行人财产不足以清偿全部债务的，先清偿生效法律文书确定的金钱债务（本计算器按费用、一般债务利息、其他金钱债务、本金顺序），再清偿加倍部分债务利息（同解释第四条）。');
  return {headline:{label:`截至 ${iso(e)} 应执行款合计`,value:money(total)},rows,tables:table.length?[{title:'履行抵扣明细',head:['履行日','履行额','抵扣文书确定债务','抵扣加倍利息','剩余文书确定债务','剩余加倍利息'],rows:table}]:[],notes,warn};
 }

 // ───────────── 6. 交通事故 ─────────────
 const JQ={fault:[18000,180000,2000],nofault:[1800,18000,100]};
 const compYears=age=>age<60?20:age<75?20-(age-60):5;
 const injNote=r=>{if(r==='custom')return '请按受诉法院所在地上一年度统计数据手动填写。';const d=INJURY_STD[r];if(!d)return `${esc(r)}暂无内置数据，请手动填写。`;return `${esc(r)} ${INJURY_YEAR}参考值${d.note?'；'+esc(d.note):''}。计划单列市等地区有单独标准的，以当地法院公布为准。`};
 const toolTraffic={
  id:'traffic',title:'交通事故赔偿计算器',desc:'计算伤残、死亡、被扶养人等交通事故赔偿。',icon:'shield',accent:'cobalt',
  form:()=>`${fSeg('kind',[['injury','受伤（未构成伤残）'],['disability','构成伤残'],['death','死亡']],'disability')}
   ${(()=>{const r=loadRegion(),d=INJURY_STD[r]||{};return group(`赔偿标准 <small>选择地区后自动填入，可修改</small>`,`${fSel('region','受诉法院所在地',regionOpts([['custom','自定义（手动填写）']]),r,{full:true})}${fNum('income','城镇居民人均可支配收入',d.income??'',{unit:'元／年'})}${fNum('consume','城镇居民人均消费支出',d.consume??'',{unit:'元／年'})}
    ${fNum('wage','职工年平均工资（丧葬费）',d.wage??'',{unit:'元／年',when:'kind:death'})}${fNum('meal','住院伙食补助标准',d.meal??'',{unit:'元／天'})}`,{foot:`<p class="lc-tip" data-inj-note>${injNote(r)}</p>`})})()}
   ${group('受害人',`${fNum('age','受害人年龄（定残／死亡时）','',{unit:'周岁'})}
    ${fSel('level','最高伤残等级',[1,2,3,4,5,6,7,8,9,10].map(i=>[i,`${'一二三四五六七八九十'[i-1]}级（${110-i*10}%）`]),10,{when:'kind:disability'})}
    ${fNum('extra','多处伤残附加指数','0',{unit:'%',when:'kind:disability',hint:'通常不超过 10%，赔偿系数合计不超过 100%'})}`)}
   ${group('各项损失',`${fNum('med','医疗费','',{unit:'元'})}${fNum('follow','后续治疗费','',{unit:'元'})}
    ${fNum('hosp','住院天数','',{unit:'天'})}${fNum('nutri','营养费','',{unit:'元'})}
    ${fNum('lostDay','误工收入','',{unit:'元／天'})}${fNum('lostDays','误工天数','',{unit:'天'})}
    ${fNum('nurseDay','护理费标准','',{unit:'元／天'})}${fNum('nurseDays','护理天数','',{unit:'天'})}
    ${fNum('nurseN','护理人数','1',{unit:'人'})}${fNum('traffic','交通费','',{unit:'元'})}
    ${fNum('lodge','住宿费','',{unit:'元'})}${fNum('aid','残疾辅助器具费','',{unit:'元',when:'kind:disability'})}
    ${fNum('mental','精神损害抚慰金','',{unit:'元'})}${fNum('prop','财产损失（车损等）','',{unit:'元'})}
    ${fNum('appraise','鉴定费','',{unit:'元'})}${fNum('misc','其他费用','',{unit:'元'})}`)}
   ${group('被扶养人',rowsBox('dep','＋ 添加被扶养人'),{when:'kind:disability,death'})}
   ${group('责任分担',`${fChk('jq','先由交强险在限额内赔付',true,{full:true})}
    ${fSel('jqFault','交强险责任',[['fault','被保险人有责'],['nofault','被保险人无责']],'fault',{when:'jq:on'})}
    ${fNum('ratio','超出交强险部分的责任比例','100',{unit:'%',hint:'对方（商业险／侵权人）承担比例'})}`)}`,
  bind(form){
   form.querySelector('[name=region]')?.addEventListener('change',e=>{
    const r=e.target.value,d=INJURY_STD[r];saveRegion(r);
    if(d)for(const k of ['income','consume','wage','meal']){const el=form.querySelector(`[name=${k}]`);if(el)el.value=d[k]??''}
    form.querySelector('[data-inj-note]').innerHTML=injNote(r);
   });
   const box=form.querySelector('[data-rows="dep"]');if(box&&!box.children.length)box.insertAdjacentHTML('beforeend',ROW_TPL.dep());
  },
  calc(v,rowsOf){
   const k=v.kind,age=num(v.age,'年龄'),inc=num(v.income,'人均可支配收入'),con=num(v.consume,'人均消费支出');
   const items=[];// [名称, 金额, 说明, 交强险分项 med|dd|prop|none]
   const add=(name,amt,note,g)=>{if(amt>0)items.push([name,amt,note,g])};
   add('医疗费',num(v.med),'','med');add('后续治疗费',num(v.follow),'','med');
   const hosp=num(v.hosp,'住院天数'),meal=num(v.meal);add('住院伙食补助费',hosp*meal,`${plain(meal)} 元／天 × ${plain(hosp)} 天`,'med');
   add('营养费',num(v.nutri),'','med');
   const ld=num(v.lostDay),lds=num(v.lostDays);add('误工费',ld*lds,`${plain(ld)} 元／天 × ${plain(lds)} 天`,'dd');
   const nd=num(v.nurseDay),nds=num(v.nurseDays),nn=num(v.nurseN)||1;add('护理费',nd*nds*nn,`${plain(nd)} 元／天 × ${plain(nds)} 天 × ${plain(nn)} 人`,'dd');
   add('交通费',num(v.traffic),'','dd');add('住宿费',num(v.lodge),'','dd');
   const warn=[],notes=[];
   let coef=1;
   if(k==='disability'||k==='death'){
    if(String(v.age).trim()==='')return null;
    if(age<0)throw Error('年龄不能为负数');
    const yrs=compYears(age);
    if(k==='disability'){
     coef=Math.min(1,(110-num(v.level)*10)/100+num(v.extra)/100);
     add('残疾赔偿金',inc*yrs*coef,`${plain(inc)} 元 × ${plain(yrs)} 年 × ${pct(coef*100)}`,'dd');
     add('残疾辅助器具费',num(v.aid),'','dd');
    }else{
     add('死亡赔偿金',inc*yrs,`${plain(inc)} 元 × ${plain(yrs)} 年`,'dd');
     const w=num(v.wage);add('丧葬费',w/2,`${plain(w)} 元 ÷ 12 × 6 个月`,'dd');
    }
    const deps=rowsOf('dep').map(r=>({type:r.type,age:num(r.age,'被扶养人年龄'),n:Math.max(1,Math.floor(num(r.count,'扶养人数'))||1),raw:r.age})).filter(d=>String(d.raw).trim()!=='');
    if(deps.length){
     const cap=con*coef;
     const list=deps.map(d=>({...d,years:d.type==='minor'?Math.max(0,18-d.age):compYears(d.age),share:con*coef/d.n}));
     const maxY=Math.ceil(Math.max(...list.map(d=>d.years)));
     let tot=0,capped=false;
     for(let y=0;y<maxY;y++){const s=list.reduce((x,d)=>x+d.share*clamp(d.years-y,0,1),0);if(s>cap)capped=true;tot+=Math.min(s,cap)}
     add('被扶养人生活费',tot,list.map(d=>`${d.type==='minor'?'未成年':'成年'} ${plain(d.age)} 岁：${plain(con)}${coef<1?' × '+pct(coef*100):''} ÷ ${d.n} × ${plain(d.years)} 年`).join('；')+(capped?'；部分年度按年度总额上限计算':''),'dd');
     notes.push('被扶养人生活费计入残疾赔偿金或死亡赔偿金；被扶养人有数人的，年赔偿总额累计不超过上一年度城镇居民人均消费支出额。');
    }
   }
   add('精神损害抚慰金',num(v.mental),'','dd');add('财产损失',num(v.prop),'','prop');
   add('鉴定费',num(v.appraise),'不属交强险赔付范围','none');add('其他费用',num(v.misc),'','none');
   if(!items.length)return null;
   const total=items.reduce((x,i)=>x+i[1],0);
   const sumOf=g=>items.filter(i=>i[3]===g).reduce((x,i)=>x+i[1],0);
   const rows=items.map(i=>[i[0],money(i[1]),i[2]]);
   rows.push(['损失合计',money(total),'',true]);
   let jqPay=0;
   if(v.jq){
    const lim=JQ[v.jqFault]||JQ.fault;
    const pm=Math.min(sumOf('med'),lim[0]),pd=Math.min(sumOf('dd'),lim[1]),pp=Math.min(sumOf('prop'),lim[2]);
    jqPay=pm+pd+pp;
    rows.push(['交强险赔付',money(jqPay),`医疗费用 ${money(pm)}（限额 ${lim[0].toLocaleString()}）＋死亡伤残 ${money(pd)}（限额 ${lim[1].toLocaleString()}）＋财产 ${money(pp)}（限额 ${lim[2].toLocaleString()}）`]);
   }
   const ratio=num(v.ratio,'责任比例');const rest=(total-jqPay)*ratio/100;
   rows.push([`超出部分按 ${plain(ratio)}% 承担`,money(rest),`(${money(total)} − ${money(jqPay)}) × ${plain(ratio)}%`]);
   if(k!=='injury')notes.unshift(`赔偿年限：60 周岁以下按 20 年；60 周岁以上每增加 1 岁减少 1 年；75 周岁以上按 5 年。自 2022-05-01 起统一按城镇居民标准计算（最高法人身损害赔偿司法解释第 12、15 条）。`);
   notes.push('交强险分项限额（2020-09-19 起）：有责 死亡伤残 18 万元、医疗费用 1.8 万元、财产损失 2000 元；无责 1.8 万元、1800 元、100 元。',`统计数据：${v.region==='custom'?'手动填写':v.region+' '+INJURY_YEAR+'参考值'}，以受诉法院所在地上一年度标准为准，请按审理年度核对。`);
   return {headline:{label:'可获赔偿合计',value:money(jqPay+rest),sub:`损失合计 ${money(total)}`},rows,notes,warn};
  }
 };

 // ───────────── 7. 劳动争议 ─────────────
 const LEVEL_OPTS=[1,2,3,4,5,6,7,8,9,10].map(i=>[i,'一二三四五六七八九十'[i-1]+'级']);
 const INJ_ONCE=[27,25,23,21,18,16,13,11,9,7];
 const INJ_MED_SC={5:14,6:12,7:10,8:8,9:6,10:4};
 const INJ_JOB_SC={5:60,6:48,7:26,8:18,9:10,10:6};
 const INJ_ALLOW={1:90,2:85,3:80,4:75,5:70,6:60};
 const toolLabor={
  id:'labor',title:'劳动争议计算器',desc:'计算解除补偿（N / N+1 / 2N）、加班工资、未签合同二倍工资、未休年假、竞业限制补偿、工伤伤残补助金。',icon:'briefcase',accent:'plum',
  form:()=>`${fSeg('mode',[['sever','解除补偿 N／N+1／2N'],['overtime','加班工资'],['double','未签合同二倍工资'],['leave','未休年假'],['noncompete','竞业限制补偿'],['injury','工伤伤残补助金']],'sever',{small:true})}
   ${group('',`${fDate('sStart','入职日期','')}${fDate('sEnd','劳动合同解除／终止日期',todayIso())}
    ${fNum('sWage','解除前 12 个月平均工资','',{unit:'元／月',hint:'应得工资，含奖金、津贴、补贴'})}${fNum('sLast','上一个月工资（代通知金）','',{unit:'元／月',hint:'留空按月平均工资'})}
    ${fNum('sAvg','用人单位所在地上年度职工月平均工资',SC_AVG_MONTH,{unit:'元／月',full:true,hint:'用于判断三倍封顶；默认四川省全口径月平均工资，请按当地公布值修改'})}`,{when:'mode:sever'})}
   ${group('',`${fNum('oWage','加班工资计算基数','',{unit:'元／月'})}${fNum('oDays','月计薪天数','21.75',{unit:'天'})}
    ${fNum('oH1','工作日延时加班','',{unit:'小时'})}${fNum('oH2','休息日加班（未安排补休）','',{unit:'小时'})}${fNum('oH3','法定节假日加班','',{unit:'小时'})}`,{when:'mode:overtime'})}
   ${group('',`${fDate('dHire','用工之日（入职日期）','')}${fDate('dSign','订立书面合同日／离职日','',{hint:'仍未订立的填计算截止日'})}
    ${fNum('dWage','月工资','',{unit:'元／月',full:true})}`,{when:'mode:double'})}
   ${group('',`${fNum('lWage','月工资','',{unit:'元／月'})}${fSel('lYears','累计工作年限',[['0','不满 1 年'],['1','满 1 年不满 10 年'],['10','满 10 年不满 20 年'],['20','满 20 年']],'1')}
    ${fDate('lFrom','当年度在本单位起算日',new Date().getFullYear()+'-01-01')}${fDate('lTo','截止日（离职日）',todayIso())}
    ${fNum('lTaken','当年度已休年假','0',{unit:'天',full:true})}`,{when:'mode:leave'})}
   ${group('',`${fNum('cWage','解除前 12 个月平均工资','',{unit:'元／月'})}${fNum('cRatio','补偿比例','30',{unit:'%'})}
    ${fNum('cMin','履行地最低工资标准',SC_MIN_WAGE,{unit:'元／月',hint:'默认成都市第一档'})}${fNum('cMonths','竞业限制期限','24',{unit:'个月',hint:'最长不超过 2 年'})}`,{when:'mode:noncompete'})}
   ${group('',`${fSel('iLevel','伤残等级',[...LEVEL_OPTS,['death','因工死亡']],'10')}${fNum('iWage','本人工资（受伤前 12 个月平均）','',{unit:'元／月',when:'iLevel:1,2,3,4,5,6,7,8,9,10'})}
    ${fNum('iAvg','统筹地区上年度职工月平均工资',SC_AVG_MONTH,{unit:'元／月',hint:'默认四川 2025 年度工伤待遇计发基数'})}
    ${fNum('iNat','上一年度全国城镇居民人均可支配收入',NATIONAL_URBAN_INCOME,{unit:'元',when:'iLevel:death'})}
    ${fChk('iQuit','五至十级：解除或终止劳动关系（计算一次性医疗补助金、就业补助金）',true,{full:true,when:'iLevel:5,6,7,8,9,10'})}`,{when:'mode:injury'})}`,
  calc(v){
   const m=v.mode;
   if(m==='sever'){
    const a=toDay(v.sStart),b=toDay(v.sEnd),w=num(v.sWage,'月平均工资');if(a==null||b==null||!w)return null;
    if(b<a)throw Error('解除日期早于入职日期');
    const d=diffYMD(a,b+1);
    const rem=d.months||d.days?(d.months>=6?1:0.5):0;
    let years=d.years+rem,base=w;const avg=num(v.sAvg,'月平均工资'),notes=[],rows=[];
    const capped=avg>0&&w>avg*3;
    if(capped){base=avg*3;if(years>12){years=12}}
    const N=base*years,last=num(v.sLast)||w;
    rows.push(['工作年限',`${d.years} 年 ${d.months} 个月 ${d.days} 天`,`折算 ${plain(d.years+rem)} 个月工资`]);
    rows.push(['补偿基数',money(base),capped?`月工资超过当地职工月平均工资三倍，按 ${money(avg)} × 3 计，年限最高 12 年`:'']);
    rows.push(['经济补偿 N',money(N),`${money(base)} × ${plain(years)}`,true]);
    rows.push(['N+1（未提前 30 日通知）',money(N+last),`另加一个月工资 ${money(last)}`,true]);
    rows.push(['2N（违法解除赔偿金）',money(N*2),'经济补偿标准的二倍',true]);
    notes.push('每满一年支付一个月工资；六个月以上不满一年的按一年计算；不满六个月的支付半个月工资（劳动合同法第 47 条）。','N+1 适用劳动合同法第 40 条（无过失性辞退）未提前三十日书面通知的情形；2N 适用第 87 条违法解除或终止。');
    if(a<toDay('2008-01-01'))notes.push('工作年限跨 2008-01-01 的，此前年限按当时规定计算经济补偿，且部分情形不适用三倍封顶，请分段核对。');
    return {headline:{label:'经济补偿 N',value:money(N)},rows,notes};
   }
   if(m==='overtime'){
    const w=num(v.oWage,'工资基数'),days=num(v.oDays,'计薪天数')||21.75;if(!w)return null;
    const hr=w/days/8,h1=num(v.oH1),h2=num(v.oH2),h3=num(v.oH3);
    const a1=hr*1.5*h1,a2=hr*2*h2,a3=hr*3*h3;
    return {headline:{label:'加班工资合计',value:money(a1+a2+a3)},rows:[['小时工资',money(hr),`${money(w)} ÷ ${plain(days)} ÷ 8`],['工作日延时（150%）',money(a1),`${plain(h1)} 小时`],['休息日（200%）',money(a2),`${plain(h2)} 小时`],['法定节假日（300%）',money(a3),`${plain(h3)} 小时`]],notes:['依据劳动法第 44 条；休息日安排工作又能安排补休的，不支付休息日加班工资。','月计薪天数 21.75 天＝（365 天 − 104 天休息日）÷ 12 个月。']};
   }
   if(m==='double'){
    const h=toDay(v.dHire),s=toDay(v.dSign),w=num(v.dWage,'月工资');if(h==null||s==null||!w)return null;
    const start=addMonths(h,1),stop=Math.min(s,addMonths(h,12));
    if(stop<=start)return {headline:{label:'二倍工资差额',value:money(0)},rows:[['说明','自用工之日起一个月内订立书面劳动合同的，无需支付二倍工资']]};
    const d=diffYMD(start,stop);const anchor=addMonths(start,d.total),[yy,mm]=ymd(anchor);
    const months=d.total+d.days/dim(yy,mm);
    const notes=['自用工之日起超过一个月不满一年未订立书面劳动合同的，应向劳动者每月支付二倍工资，最长 11 个月（劳动合同法第 82 条、实施条例第 7 条）。','满一年仍未订立的，视为已订立无固定期限劳动合同。二倍工资差额适用一年仲裁时效，按月分别计算。'];
    return {headline:{label:'二倍工资差额',value:money(w*months)},rows:[['计算期间',`${iso(start)} 至 ${iso(stop-1)}`],['月数',`${d.total} 个月 ${d.days} 天`,`折合 ${plain(months)} 个月`],['计算方式',`${money(w)} × ${plain(months)} 个月`]],notes};
   }
   if(m==='leave'){
    const w=num(v.lWage,'月工资'),a=toDay(v.lFrom),b=toDay(v.lTo);if(!w||a==null||b==null)return null;
    if(b<a)throw Error('截止日早于起算日');
    const ent={0:0,1:5,10:10,20:15}[v.lYears]??5,days=b-a+1;
    const share=Math.floor(days/365*ent),taken=num(v.lTaken),left=Math.max(0,share-taken),day=w/21.75;
    return {headline:{label:'未休年假工资报酬',value:money(day*left*2)},rows:[['全年应休',`${ent} 天`],['折算应休',`${share} 天`,`${days} ÷ 365 × ${ent}，不足 1 天的部分不计`],['未休天数',`${left} 天`,`已休 ${plain(taken)} 天`],['日工资',money(day),`${money(w)} ÷ 21.75`],['计算方式',`${money(day)} × ${left} 天 × 200%`]],notes:['未休年休假按日工资收入的 300% 支付，其中包含正常工作期间的工资收入，故额外应付 200%（《职工带薪年休假条例》第 5 条、实施办法第 10 条）。','累计工作满 1 年不满 10 年 5 天，满 10 年不满 20 年 10 天，满 20 年 15 天。']};
   }
   if(m==='noncompete'){
    const w=num(v.cWage,'月平均工资'),months=num(v.cMonths,'期限');if(!w||!months)return null;
    const ratio=num(v.cRatio,'比例'),min=num(v.cMin,'最低工资'),calc=w*ratio/100,mon=Math.max(calc,min);
    const warn=months>24?['竞业限制期限不得超过二年（劳动合同法第 24 条）。']:[];
    return {headline:{label:'竞业限制补偿合计',value:money(mon*months)},rows:[['每月补偿',money(mon),calc<min?`${money(calc)} 低于最低工资标准，按 ${money(min)} 计`:`${money(w)} × ${plain(ratio)}%`],['期限',`${plain(months)} 个月`]],notes:['当事人未约定经济补偿的，按劳动者解除或终止前十二个月平均工资的 30% 按月支付；低于劳动合同履行地最低工资标准的，按最低工资标准支付（劳动争议司法解释（一）第 36 条）。'],warn};
   }
   if(m==='injury'){
    const avg=num(v.iAvg,'月平均工资');
    if(v.iLevel==='death'){
     const nat=num(v.iNat,'人均可支配收入');if(!nat)return null;
     return {headline:{label:'工亡一次性待遇合计',value:money(nat*20+avg*6)},rows:[['一次性工亡补助金',money(nat*20),`${plain(nat)} 元 × 20`],['丧葬补助金',money(avg*6),`${plain(avg)} 元 × 6 个月`]],notes:['供养亲属抚恤金按月另行计发（配偶 40%，其他亲属每人 30%，孤寡老人或孤儿每人每月加发 10%）。','依据《工伤保险条例》第 39 条；一次性工亡补助金按上一年度全国城镇居民人均可支配收入的 20 倍计算。']};
    }
    const w=num(v.iWage,'本人工资'),lv=Number(v.iLevel);if(!w)return null;
    const base=avg?clamp(w,avg*0.6,avg*3):w;
    const once=base*INJ_ONCE[lv-1];const rows=[['计发工资',money(base),base!==w?`本人工资按统筹地区职工月平均工资的 ${w<avg*0.6?'60%':'300%'} 计`:'本人工资'],['一次性伤残补助金',money(once),`${money(base)} × ${INJ_ONCE[lv-1]} 个月`,true]];
    let total=once;const notes=['依据《工伤保险条例》第 35–37 条；本人工资低于统筹地区职工平均工资 60% 的按 60% 计，高于 300% 的按 300% 计。'];
    if(INJ_ALLOW[lv])rows.push(['伤残津贴（按月）',money(base*INJ_ALLOW[lv]/100),`${money(base)} × ${INJ_ALLOW[lv]}%${lv>=5?'，难以安排工作的':''}`]);
    if(lv>=5&&v.iQuit){
     const med=avg*INJ_MED_SC[lv],job=avg*INJ_JOB_SC[lv];total+=med+job;
     rows.push(['一次性工伤医疗补助金',money(med),`${money(avg)} × ${INJ_MED_SC[lv]} 个月（工伤保险基金支付）`]);
     rows.push(['一次性伤残就业补助金',money(job),`${money(avg)} × ${INJ_JOB_SC[lv]} 个月（用人单位支付）`]);
     notes.push('五至十级一次性工伤医疗补助金、伤残就业补助金月数参照《四川省〈工伤保险条例〉实施办法》，以上年度全省城镇全部单位就业人员月平均工资为基数；职业病、距法定退休年龄不足 5 年等情形另有增减规定，请核对。');
    }
    return {headline:{label:'一次性待遇合计',value:money(total)},rows,notes};
   }
   return null;
  }
 };

 // ───────────── 8. 增值税计算器 ─────────────
 const VAT_RATES=[
  ['6','6%（现代服务／律师咨询／金融／生活服务）'],
  ['13','13%（一般货物销售／加工修理修配／有形动产租赁）'],
  ['9','9%（建筑／不动产租赁与销售／交通运输／基础电信）'],
  ['3','3%（小规模纳税人基本征收率／简易计税）'],
  ['1','1%（小规模纳税人阶段性优惠征收率）'],
  ['5','5%（不动产租赁／转让／差额简易计税）'],
  ['0','0%（出口货物／跨境应税服务）'],
  ['custom','自定义税率／征收率']
 ];
 const VAT_OUT_RATES=[
  ['6','6%（现代服务／律师咨询／金融／生活服务）'],
  ['13','13%（一般货物销售／加工修理修配／有形动产租赁）'],
  ['9','9%（建筑／不动产租赁与销售／交通运输）'],
  ['0','0%（零税率）'],
  ['custom','自定义销项税率']
 ];
 const VAT_IN_RATES=[
  ['13','13%（一般货物／设备采购）'],
  ['9','9%（建筑／不动产／交通运输）'],
  ['6','6%（现代服务／咨询服务）'],
  ['3','3%（小规模专票／简易计税）'],
  ['1','1%（小规模 1% 专票）'],
  ['custom','自定义进项税率']
 ];
 function calcVatGross(gross,ratePct){
  if(ratePct<0)throw Error('税率不能为负数');
  const r=ratePct/100;
  const g=r2(gross);
  const net=r2(g/(1+r));
  const tax=r2(g-net);
  return {gross:g,net,tax,rate:ratePct};
 }
 function calcVatNet(net,ratePct){
  if(ratePct<0)throw Error('税率不能为负数');
  const r=ratePct/100;
  const n=r2(net);
  const tax=r2(n*r);
  const gross=r2(n+tax);
  return {gross,net:n,tax,rate:ratePct};
 }
 function calcSurcharge(vatPayable,cityPct=7,halfRelief=false){
  const base=Math.max(0,r2(vatPayable));
  const mult=halfRelief?0.5:1;
  const city=r2(base*(cityPct/100)*mult);
  const edu=r2(base*0.03*mult);
  const localEdu=r2(base*0.02*mult);
  const total=r2(city+edu+localEdu);
  return {base,city,edu,localEdu,total,cityPct,halfRelief,combinedRate:(cityPct+5)*mult};
 }
 function resolveVatRate(preset,customVal,label){
  if(preset==='custom'){
   if(String(customVal??'').trim()==='')throw Error('请填写'+label);
   const x=num(customVal,label);
   if(x<0||x>100)throw Error(label+'须在 0%–100% 之间');
   return x;
  }
  return num(preset,label);
 }
 function appendSurchargeRows(rows,notes,vatAmt,v){
  if(!v.withSur)return;
  const cityPct=num(v.cityRate,'城建税率')||7;
  const sur=calcSurcharge(vatAmt,cityPct,Boolean(v.halfRelief));
  if(sur.base<=0){
   rows.push(['附加税费合计',money(0),'应纳增值税为 0，无需缴纳附加税费']);
   return;
  }
  const tag=sur.halfRelief?' × 50%（减半优惠）':'';
  rows.push(['城市维护建设税',money(sur.city),`${money(sur.base)} × ${plain(cityPct)}%${tag}`]);
  rows.push(['教育费附加',money(sur.edu),`${money(sur.base)} × 3%${tag}`]);
  rows.push(['地方教育附加',money(sur.localEdu),`${money(sur.base)} × 2%${tag}`]);
  rows.push(['附加税费合计',money(sur.total),`综合附加税率 ${plain(sur.combinedRate)}%（占增值税额）`,true]);
  rows.push(['增值税及附加税费合计',money(sur.base+sur.total),`${money(sur.base)} + ${money(sur.total)}`,true]);
  notes.push('附加税费以实际缴纳的增值税额为计税依据：城建税（市区 7%／县镇 5%／其他 1%）＋教育费附加 3%＋地方教育附加 2%。小型微利企业、小规模纳税人及个体工商户可按规定享受「六税两费」减半征收优惠（执行至 2027 年 12 月 31 日）。');
 }
 const toolVat={
  id:'vat',title:'增值税计算器',desc:'含税／不含税价税互算，一般纳税人销项进项及附加税费测算。',icon:'tax',accent:'slate',
  form:()=>`${fSeg('vmode',[['fromGross','含税价 → 不含税／税额'],['fromNet','不含税价 → 含税／税额'],['payable','应纳税额（销项 − 进项）']],'fromGross')}
   ${group('',`${fNum('gross','含税金额（价税合计）','',{unit:'元',full:true,ph:'例如 106000',when:'vmode:fromGross',hint:'适用于合同约定含税总价、发票价税合计倒算不含税金额与增值税额。'})}
    ${fNum('net','不含税金额','',{unit:'元',full:true,ph:'例如 100000',when:'vmode:fromNet',hint:'适用于按不含税报价正算增值税额与开票价税合计。'})}
    ${fSel('ratePreset','适用税率／征收率',VAT_RATES,'6',{full:true})}
    ${fNum('customRate','自定义税率／征收率','',{unit:'%',full:true,ph:'例如 2 或 1.5',when:'ratePreset:custom'})}`,{when:'vmode:fromGross,fromNet'})}
   ${group('销项与进项（一般纳税人）',`${fNum('outAmt','销项金额','',{unit:'元',ph:'例如 1060000'})}
    ${fSel('outBasis','销项金额口径',[['gross','含税销售额'],['net','不含税销售额']],'gross')}
    ${fSel('outRate','销项适用税率',VAT_OUT_RATES,'6',{full:true})}
    ${fNum('outCustomRate','自定义销项税率','',{unit:'%',full:true,ph:'例如 6',when:'outRate:custom'})}
    ${fNum('inAmt','进项金额／税额（选填）','',{unit:'元',ph:'无进项可留空或填 0'})}
    ${fSel('inBasis','进项填报方式',[['gross','含税采购额'],['net','不含税采购额'],['tax','直接填写可抵扣进项税额']],'gross')}
    <div class="lc-fields lc-span-full" data-when="inBasis:gross,net">
     ${fSel('inRate','进项适用税率',VAT_IN_RATES,'13',{full:true})}
     ${fNum('inCustomRate','自定义进项税率','',{unit:'%',full:true,ph:'例如 9',when:'inRate:custom'})}
    </div>
    ${fNum('carryIn','上期留抵税额（选填）','',{unit:'元',full:true,ph:'没有可留空'})}`,{when:'vmode:payable'})}
   ${group('附加税费（选填）',`${fChk('withSur','同时测算城建税、教育费附加与地方教育附加',false,{full:true})}
    ${fSel('cityRate','城建税适用税率',[['7','7%（纳税人所在地在市区）'],['5','5%（纳税人所在地在县城、镇）'],['1','1%（纳税人所在地不在市区、县城或镇）']],'7',{full:true,when:'withSur:on'})}
    ${fChk('halfRelief','适用小型微利企业／小规模纳税人「六税两费」减半优惠',false,{full:true,when:'withSur:on'})}`)}`,
  calc(v){
   const notes=['依据《中华人民共和国增值税法》（2026 年 1 月 1 日起施行）：一般计税方法下，不含税销售额＝含税销售额 ÷（1＋税率），应纳税额＝当期销项税额 − 当期进项税额。','开具发票与申报纳税时，尾差按税务系统四舍五入规则及主管税务机关口径核准。'];
   if(v.vmode==='fromGross'){
    if(String(v.gross??'').trim()==='')return null;
    const g=num(v.gross,'含税金额');if(g<0)throw Error('含税金额不能为负数');
    const rate=resolveVatRate(v.ratePreset,v.customRate,'自定义税率');
    const r=calcVatGross(g,rate);
    const grossUpper=rmbUpper(String(r.gross))?.text||'零元整';
    const taxUpper=rmbUpper(String(r.tax))?.text||'零元整';
    const rows=[
     ['含税金额（价税合计）',money(r.gross),`大写：${grossUpper}`],
     ['不含税金额',money(r.net),`${money(r.gross)} ÷ (1 + ${plain(rate)}%)`,true],
     ['增值税税额',money(r.tax),`含税金额 − 不含税金额（大写：${taxUpper}）`,true],
     ['适用税率／征收率',pct(rate),rate===1||rate===3||rate===5?'简易计税／小规模常见征收率':'一般计税常见税率']
    ];
    appendSurchargeRows(rows,notes,r.tax,v);
    return {headline:{label:'不含税金额',value:money(r.net),sub:`增值税额 ${money(r.tax)}（税率 ${plain(rate)}%）`},rows,notes};
   }
   if(v.vmode==='fromNet'){
    if(String(v.net??'').trim()==='')return null;
    const n=num(v.net,'不含税金额');if(n<0)throw Error('不含税金额不能为负数');
    const rate=resolveVatRate(v.ratePreset,v.customRate,'自定义税率');
    const r=calcVatNet(n,rate);
    const grossUpper=rmbUpper(String(r.gross))?.text||'零元整';
    const taxUpper=rmbUpper(String(r.tax))?.text||'零元整';
    const rows=[
     ['不含税金额',money(r.net),'计税基数'],
     ['增值税税额',money(r.tax),`${money(r.net)} × ${plain(rate)}%（大写：${taxUpper}）`,true],
     ['含税金额（价税合计）',money(r.gross),`不含税金额 ＋ 增值税税额`,true],
     ['价税合计大写',grossUpper]
    ];
    appendSurchargeRows(rows,notes,r.tax,v);
    return {headline:{label:'含税金额（价税合计）',value:money(r.gross),sub:`增值税额 ${money(r.tax)}（税率 ${plain(rate)}%）`},rows,notes};
   }
   if(String(v.outAmt??'').trim()===''&&String(v.inAmt??'').trim()==='')return null;
   const outRaw=num(v.outAmt,'销项金额');if(outRaw<0)throw Error('销项金额不能为负数');
   const outRate=resolveVatRate(v.outRate,v.outCustomRate,'自定义销项税率');
   const outCalc=v.outBasis==='net'?calcVatNet(outRaw,outRate):calcVatGross(outRaw,outRate);
   const inRaw=num(v.inAmt,'进项金额');if(inRaw<0)throw Error('进项金额不能为负数');
   let inTax=0,inDesc='未填写进项';
   if(inRaw>0){
    if(v.inBasis==='tax'){inTax=r2(inRaw);inDesc='按直接填写的可抵扣进项税额计'}
    else{
     const inRate=resolveVatRate(v.inRate,v.inCustomRate,'自定义进项税率');
     const inCalc=v.inBasis==='net'?calcVatNet(inRaw,inRate):calcVatGross(inRaw,inRate);
     inTax=inCalc.tax;
     inDesc=`${v.inBasis==='net'?'不含税':'含税'} ${money(inRaw)}，税率 ${plain(inRate)}%`;
    }
   }
   const carry=num(v.carryIn,'上期留抵税额');if(carry<0)throw Error('上期留抵税额不能为负数');
   const diff=r2(outCalc.tax-inTax-carry);
   const rows=[
    ['不含税销项额',money(outCalc.net),`销项${v.outBasis==='net'?'不含税':'含税'} ${money(outRaw)}，税率 ${plain(outRate)}%`],
    ['当期销项税额',money(outCalc.tax),'销项对应税额',true],
    ['当期可抵扣进项税额',money(inTax),inDesc]
   ];
   if(carry>0)rows.push(['上期留抵税额',money(carry),'从当期应纳税额中抵减']);
   if(diff>=0){
    const diffUpper=rmbUpper(String(diff))?.text||'零元整';
    rows.push(['本期应纳增值税',money(diff),`大写：${diffUpper}`,true]);
    appendSurchargeRows(rows,notes,diff,v);
    return {headline:{label:'本期应纳增值税',value:money(diff),sub:`销项 ${money(outCalc.tax)} − 进项 ${money(inTax)}${carry>0?` − 留抵 ${money(carry)}`:''}`},rows,notes};
   }
   const nextCarry=r2(-diff);
   rows.push(['期末留抵税额',money(nextCarry),'可结转下期继续抵扣',true]);
   appendSurchargeRows(rows,notes,0,v);
   return {headline:{label:'期末留抵税额',value:money(nextCarry),sub:'本期无需缴纳增值税，差额结转下期继续抵扣'},rows,notes};
  }
 };

 const TOOLS=[toolRmb,toolDays,toolLawyer,toolCourt,toolInterest,toolTraffic,toolLabor,toolVat];


  // ───────────── 安全公式解析与求值引擎（零 eval / 零 new Function，兼容严格 CSP） ─────────────
  function tokenizeExpr(src){
   const s=String(src||''),tokens=[];let i=0;
   while(i<s.length){
    const ch=s[i];
    if(/\s/.test(ch)){i++;continue}
    const two=s.slice(i,i+2);
    if(['<=','>=','==','!=','&&','||'].includes(two)){tokens.push({t:'op',v:two});i+=2;continue}
    if('+-*/%()?,:<>!'.includes(ch)){tokens.push({t:'p',v:ch});i++;continue}
    if(ch==='"'||ch==="'"){
     let q=ch,out='';i++;
     while(i<s.length&&s[i]!==q){if(s[i]==='\\'&&i+1<s.length){i++;out+=s[i]}else out+=s[i];i++}
     if(s[i]!==q)throw Error('公式中的引号未闭合');
     i++;tokens.push({t:'str',v:out});continue;
    }
    if(/[0-9.]/.test(ch)){
     const m=/^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(s.slice(i));
     if(!m)throw Error('数字格式无效：'+s.slice(i,i+8));
     tokens.push({t:'num',v:Number(m[0])});i+=m[0].length;continue;
    }
    if(/[a-zA-Z_\u4e00-\u9fa5]/.test(ch)){
     const m=/^[a-zA-Z_\u4e00-\u9fa5][a-zA-Z0-9_\u4e00-\u9fa5]*/.exec(s.slice(i));
     tokens.push({t:'id',v:m[0]});i+=m[0].length;continue;
    }
    throw Error('公式含不支持的字符：'+ch);
   }
   return tokens;
  }

  const FN_LIB={
   if:(c,a,b)=>c?a:b,
   min:(...xs)=>Math.min(...xs.map(x=>num(x))),
   max:(...xs)=>Math.max(...xs.map(x=>num(x))),
   abs:x=>Math.abs(num(x)),
   round:(x,d=2)=>{const f=Math.pow(10,Math.max(0,Math.min(8,Math.floor(num(d)))));return Math.round((num(x)+Number.EPSILON)*f)/f},
   ceil:x=>Math.ceil(num(x)),
   floor:x=>Math.floor(num(x)),
   pow:(a,b)=>Math.pow(num(a),num(b)),
   rmb:x=>{const r=rmbUpper(String(r2(num(x))));return r?r.text:'零元整'},
   money:x=>money(num(x)),
   days:(a,b)=>{const d1=toDay(a),d2=toDay(b);return d1==null||d2==null?0:d2-d1},
   workdays:(a,b)=>{const d1=toDay(a),d2=toDay(b);if(d1==null||d2==null)return 0;const lo=Math.min(d1,d2),hi=Math.max(d1,d2);let w=0;for(let d=lo+1;d<=hi;d++)if(!isOff(d))w++;return d2>=d1?w:-w},
   addDays:(a,n,defer=1)=>{const d=toDay(a);if(d==null)return '';let t=d+Math.round(num(n));if(defer&&num(n)>0){while(isOff(t))t++}return iso(t)},
   months:(a,b)=>{const d1=toDay(a),d2=toDay(b);if(d1==null||d2==null||d2<d1)return 0;const d=diffYMD(d1,d2);const anchor=addMonths(d1,d.total),[yy,mm]=ymd(anchor);return r2(d.total+d.days/dim(yy,mm))},
   tier:(amt,...rest)=>{const a=num(amt);if(a<=0||!rest.length)return 0;let sum=0,prev=0;for(let i=0;i<rest.length;i+=2){if(i===rest.length-1){sum+=Math.max(0,a-prev)*num(rest[i]);break}const up=num(rest[i]),rate=num(rest[i+1]);if(a>prev)sum+=(Math.min(a,up)-prev)*rate;prev=up;if(a<=up)break}return sum},
   tierPct:(amt,...rest)=>{const a=num(amt);if(a<=0||!rest.length)return 0;let sum=0,prev=0;for(let i=0;i<rest.length;i+=2){if(i===rest.length-1){sum+=Math.max(0,a-prev)*num(rest[i])/100;break}const up=num(rest[i]),rate=num(rest[i+1]);if(a>prev)sum+=(Math.min(a,up)-prev)*rate/100;prev=up;if(a<=up)break}return sum},
   courtFee:x=>{const a=num(x);return a>0?propertyFee(a).sum:0},
   saveFee:x=>{const a=num(x);return a>0?saveFee(a).sum:0},
   lpr1y:d=>{const day=toDay(d)||toDay(todayIso());return rateAt(RATE_TABLE(1),day).v},
   lpr5y:d=>{const day=toDay(d)||toDay(todayIso());return rateAt(RATE_TABLE(2),day).v},
   lprInterest:(p,a,b,mult=1)=>{const P=num(p),d1=toDay(a),d2=toDay(b);if(P<=0||d1==null||d2==null||d2<d1)return 0;return accrue(P,d1,d2+1,{type:'lpr1',kind:1,table:RATE_TABLE(1),basis:365,mult:num(mult)||1,add:0,fixed:false},d1).amt}
  };

  function evalExpr(expr,env={}){
   const toks=tokenizeExpr(expr);
   if(!toks.length)return 0;
   let pos=0;
   const peek=()=>toks[pos]||null;
   const eat=()=>toks[pos++];
   function parseTernary(){
    let v=parseOr();
    if(peek()?.t==='p'&&peek().v==='?'){
     eat();const tr=parseTernary();
     if(!(peek()?.t==='p'&&peek().v===':'))throw Error('条件表达式缺少 ":"');
     eat();const fa=parseTernary();
     return v?tr:fa;
    }
    return v;
   }
   function parseOr(){let v=parseAnd();while(peek()?.t==='op'&&peek().v==='||'){eat();const r=parseAnd();v=Boolean(v||r)}return v}
   function parseAnd(){let v=parseCmp();while(peek()?.t==='op'&&peek().v==='&&'){eat();const r=parseCmp();v=Boolean(v&&r)}return v}
   function parseCmp(){
    let v=parseAdd();
    while(true){
     const tk=peek();
     if(tk?.t==='op'&&['<=','>=','==','!='].includes(tk.v)){
      eat();const r=parseAdd();
      if(tk.v==='<=')v=num(v)<=num(r);
      else if(tk.v==='>=')v=num(v)>=num(r);
      else if(tk.v==='==')v=String(v)===String(r)||(!isNaN(Number(v))&&!isNaN(Number(r))&&Number(v)===Number(r));
      else v=!(String(v)===String(r)||(!isNaN(Number(v))&&!isNaN(Number(r))&&Number(v)===Number(r)));
     }else if(tk?.t==='p'&&(tk.v==='<'||tk.v==='>')){
      eat();const r=parseAdd();
      v=tk.v==='<'?num(v)<num(r):num(v)>num(r);
     }else break;
    }
    return v;
   }
   function parseAdd(){
    let v=parseMul();
    while(peek()?.t==='p'&&(peek().v==='+'||peek().v==='-')){
     const op=eat().v,r=parseMul();
     if(op==='+'&&(typeof v==='string'||typeof r==='string')){
      const nv=Number(v),nr=Number(r);
      if(v!==''&&r!==''&&Number.isFinite(nv)&&Number.isFinite(nr))v=nv+nr;
      else v=String(v??'')+String(r??'');
     }else v=op==='+'?num(v)+num(r):num(v)-num(r);
    }
    return v;
   }
   function parseMul(){
    let v=parseUnary();
    while(peek()?.t==='p'&&['*','/','%'].includes(peek().v)){
     const op=eat().v,r=parseUnary(),nr=num(r);
     if((op==='/'||op==='%')&&nr===0)throw Error('公式中除数不能为 0');
     v=op==='*'?num(v)*nr:op==='/'?num(v)/nr:num(v)%nr;
    }
    return v;
   }
   function parseUnary(){
    const tk=peek();
    if(tk?.t==='p'&&(tk.v==='+'||tk.v==='-'||tk.v==='!')){
     eat();const u=parseUnary();
     return tk.v==='!'?!u:tk.v==='-'?-num(u):+num(u);
    }
    return parsePrimary();
   }
   function parsePrimary(){
    const tk=eat();
    if(!tk)throw Error('公式不完整');
    if(tk.t==='num'||tk.t==='str')return tk.v;
    if(tk.t==='p'&&tk.v==='('){
     const v=parseTernary();
     if(!(peek()?.t==='p'&&peek().v===')'))throw Error('公式缺少右括号 ")"');
     eat();return v;
    }
    if(tk.t==='id'){
     if(tk.v==='true')return true;
     if(tk.v==='false')return false;
     if(peek()?.t==='p'&&peek().v==='('){
      eat();const args=[];
      if(!(peek()?.t==='p'&&peek().v===')')){
       while(true){
        args.push(parseTernary());
        if(peek()?.t==='p'&&peek().v===','){eat();continue}
        break;
       }
      }
      if(!(peek()?.t==='p'&&peek().v===')'))throw Error(`函数 ${tk.v}(...) 缺少右括号`);
      eat();
      const fn=FN_LIB[tk.v];
      if(!fn)throw Error('未知的公式函数：'+tk.v);
      return fn(...args);
     }
     if(Object.prototype.hasOwnProperty.call(env,tk.v))return env[tk.v];
     throw Error('未定义的变量：'+tk.v);
    }
    throw Error('公式语法错误：'+tk.v);
   }
   const out=parseTernary();
   if(pos<toks.length)throw Error('公式末尾有多余内容：'+toks[pos].v);
   return out;
  }

  function formatOutputVal(val,fmt){
   if(val==null||val==='')return '—';
   if(fmt==='money')return money(num(val));
   if(fmt==='percent')return pct(num(val));
   if(fmt==='integer')return Math.round(num(val)).toLocaleString('zh-CN');
   if(fmt==='number')return plain(num(val));
   if(fmt==='rmb'){const r=rmbUpper(String(r2(num(val))));return r?r.text:'零元整'}
   if(fmt==='date'){if(typeof val==='string'&&/^\d{4}-\d{2}-\d{2}/.test(val))return val;const d=Math.round(num(val));return d>1000?iso(d):String(val)}
   return String(val);
  }
  function interpolateSub(tpl,env){
   if(!tpl)return '';
   return String(tpl).replace(/\{([a-zA-Z0-9_]+)\}/g,(_,k)=>Object.prototype.hasOwnProperty.call(env,k)?String(env[k]):'');
  }

  function buildCustomToolRuntime(meta){
   return {
    ...meta,
    custom:true,
    form(){
     if(meta.mode==='sandbox')return '';
     const fields=meta.schema?.fields||[];
     return group('',fields.map(f=>{
      const o={unit:f.unit||'',full:Boolean(f.full),ph:f.placeholder||'',hint:f.hint||''};
      if(f.type==='date')return fDate(f.key,esc(f.label),f.default==='today'?todayIso():(f.default||''),o);
      if(f.type==='select')return fSel(f.key,esc(f.label),f.options||[],f.default||((f.options?.[0]?.[0])??''),o);
      if(f.type==='checkbox')return fChk(f.key,esc(f.label),Boolean(f.default),o);
      if(f.type==='text')return `<label class="lc-field${cls(o)}"><span>${esc(f.label)}</span><span class="lc-input"><input name="${esc(f.key)}" autocomplete="off" value="${esc(f.default||'')}" placeholder="${esc(o.ph)}">${o.unit?`<em>${esc(o.unit)}</em>`:''}</span>${hint(o)}</label>`;
      return fNum(f.key,esc(f.label),f.default||'',o);
     }).join(''));
    },
    calc(v){
     const schema=meta.schema||{fields:[],outputs:[],notes:[]};
     const env={};
     let anyFilled=false;
     for(const f of schema.fields||[]){
      const raw=v[f.key];
      if(f.type==='checkbox'){env[f.key]=raw?1:0;if(raw)anyFilled=true}
      else if(f.type==='date'||f.type==='text'||f.type==='select'){
       env[f.key]=String(raw??'');
       if(env[f.key]!=='')anyFilled=true;
       if(f.type==='select'&&env[f.key]!==''&&!isNaN(Number(env[f.key])))env[f.key]=Number(env[f.key]);
      }else{
       if(String(raw??'').trim()!=='')anyFilled=true;
       env[f.key]=num(raw,f.label);
      }
     }
     if(!anyFilled)return null;
     let headline=null;const rows=[];
     for(const o of schema.outputs||[]){
      const val=evalExpr(o.expr,env);
      if(o.key)env[o.key]=val;
      const formatted=formatOutputVal(val,o.format);
      const sub=interpolateSub(o.sub,env);
      if(o.headline&&!headline)headline={label:o.label,value:formatted,sub};
      else rows.push([o.label,formatted,sub,Boolean(o.strong)]);
     }
     if(!headline&&rows.length){const first=rows.shift();headline={label:first[0],value:first[1],sub:first[2]||''}}
     return {headline,rows,notes:schema.notes||[]};
    }
   };
  }

  // ───────────── 状态、本地缓存与云端同步 ─────────────
  const ORDER_CACHE_KEY='hengzhang-local-legal-calc-order-v1';
  let backdrop=null,isOpen=false,current=null,editingDraft=null,previousFocus=null,searchQuery='';
  let customTools=[],orderIds=[],pinnedIds=[],teamUsers=[],serverLoaded=false,serverLoading=false,singleUser=true;
  let aiStatus={checked:false,ready:false,model:'',provider:'',can_configure:true};
  let aiPromptText='',aiPrefMode='auto',aiBusy=false,aiLastMeta='',aiAdvOpen=false;
  let cardDragState=null,winDragState=null,winOffset={x:0,y:0},suppressCardClickUntil=0,toastEl=null,toastTimer=null;

  function loadLocalOrder(){
   try{
    const raw=JSON.parse(localStorage.getItem(ORDER_CACHE_KEY)||'{}');
    if(Array.isArray(raw.orderIds))orderIds=raw.orderIds;
    if(Array.isArray(raw.pinnedIds))pinnedIds=raw.pinnedIds;
   }catch{}
  }
  function saveLocalOrder(){
   try{localStorage.setItem(ORDER_CACHE_KEY,JSON.stringify({orderIds,pinnedIds}))}catch{}
  }
  loadLocalOrder();

  function isWorkspaceReady(){return Boolean(document.querySelector('.desk'))}

  async function apiCalc(body){
   const res=await fetch('/api/legal-calc',{
    method:body?'POST':'GET',
    credentials:'same-origin',
    headers:{...(body?{'Content-Type':'application/json'}:{})},
    body:body?JSON.stringify(body):undefined
   });
   const data=await res.json().catch(()=>({}));
   if(!res.ok)throw Error(data.error||'请求法律计算配置失败');
   return data;
  }

  async function loadAiStatus(force=false){
   if(aiStatus.checked&&!force)return aiStatus;
   try{
    const res=await fetch('/api/ai/config',{method:'GET',credentials:'same-origin'});
    const data=await res.json().catch(()=>({}));
    if(res.ok&&data.ai){
     aiStatus={checked:true,ready:Boolean(data.ai.has_api_key),model:String(data.ai.model||''),provider:String(data.ai.provider||''),can_configure:true};
    }else{
     aiStatus={checked:true,ready:false,model:'',provider:'',can_configure:true};
    }
   }catch{
    aiStatus={checked:true,ready:false,model:'',provider:'',can_configure:true};
   }
   updateAiStatusBadge();
   return aiStatus;
  }

  function updateAiStatusBadge(){
   if(!backdrop||!editingDraft)return;
   const badge=backdrop.querySelector('#ed-ai-status');
   if(!badge)return;
   if(!aiStatus.checked){
    badge.className='lc-ai-status is-off';
    badge.textContent='正在检查本机 AI 模型状态…';
   }else if(aiStatus.ready){
    badge.className='lc-ai-status';
    badge.textContent=`平台 AI 就绪${aiStatus.model?' · '+aiStatus.model:''}`;
   }else{
    badge.className='lc-ai-status is-off';
    badge.textContent='平台 AI 未配置（请先在左侧「设置与备份」配置模型）';
   }
  }

  async function apiAiGenerate(payload){
   const res=await fetch('/api/legal-calc/ai-generate',{
    method:'POST',
    credentials:'same-origin',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(payload)
   });
   const data=await res.json().catch(()=>({}));
   if(!res.ok)throw Error(data.error||'AI 生成小工具失败');
   return data;
  }

  function applyServerPayload(data){
   if(!data)return;
   if('single_user' in data)singleUser=Boolean(data.single_user);
   customTools=(data.custom_tools||[]).map(buildCustomToolRuntime);
   if(Array.isArray(data.order_ids))orderIds=data.order_ids;
   if(Array.isArray(data.pinned_ids))pinnedIds=data.pinned_ids;
   if(Array.isArray(data.users))teamUsers=data.users;
   if('ai_ready' in data){
    aiStatus={checked:true,ready:Boolean(data.ai_ready),model:String(data.ai_model||''),provider:'',can_configure:true};
    updateAiStatusBadge();
   }
   saveLocalOrder();
  }

  function syncFromServer(force=false){
   if(serverLoading||(serverLoaded&&!force))return Promise.resolve();
   serverLoading=true;
   return apiCalc().then(data=>{
    serverLoaded=true;
    applyServerPayload(data);
    if(isOpen&&!current&&!editingDraft)renderHome();
   }).catch(()=>{}).finally(()=>{serverLoading=false});
  }

  function showToast(msg,isErr=false){
   if(!toastEl){toastEl=document.createElement('div');toastEl.className='lc-toast';toastEl.hidden=true;document.body.appendChild(toastEl)}
   toastEl.textContent=msg;
   toastEl.classList.toggle('is-err',Boolean(isErr));
   toastEl.hidden=false;
   clearTimeout(toastTimer);
   toastTimer=setTimeout(()=>{if(toastEl)toastEl.hidden=true},2200);
  }

  function allToolsOrdered(){
   const all=[...TOOLS,...customTools];
   const byId=new Map(all.map(t=>[t.id,t]));
   const pinSet=new Set(pinnedIds);
   const ordered=[];const seen=new Set();
   for(const id of orderIds){if(byId.has(id)&&!seen.has(id)){seen.add(id);ordered.push(byId.get(id))}}
   for(const t of all){if(!seen.has(t.id)){seen.add(t.id);ordered.push(t)}}
   const pinned=ordered.filter(t=>pinSet.has(t.id));
   const unpinned=ordered.filter(t=>!pinSet.has(t.id));
   return [...pinned,...unpinned];
  }

  function renderIconBadge(iconKey,accentKey,size=22){
   const ic=ICONS[iconKey]||ICONS.spark;
   const ac=ACCENTS_META[accentKey]?accentKey:'indigo';
   return `<span class="lc-card-icon lc-accent-${ac}">${svg(ic,size)}</span>`;
  }

  function scopePillHtml(t){
   if(!t.custom)return '';
   const v=t.visibility||'private';
   const visTag=singleUser?'':(v==='team'?'<span class="lc-pill lc-pill-team">全团队共享</span>'
    :v==='members'?`<span class="lc-pill lc-pill-members" title="可用成员：${esc((t.visible_member_names||[]).join('、')||'仅创建人与管理员')}">指定 ${(t.visible_members||[]).length} 人</span>`
    :'<span class="lc-pill lc-pill-private">仅自己</span>');
   const noteTag=t.scope_note?`<span class="lc-pill lc-pill-scope">${esc(t.scope_note)}</span>`:'';
   return `<span class="lc-pill lc-pill-custom">${t.mode==='sandbox'?'沙盒小工具':'公式小工具'}</span>${visTag}${noteTag}`;
  }

  // ───────────── 表单与结果渲染 ─────────────
  function readForm(body){
   const v={};
   body.querySelectorAll('[name]').forEach(el=>{
    if(el.type==='radio'){if(el.checked)v[el.name]=el.value}
    else if(el.type==='checkbox')v[el.name]=el.checked;
    else v[el.name]=el.value.trim();
   });
   return v;
  }
  const readRows=(body,kind)=>[...body.querySelectorAll(`[data-row-of="${kind}"]`)].map(row=>{const o={};row.querySelectorAll('[data-k]').forEach(el=>{o[el.dataset.k]=el.value.trim()});return o});
  function applyWhen(body,v){
   body.querySelectorAll('[data-when]').forEach(el=>{
    const [key,vals]=el.dataset.when.split(':');
    const cur=v[key]===true?'on':v[key]===false?'off':String(v[key]??'');
    el.hidden=!vals.split(',').includes(cur);
   });
  }
  function visibleValues(body){
   let out=readForm(body);
   for(let pass=0;pass<2;pass++){
    applyWhen(body,out);
    const next=readForm(body);
    body.querySelectorAll('[name]').forEach(el=>{if(el.closest('[hidden]')&&el.type!=='radio'){next[el.name]=el.type==='checkbox'?false:''}});
    out=next;
   }
   applyWhen(body,out);
   return out;
  }

  function resultText(tool,r){
   const lines=[`【${tool.title}】`];
   if(tool.scope_note)lines.push(`适用范围：${tool.scope_note}`);
   if(r.headline)lines.push(`${r.headline.label}：${r.headline.value}${r.headline.sub?'（'+r.headline.sub+'）':''}`);
   for(const row of r.rows||[])lines.push(`${row[0]}：${row[1]}${row[2]?'（'+row[2]+'）':''}`);
   for(const t of r.tables||[]){if(!t.rows.length)continue;lines.push('',t.title,t.head.join('\t'),...t.rows.map(x=>x.join('\t')))}
   if(r.warn?.length)lines.push('',...r.warn.map(x=>'注意：'+x));
   if(r.notes?.length)lines.push('',...r.notes.map((x,i)=>`${i+1}. ${x}`));
   lines.push('','（衡账法律计算结果仅供参考，请结合具体案情及最新规定核对）');
   return lines.join('\n');
  }
  function renderResult(box,tool,r,err){
   if(err){box.innerHTML=`<div class="lc-error">${esc(err)}</div>`;box._text='';return}
   if(!r){box.innerHTML='<div class="lc-empty">填写左侧信息后自动计算</div>';box._text='';return}
   let h='';
   if(r.headline)h+=`<div class="lc-headline"><span>${esc(r.headline.label)}</span><strong>${esc(r.headline.value)}</strong>${r.headline.sub?`<small>${esc(r.headline.sub)}</small>`:''}</div>`;
   if(r.warn?.length)h+=`<ul class="lc-warn">${r.warn.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`;
   if(r.rows?.length)h+=`<dl class="lc-dl">${r.rows.map(x=>`<div${x[3]?' class="is-strong"':''}><dt>${esc(x[0])}</dt><dd><b>${esc(x[1])}</b>${x[2]?`<small>${esc(x[2])}</small>`:''}</dd></div>`).join('')}</dl>`;
   for(const t of r.tables||[]){if(!t.rows.length)continue;h+=`<div class="lc-table"><div class="lc-table-title">${esc(t.title)}</div><div class="lc-table-scroll"><table><thead><tr>${t.head.map(x=>`<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${t.rows.map(row=>`<tr>${row.map(x=>`<td>${esc(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`}
   if(r.notes?.length)h+=`<ul class="lc-notes">${r.notes.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`;
   h+='<div class="lc-result-actions"><button type="button" class="lc-copy" data-copy>复制计算结果</button></div>';
   box.innerHTML=h;box._text=resultText(tool,r);
  }

  function copyText(text,btn){
   const done=()=>{
    if(btn){const old=btn.textContent;btn.textContent='已复制';btn.classList.add('is-done');setTimeout(()=>{btn.textContent=old;btn.classList.remove('is-done')},1400)}
    else showToast('计算结果已复制到剪贴板');
   };
   if(navigator.clipboard?.writeText){navigator.clipboard.writeText(text).then(done,()=>fallback())}else fallback();
   function fallback(){const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.left='-9999px';ta.style.top='0';document.body.appendChild(ta);ta.select();try{document.execCommand('copy');done()}catch{}ta.remove()}
  }

  // ───────────── 卡片自由拖拽排序 ─────────────
  function cancelCardDrag(restoreDom=false){
   if(!cardDragState)return;
   const st=cardDragState;cardDragState=null;
   window.removeEventListener('pointermove',st.onMove);
   window.removeEventListener('pointerup',st.onUp);
   window.removeEventListener('pointercancel',st.onCancel);
   if(st.ghost?.parentNode)st.ghost.parentNode.removeChild(st.ghost);
   st.card.classList.remove('is-dragging');
   document.body.classList.remove('lc-is-sorting');
   if(restoreDom&&st.active&&st.grid){
    for(const el of st.originalNodes){if(el.parentNode===st.grid)st.grid.appendChild(el)}
   }
  }

  async function commitCardOrder(draggedId,afterIds){
   const pinSet=new Set(pinnedIds);
   const wasPinned=pinSet.has(draggedId);
   const idx=afterIds.indexOf(draggedId);
   const otherPinIndices=afterIds.map((id,i)=>id!==draggedId&&pinSet.has(id)?i:-1).filter(i=>i>=0);
   let shouldPin=wasPinned;
   if(otherPinIndices.length){
    const maxPinIdx=Math.max(...otherPinIndices);
    if(!wasPinned&&idx<maxPinIdx)shouldPin=true;
    else if(wasPinned&&idx>maxPinIdx)shouldPin=false;
   }
   if(shouldPin)pinSet.add(draggedId);else pinSet.delete(draggedId);
   orderIds=afterIds;
   pinnedIds=afterIds.filter(id=>pinSet.has(id));
   saveLocalOrder();
   renderHome();
   try{
    const res=await apiCalc({action:'reorder',order_ids:orderIds,pinned_ids:pinnedIds});
    applyServerPayload(res);
    showToast('已保存卡片排序');
   }catch{
    showToast('已在本机保存排序');
   }
  }

  function bindCardDrag(card,grid,scrollEl){
   card.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;
    if(e.target.closest('.lc-card-tools'))return;
    cancelCardDrag(true);
    const rect=card.getBoundingClientRect();
    const originalNodes=[...grid.querySelectorAll('.lc-card')];
    const st={
     card,id:card.dataset.tool,grid,scrollEl,originalNodes,
     beforeIds:originalNodes.map(n=>n.dataset.tool),
     startX:e.clientX,startY:e.clientY,
     offsetX:e.clientX-rect.left,offsetY:e.clientY-rect.top,
     width:rect.width,height:rect.height,
     active:false,ghost:null
    };
    st.onMove=ev=>{
     if(cardDragState!==st)return;
     if(!st.active){
      if(Math.hypot(ev.clientX-st.startX,ev.clientY-st.startY)<6)return;
      st.active=true;
      const ghost=st.card.cloneNode(true);
      ghost.classList.add('lc-drag-ghost');
      ghost.style.width=st.width+'px';
      ghost.style.height=st.height+'px';
      ghost.style.left=(ev.clientX-st.offsetX)+'px';
      ghost.style.top=(ev.clientY-st.offsetY)+'px';
      ghost.querySelector('.lc-card-tools')?.remove();
      document.body.appendChild(ghost);
      st.ghost=ghost;
      st.card.classList.add('is-dragging');
      document.body.classList.add('lc-is-sorting');
     }
     ev.preventDefault();
     if(st.ghost){
      st.ghost.style.left=(ev.clientX-st.offsetX)+'px';
      st.ghost.style.top=(ev.clientY-st.offsetY)+'px';
     }
     if(st.scrollEl){
      const sr=st.scrollEl.getBoundingClientRect();
      if(ev.clientY<sr.top+36)st.scrollEl.scrollTop-=12;
      else if(ev.clientY>sr.bottom-36)st.scrollEl.scrollTop+=12;
     }
     const siblings=[...st.grid.querySelectorAll('.lc-card')];
     const dragIdx=siblings.indexOf(st.card);
     for(let i=0;i<siblings.length;i++){
      const target=siblings[i];
      if(target===st.card)continue;
      const r=target.getBoundingClientRect();
      if(ev.clientX>=r.left&&ev.clientX<=r.right&&ev.clientY>=r.top&&ev.clientY<=r.bottom){
       if(dragIdx<i)st.grid.insertBefore(st.card,target.nextSibling);
       else st.grid.insertBefore(st.card,target);
       break;
      }
     }
    };
    st.onUp=()=>{
     if(cardDragState!==st)return;
     const wasActive=st.active;
     const afterIds=[...st.grid.querySelectorAll('.lc-card')].map(n=>n.dataset.tool);
     cancelCardDrag(false);
     if(wasActive){
      suppressCardClickUntil=Date.now()+260;
      if(afterIds.join(',')!==st.beforeIds.join(','))commitCardOrder(st.id,afterIds);
     }
    };
    st.onCancel=()=>cancelCardDrag(true);
    cardDragState=st;
    window.addEventListener('pointermove',st.onMove,{passive:false});
    window.addEventListener('pointerup',st.onUp);
    window.addEventListener('pointercancel',st.onCancel);
   });
  }

  // ───────────── 首页渲染 ─────────────
  function renderHome(){
   cancelCardDrag(false);
   current=null;editingDraft=null;
   const content=backdrop.querySelector('#lc-content');
   backdrop.querySelector('#lc-back').hidden=true;
   backdrop.querySelector('#lc-new-btn').hidden=false;
   backdrop.querySelector('#lc-title').textContent='法律计算';
   const q=searchQuery.trim().toLowerCase();
   const ordered=allToolsOrdered();
   const canSort=!q;
   const pinSet=new Set(pinnedIds);
   const list=q?ordered.filter(t=>`${t.title} ${t.desc} ${t.scope_note||''} ${t.owner_name||''}`.toLowerCase().includes(q)):ordered;

   const cardsHtml=list.length?list.map(t=>{
    const pinned=pinSet.has(t.id);
    return `<div class="lc-card${pinned?' is-pinned':''}${canSort?' is-draggable':''}" role="button" tabindex="0" data-tool="${esc(t.id)}">
     ${canSort?'<span class="lc-drag-handle" title="按住拖动调整顺序" aria-hidden="true">⋮⋮</span>':''}
     ${renderIconBadge(t.icon,t.accent,24)}
     <span class="lc-card-text">
      <span class="lc-card-title-row">
       <strong>${esc(t.title)}</strong>
       ${pinned?'<span class="lc-pill lc-pill-pin">★ 置顶</span>':''}
      </span>
      <span>${esc(t.desc)}</span>
      ${t.custom?`<span class="lc-card-badges">${scopePillHtml(t)}</span>`:''}
     </span>
     <span class="lc-card-tools">
      <button type="button" class="lc-mini-btn${pinned?' is-active':''}" data-pin-tool="${esc(t.id)}" title="${pinned?'取消置顶':'置顶此工具'}" aria-label="${pinned?'取消置顶':'置顶'}">★</button>
      ${t.custom&&t.can_edit?`<button type="button" class="lc-mini-btn" data-edit-tool="${esc(t.id)}" title="编辑小工具与使用范围" aria-label="编辑">✎</button>`:''}
      ${t.custom?`<button type="button" class="lc-mini-btn" data-dup-tool="${esc(t.id)}" title="复制为我的小工具" aria-label="复制">⧉</button>`:''}
     </span>
    </div>`;
   }).join(''):`<div class="lc-empty lc-span-full">未找到匹配的法律计算工具</div>`;

   content.innerHTML=`<div class="lc-home">
    <div class="lc-home-bar">
     <div class="lc-home-bar-left">
      <h3 class="lc-section-title">计算工具箱</h3>
      <div class="lc-search-wrap">
       <span class="lc-search-ico">${svg('<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.2 4.2"/>',14)}</span>
       <input type="search" id="lc-search-input" value="${esc(searchQuery)}" placeholder="搜索计算器或自定义小工具…" aria-label="搜索计算器">
      </div>
     </div>
     <div class="lc-home-bar-right">
      ${canSort?'<span class="lc-sort-hint">⋮⋮ 按住卡片可自由拖动排序</span>':''}
     </div>
    </div>
    <div class="lc-grid" id="lc-card-grid">${cardsHtml}</div>
    <p class="lc-home-foot">
     <span>内置计算在本机浏览器完成；地区标准默认四川省预置，可在各计算器内修改。结果仅供参考。</span>
     <span>共 ${ordered.length} 个工具（内置 ${TOOLS.length}${customTools.length?`，自定义 ${customTools.length}`:''}）</span>
    </p>
   </div>`;
   content.scrollTop=0;

   const searchInput=content.querySelector('#lc-search-input');
   searchInput?.addEventListener('input',e=>{
    searchQuery=e.target.value;
    const pos=e.target.selectionStart;
    renderHome();
    const nextInput=content.querySelector('#lc-search-input');
    if(nextInput){nextInput.focus();try{nextInput.setSelectionRange(pos,pos)}catch{}}
   });

   const grid=content.querySelector('#lc-card-grid');
   if(canSort&&grid){
    grid.querySelectorAll('.lc-card').forEach(card=>bindCardDrag(card,grid,content));
   }
  }

  // ───────────── 沙盒运行器桥接 ─────────────
  let activeSandboxFrame=null,pendingSandboxCode='';
  window.addEventListener('message',ev=>{
   if(!activeSandboxFrame||ev.source!==activeSandboxFrame.contentWindow)return;
   const d=ev.data||{};
   if(d.type==='hz-calc-ready'&&pendingSandboxCode){
    activeSandboxFrame.contentWindow.postMessage({type:'hz-calc-load',code:pendingSandboxCode},'*');
   }else if(d.type==='hz-calc-height'&&typeof d.height==='number'){
    activeSandboxFrame.style.height=Math.max(260,Math.min(2400,Math.round(d.height)))+'px';
   }else if(d.type==='hz-calc-copy'&&typeof d.text==='string'){
    copyText(d.text,null);
   }
  });

  function mountSandbox(container,code){
   pendingSandboxCode=String(code||'');
   const iframe=document.createElement('iframe');
   iframe.className='lc-sandbox-frame';
   iframe.setAttribute('sandbox','allow-scripts');
   iframe.setAttribute('referrerpolicy','no-referrer');
   iframe.title='自定义小工具隔离沙盒';
   iframe.src='/api/legal-calc/sandbox-runner';
   container.replaceChildren(iframe);
   activeSandboxFrame=iframe;
  }

  // ───────────── 打开计算器（内置或自定义） ─────────────
  function openTool(id){
   const tool=[...TOOLS,...customTools].find(t=>t.id===id);
   if(!tool)return;
   current=tool;editingDraft=null;activeSandboxFrame=null;
   backdrop.querySelector('#lc-back').hidden=false;
   backdrop.querySelector('#lc-new-btn').hidden=false;
   backdrop.querySelector('#lc-title').textContent=tool.title;
   const content=backdrop.querySelector('#lc-content');

   const customBanner=tool.custom?`<div class="lc-scope-banner">
    ${scopePillHtml(tool)}
    ${singleUser?'':`<span>创建人：${esc(tool.owner_name||'团队成员')}</span>`}
    <span class="lc-ml-auto lc-gap-6">
     ${tool.can_edit?`<button type="button" class="lc-back" data-edit-tool="${esc(tool.id)}">✎ 编辑／AI 调整</button>`:''}
     <button type="button" class="lc-back" data-dup-tool="${esc(tool.id)}">⧉ 复制为新工具</button>
    </span>
   </div>`:'';

   if(tool.custom&&tool.mode==='sandbox'){
    content.innerHTML=`<div class="lc-tool is-sandbox-view">
     <div class="lc-form">
      <div class="lc-tool-intro"><div class="lc-tool-intro-main">${renderIconBadge(tool.icon,tool.accent,20)}<p>${esc(tool.desc)}</p></div><button type="button" class="lc-reset" data-reload-sandbox>↻ 重置重填</button></div>
      ${customBanner}
      <div id="lc-sandbox-host"></div>
     </div>
    </div>`;
    content.scrollTop=0;
    const host=content.querySelector('#lc-sandbox-host');
    mountSandbox(host,tool.code);
    content.querySelector('[data-reload-sandbox]').onclick=()=>mountSandbox(host,tool.code);
    return;
   }

   content.innerHTML=`<div class="lc-tool"><form class="lc-form" autocomplete="off"><div class="lc-tool-intro"><div class="lc-tool-intro-main">${renderIconBadge(tool.icon,tool.accent,20)}<p>${esc(tool.desc)}</p></div></div>${customBanner}${tool.form()}<div class="lc-form-actions"><span></span><button type="button" class="lc-reset" data-reset>清空重填</button></div></form><aside class="lc-result" aria-live="polite"></aside></div>`;
   content.scrollTop=0;
   const form=content.querySelector('.lc-form'),box=content.querySelector('.lc-result');
   form.addEventListener('submit',e=>e.preventDefault());
   tool.bind?.(form);
   const run=()=>{
    const v=visibleValues(form);
    try{renderResult(box,tool,tool.calc(v,kind=>readRows(form,kind)))}
    catch(e){renderResult(box,tool,null,e.message||String(e))}
   };
   form.addEventListener('input',run);
   form.addEventListener('change',run);
   form.addEventListener('click',e=>{
    const add=e.target.closest('[data-add-row]');
    if(add){const kind=add.dataset.addRow;form.querySelector(`[data-rows="${kind}"]`)?.insertAdjacentHTML('beforeend',ROW_TPL[kind]());const rows=form.querySelectorAll(`[data-row-of="${kind}"]`);rows[rows.length-1]?.querySelector('input,select')?.focus();run();return}
    const del=e.target.closest('[data-del-row]');
    if(del){del.closest('.lc-row')?.remove();run();return}
    if(e.target.closest('[data-reset]')){openTool(tool.id);return}
   });
   box.addEventListener('click',e=>{const b=e.target.closest('[data-copy]');if(b&&box._text)copyText(box._text,b)});
   run();
   requestAnimationFrame(()=>form.querySelector('input:not([type=radio]):not([type=checkbox]),select')?.focus());
  }

  // ───────────── 自写小工具工作台（公式模式 ＋ 隔离沙盒模式 ＋ 使用范围） ─────────────
  const EXAMPLE_FORMULA_SCHEMA=()=>({
   fields:[
    {key:'principal',label:'违约基数（未付本金）',type:'number',unit:'元',default:'',placeholder:'例如 500000',hint:''},
    {key:'start',label:'违约起算日',type:'date',unit:'',default:todayIso(),placeholder:'',hint:''},
    {key:'end',label:'计算截止日',type:'date',unit:'',default:todayIso(),placeholder:'',hint:''},
    {key:'daily_bp',label:'合同约定日违约金标准',type:'number',unit:'‱（万分之）',default:'5',placeholder:'万分之五填 5',hint:''}
   ],
   outputs:[
    {key:'span',label:'逾期天数',expr:'max(0, days(start, end))',format:'integer',headline:false,strong:false,sub:'起算日至截止日'},
    {key:'agreed',label:'按合同约定计算的违约金',expr:'principal * (daily_bp / 10000) * span',format:'money',headline:true,strong:true,sub:'基数 × 日万分之 {daily_bp} × {span} 天'},
    {key:'cap4x',label:'同期 1 年期 LPR 四倍参考值',expr:'lprInterest(principal, start, end, 4)',format:'money',headline:false,strong:true,sub:'司法实务常见调减参考上限'},
    {key:'upper_rmb',label:'约定违约金大写',expr:'agreed',format:'rmb',headline:false,strong:false,sub:''}
   ],
   notes:['约定违约金过分高于造成的损失的，当事人可以请求法院或仲裁机构予以适当减少（民法典第 585 条）。']
  });

  const EXAMPLE_SANDBOX_CODE=`<div class="card">
  <label>争议标的额（元）
    <input id="amt" type="number" placeholder="例如 1200000" value="1200000">
  </label>
  <label>调解折扣比例（%）
    <input id="disc" type="number" value="85" min="1" max="100">
  </label>
</div>
<div class="card" id="out"></div>
<button type="button" id="copy-btn">复制测算结果</button>
<script>
function calc(){
  var a = Number(document.getElementById('amt').value || 0);
  var d = Number(document.getElementById('disc').value || 100) / 100;
  var res = (a * d).toFixed(2);
  var txt = '调解方案测算金额：' + Number(res).toLocaleString('zh-CN',{minimumFractionDigits:2}) + ' 元（按 ' + (d*100) + '% 折算）';
  document.getElementById('out').textContent = txt;
  return txt;
}
document.getElementById('amt').oninput = calc;
document.getElementById('disc').oninput = calc;
document.getElementById('copy-btn').onclick = function(){ window.copyResult(calc()); };
calc();
</script>`;

  const AI_EXAMPLE_PROMPTS=[
   ['建工逾期违约金 vs 4倍LPR','请做一个建设工程逾期付款违约金计算器：输入欠付工程款本金、逾期起算日、计算截止日、合同约定日违约金标准（万分之几），计算逾期天数、约定违约金、同期 1 年期 LPR 四倍上限参考值以及约定违约金人民币大写，并附《民法典》第 585 条提示。'],
   ['股权转让个税速算','请做一个自然人股权转让个人所得税测算器：输入股权转让收入、股权原值、合理费用（印花税/评估费等），自动计算应纳税所得额、20% 个人所得税、税后净得金额以及个税人民币大写，如所得额不大于 0 则税额为 0。'],
   ['商铺免租期与递增租金','请做一个商铺租赁租金测算器：输入月租金、租期月数、免租期月数、物业费（元/月）、押金月数，计算免租期减免额、实际租金合计、总物业费、押金与首期应付总额，并给出实用租赁提示。'],
   ['分期还款计划表（沙盒）','请用沙盒网页模式做一个分期还款计划表生成器：支持输入借款本金、年利率（%）、分期期数（月）、起始还款日期、还款方式（等额本息 / 等额本金），实时展示总利息、总还款额和逐期本金/利息/余额明细表，并支持一键复制汇总结果。']
  ];

  function makeDefaultDraft(seedTool,asCopy=false){
   if(seedTool){
    return {
     id:asCopy?'':(seedTool.id||''),
     title:asCopy?(seedTool.title+'（副本）'):seedTool.title,
     desc:seedTool.desc||'',
     scope_note:seedTool.scope_note||'',
     icon:ICONS[seedTool.icon]?seedTool.icon:'spark',
     accent:ACCENTS_META[seedTool.accent]?seedTool.accent:'indigo',
     mode:seedTool.mode||'formula',
     visibility:asCopy?'private':(seedTool.visibility||'private'),
     visible_members:asCopy?[]:[...(seedTool.visible_members||[])],
     schema:seedTool.schema?JSON.parse(JSON.stringify(seedTool.schema)):EXAMPLE_FORMULA_SCHEMA(),
     code:seedTool.code||EXAMPLE_SANDBOX_CODE,
     _aiGenerated:false
    };
   }
   return {
    id:'',title:'',desc:'',scope_note:'',
    icon:'spark',accent:'indigo',mode:'formula',
    visibility:'private',visible_members:[],
    schema:{
     fields:[
      {key:'amount',label:'计算基数',type:'number',unit:'元',default:'',placeholder:'请输入金额',hint:''},
      {key:'rate',label:'计算比例',type:'number',unit:'%',default:'10',placeholder:'',hint:''}
     ],
     outputs:[
      {key:'total',label:'计算结果',expr:'amount * rate / 100',format:'money',headline:true,strong:true,sub:'基数 × {rate}%'},
      {key:'',label:'人民币大写',expr:'total',format:'rmb',headline:false,strong:false,sub:''}
     ],
     notes:[]
    },
    code:EXAMPLE_SANDBOX_CODE,
    _aiGenerated:false
   };
  }

  function openEditor(seedTool=null,asCopy=false){
   current=null;activeSandboxFrame=null;
   editingDraft=makeDefaultDraft(seedTool,asCopy);
   aiPromptText='';aiPrefMode='auto';aiBusy=false;aiLastMeta='';aiAdvOpen=false;
   if(!serverLoaded)syncFromServer(true).then(()=>{if(editingDraft)renderEditor()});
   loadAiStatus(true);
   renderEditor();
  }

  function renderEditor(){
   const d=editingDraft;if(!d)return;
   backdrop.querySelector('#lc-back').hidden=false;
   backdrop.querySelector('#lc-new-btn').hidden=true;
   backdrop.querySelector('#lc-title').textContent=d.id?'编辑自定义小工具（AI 辅助）':'AI 生成法律计算小工具';
   const content=backdrop.querySelector('#lc-content');
   let lastFocusedExpr=null;

   const iconKeys=Object.keys(ICON_LABELS);
   const accentKeys=Object.keys(ACCENTS_META);
   const memberSet=new Set(d.visible_members||[]);
   const hasExistingContent=Boolean(d.id||d._aiGenerated);

   const fieldsHtml=(d.schema.fields||[]).map((f,idx)=>`<div class="lc-builder-card" data-f-idx="${idx}">
    <div class="lc-builder-grid">
     <span class="lc-input"><input data-fk="key" value="${esc(f.key)}" placeholder="变量名 如 amount" title="英文变量名，供公式引用"></span>
     <span class="lc-input"><input data-fk="label" value="${esc(f.label)}" placeholder="显示名称 如 争议标的额"></span>
     <span class="lc-input"><select data-fk="type">
      <option value="number"${f.type==='number'?' selected':''}>数字／金额</option>
      <option value="date"${f.type==='date'?' selected':''}>日期</option>
      <option value="select"${f.type==='select'?' selected':''}>下拉选项</option>
      <option value="checkbox"${f.type==='checkbox'?' selected':''}>勾选开关</option>
      <option value="text"${f.type==='text'?' selected':''}>文本</option>
     </select></span>
     <span class="lc-input"><input data-fk="unit" value="${esc(f.unit||'')}" placeholder="单位 如 元"></span>
     <button type="button" class="lc-row-del" data-del-field="${idx}" title="删除此输入项">×</button>
    </div>
    <div class="lc-fields">
     <span class="lc-input"><input data-fk="default" value="${esc(f.default||'')}" placeholder="${f.type==='date'?'默认值：留空或填 today':'默认值（选填）'}"></span>
     <span class="lc-input" ${f.type==='select'?'':'hidden'} data-f-opts><input data-fk="options" value="${esc(Array.isArray(f.options)?f.options.map(o=>o[0]===o[1]?o[0]:`${o[0]}:${o[1]}`).join(', '):(f.options||''))}" placeholder="下拉项：值:显示名，逗号分隔（如 1:一年期, 5:五年期）"></span>
     <span class="lc-input" ${f.type==='select'?'hidden':''} data-f-hint><input data-fk="hint" value="${esc(f.hint||'')}" placeholder="字段下方提示说明（选填）"></span>
    </div>
   </div>`).join('');

   const outputsHtml=(d.schema.outputs||[]).map((o,idx)=>`<div class="lc-builder-card" data-o-idx="${idx}">
    <div class="lc-builder-out-grid">
     <span class="lc-input"><input data-ok="label" value="${esc(o.label)}" placeholder="结果项名称 如 违约金合计"></span>
     <span class="lc-input"><input data-ok="key" value="${esc(o.key||'')}" placeholder="变量名(选填)"></span>
     <span class="lc-input"><select data-ok="format">
      <option value="money"${o.format==='money'?' selected':''}>金额（元）</option>
      <option value="rmb"${o.format==='rmb'?' selected':''}>人民币大写</option>
      <option value="percent"${o.format==='percent'?' selected':''}>百分比（%）</option>
      <option value="number"${o.format==='number'?' selected':''}>数值（保留小数）</option>
      <option value="integer"${o.format==='integer'?' selected':''}>整数</option>
      <option value="date"${o.format==='date'?' selected':''}>日期</option>
      <option value="text"${o.format==='text'?' selected':''}>纯文本</option>
     </select></span>
     <label class="lc-check" title="在结果卡片顶部醒目大字展示"><input type="radio" name="ed_headline" value="${idx}" ${o.headline?'checked':''}><span>主结果</span></label>
     <button type="button" class="lc-row-del" data-del-output="${idx}" title="删除此结果项">×</button>
    </div>
    <span class="lc-input"><input data-ok="expr" value="${esc(o.expr)}" placeholder="计算公式，例如 amount * rate / 100 或 courtFee(amount)"></span>
    <span class="lc-input"><input data-ok="sub" value="${esc(o.sub||'')}" placeholder="过程说明（选填，可用 {变量名} 引用数值）"></span>
   </div>`).join('');

   const fnChips=[
    ['if(a>0, a, 0)','条件判断'],['min(a, b)','取较小值'],['max(a, b)','取较大值'],['round(x, 2)','四舍五入'],
    ['days(start, end)','间隔天数'],['workdays(start, end)','工作日天数'],['addDays(start, 15, 1)','期间顺延日'],
    ['tierPct(amount, 100000, 8, 500000, 6, 4)','超额累进(%)'],['courtFee(amount)','诉讼受理费'],['saveFee(amount)','财产保全费'],
    ['lpr1y(start)','1年期LPR'],['lprInterest(amount, start, end, 1)','LPR分段利息'],['rmb(amount)','转大写金额']
   ];

   const aiStatusText=!aiStatus.checked?'正在检查本机 AI 模型状态…'
    :aiStatus.ready?`平台 AI 就绪${aiStatus.model?' · '+aiStatus.model:''}`
    :'平台 AI 未配置（请先在左侧「设置与备份」配置模型）';
   const aiStatusClass=aiStatus.checked&&aiStatus.ready?'lc-ai-status':'lc-ai-status is-off';

   content.innerHTML=`<div class="lc-editor">
    <div class="lc-editor-main">
     <fieldset class="lc-group lc-ai-panel">
      <legend>一、向平台 AI 描述需求（自动编写与迭代调整）</legend>
      <div class="lc-ai-head">
       <span class="${aiStatusClass}" id="ed-ai-status">${esc(aiStatusText)}</span>
       <div class="lc-seg is-small" id="ed-ai-pref-seg">
        <label><input type="radio" name="ed_ai_pref" value="auto" ${aiPrefMode==='auto'?'checked':''}><span>AI 智能选型</span></label>
        <label><input type="radio" name="ed_ai_pref" value="formula" ${aiPrefMode==='formula'?'checked':''}><span>公式表单</span></label>
        <label><input type="radio" name="ed_ai_pref" value="sandbox" ${aiPrefMode==='sandbox'?'checked':''}><span>沙盒网页</span></label>
       </div>
      </div>
      <textarea id="ed-ai-prompt" class="lc-ai-textarea" placeholder="${esc(hasExistingContent?'继续输入修改意见让平台 AI 迭代调整，例如：增加一个「已付款抵扣金额」输入项，并补充相关法条提示…':'用自然语言描述你想做的小工具即可，例如：写一个建工逾期违约金计算器，输入本金、起止日期、合同日违约金万分比，同时对比 1 年期 LPR 四倍上限并给出人民币大写。')}">${esc(aiPromptText)}</textarea>
      <div class="lc-ai-chips" id="ed-ai-chips">
       ${AI_EXAMPLE_PROMPTS.map(([lbl],i)=>`<button type="button" class="lc-ai-chip" data-ai-tpl="${i}">✦ ${esc(lbl)}</button>`).join('')}
      </div>
      <div class="lc-ai-bar">
       <span class="lc-tip">直接由平台 AI 自动生成表单、公式或沙盒代码；生成后可在右侧立即试算，无需手工编写。</span>
       <button type="button" class="lc-ai-gen-btn" id="ed-ai-gen-btn"${aiBusy?' disabled':''}>${aiBusy?'AI 正在生成…':(hasExistingContent?'✦ 让 AI 按意见调整':'✦ 用平台 AI 生成小工具')}</button>
      </div>
      <p id="ed-ai-err" class="lc-error lc-mt-8" hidden></p>
      <div id="ed-ai-meta" class="lc-ai-result-meta"${aiLastMeta?'':' hidden'}>${esc(aiLastMeta)}</div>
     </fieldset>

     <fieldset class="lc-group">
      <legend>${singleUser?'二、名称、图标与适用备注':'二、名称、图标与使用范围'}</legend>
      <div class="lc-fields">
       <label class="lc-field${singleUser?' full':''}"><span>小工具名称 *</span><span class="lc-input"><input id="ed-title" maxlength="60" value="${esc(d.title)}" placeholder="AI 生成后自动填入，也可手动调整"></span></label>
       ${singleUser?'':`<label class="lc-field"><span>使用范围（谁能看到并使用）</span><span class="lc-input"><select id="ed-vis">
        <option value="private"${d.visibility==='private'?' selected':''}>仅自己使用（私密）</option>
        <option value="members"${d.visibility==='members'?' selected':''}>指定团队成员可用</option>
        <option value="team"${d.visibility==='team'?' selected':''}>全团队共享（所有登录成员可用）</option>
       </select></span></label>`}
       <label class="lc-field full"><span>一句话功能说明</span><span class="lc-input"><input id="ed-desc" maxlength="180" value="${esc(d.desc)}" placeholder="简述用途与计算口径，显示在工具卡片上"></span></label>
       <label class="lc-field full"><span>适用范围备注（选填）</span><span class="lc-input"><input id="ed-scope-note" maxlength="120" value="${esc(d.scope_note)}" placeholder="例如：仅限四川省 2026 标准 ／ 个人办案报价测算"></span></label>
       ${singleUser?'':`<div class="lc-field full" id="ed-members-wrap" ${d.visibility==='members'?'':'hidden'}>
        <span>选择可使用该工具的团队成员（创建人与管理员默认可用）</span>
        <div class="lc-member-checks">
         ${teamUsers.length?teamUsers.map(u=>`<label class="lc-check"><input type="checkbox" data-ed-member="${esc(u.id)}" ${memberSet.has(u.id)?'checked':''}><span>${esc(u.name)}</span></label>`).join(''):'<span class="small muted">暂无其他可选成员</span>'}
        </div>
       </div>`}
       <div class="lc-field full">
        <span>图标与主题配色</span>
        <div class="lc-accent-picker" id="ed-accents">
         ${accentKeys.map(ak=>`<button type="button" class="lc-accent-dot lc-dot-${ak}${d.accent===ak?' is-selected':''}" data-ed-accent="${ak}" title="${ACCENTS_META[ak].label}" aria-label="${ACCENTS_META[ak].label}"></button>`).join('')}
        </div>
        <div class="lc-icon-picker lc-mt-8" id="ed-icons">
         ${iconKeys.map(ik=>`<button type="button" class="lc-icon-opt${d.icon===ik?' is-selected':''}" data-ed-icon="${ik}">${renderIconBadge(ik,d.accent,18)}<span>${esc(ICON_LABELS[ik])}</span></button>`).join('')}
        </div>
       </div>
      </div>
     </fieldset>

     <details class="lc-adv-details" id="ed-advanced-details"${aiAdvOpen?' open':''}>
      <summary>高级微调：查看或手动修改底层字段公式／沙盒代码（选填）</summary>
      <div class="lc-adv-body">
       <div class="lc-row-between lc-mb-12">
        <div class="lc-seg is-small" id="ed-mode-seg">
         <label><input type="radio" name="ed_mode" value="formula" ${d.mode==='formula'?'checked':''}><span>可视化字段＋公式</span></label>
         <label><input type="radio" name="ed_mode" value="sandbox" ${d.mode==='sandbox'?'checked':''}><span>HTML / JS 代码（隔离沙盒）</span></label>
        </div>
        ${d.mode==='formula'
         ?'<button type="button" class="lc-back" id="ed-fill-example">填入示例：违约金与 4 倍 LPR</button>'
         :'<button type="button" class="lc-back" id="ed-fill-code-tpl">填入基础代码模板</button>'}
       </div>

       ${d.mode==='formula'?`
        <div class="lc-field full">
         <span>1. 输入项定义（左侧表单字段）</span>
         <div class="lc-rows" id="ed-fields-list">${fieldsHtml}</div>
         <button type="button" class="lc-add-row" id="ed-add-field">＋ 添加输入项</button>
        </div>
        <div class="lc-field full lc-mt-14">
         <span>2. 计算结果与公式（点击下方函数可插入公式）</span>
         <div class="lc-fn-chips" id="ed-fn-chips">
          ${fnChips.map(([fn,lbl])=>`<button type="button" class="lc-fn-chip" data-insert-fn="${esc(fn)}" title="${esc(lbl)}">${esc(lbl)} · ${esc(fn.split('(')[0])}()</button>`).join('')}
         </div>
         <div class="lc-rows lc-mt-8" id="ed-outputs-list">${outputsHtml}</div>
         <button type="button" class="lc-add-row" id="ed-add-output">＋ 添加结果项</button>
        </div>
        <label class="lc-field full lc-mt-12">
         <span>3. 依据与使用提示（选填，每行一条）</span>
         <span class="lc-input"><textarea id="ed-notes" rows="2" placeholder="例如：依据《民法典》第 585 条，计算结果仅供参考。">${esc((d.schema.notes||[]).join('\n'))}</textarea></span>
        </label>
       `:`
        <p class="lc-tip lc-mb-8">代码将在独立不透明源沙盒（<code>sandbox="allow-scripts"</code>，无网络、无 Cookie 访问权限）中安全运行。可调用 <code>window.copyResult(文本)</code> 一键复制结果。</p>
        <textarea id="ed-code" class="lc-code-area" spellcheck="false" placeholder="由 AI 自动生成的 HTML + CSS + <script> 代码…">${esc(d.code)}</textarea>
        <div class="lc-row-end lc-mt-8"><button type="button" class="lc-back" id="ed-run-sandbox">▶ 刷新右侧沙盒预览</button></div>
       `}
      </div>
     </details>

     <p id="ed-err" class="lc-error" hidden></p>
     <div class="lc-editor-foot">
      <div>${d.id?'<button type="button" class="lc-danger-btn" id="ed-delete-btn">删除此小工具</button>':''}</div>
      <div class="lc-gap-10">
       <button type="button" class="lc-back" id="ed-cancel-btn">取消</button>
       <button type="button" class="lc-head-btn primary" id="ed-save-btn">保存小工具</button>
      </div>
     </div>
    </div>

    <aside class="lc-editor-preview">
     <div class="lc-group">
      <legend>实时试算预览</legend>
      <div id="ed-preview-box" class="lc-mt-8"></div>
     </div>
    </aside>
   </div>`;

   function syncDraftFromDom(){
    const promptEl=content.querySelector('#ed-ai-prompt');
    if(promptEl)aiPromptText=promptEl.value;
    const advEl=content.querySelector('#ed-advanced-details');
    if(advEl)aiAdvOpen=advEl.open;
    d.title=content.querySelector('#ed-title')?.value.trim()||'';
    d.visibility=content.querySelector('#ed-vis')?.value||'private';
    d.desc=content.querySelector('#ed-desc')?.value.trim()||'';
    d.scope_note=content.querySelector('#ed-scope-note')?.value.trim()||'';
    d.visible_members=[...content.querySelectorAll('[data-ed-member]:checked')].map(c=>c.dataset.edMember);
    if(d.mode==='formula'){
     d.schema.fields=[...content.querySelectorAll('[data-f-idx]')].map(card=>{
      const g=k=>card.querySelector(`[data-fk="${k}"]`)?.value.trim()||'';
      const ftype=g('type')||'number';
      const rawOpts=g('options');
      const opts=ftype==='select'?rawOpts.split(/[,，\n;；]+/).map(s=>s.trim()).filter(Boolean).map(s=>{
       const sp=s.split(/[:：]/);return sp.length>=2?[sp[0].trim(),sp.slice(1).join(':').trim()]:[s,s];
      }):[];
      return {key:g('key'),label:g('label'),type:ftype,unit:g('unit'),default:g('default'),hint:g('hint'),options:opts};
     });
     const headIdx=Number(content.querySelector('input[name="ed_headline"]:checked')?.value??0);
     d.schema.outputs=[...content.querySelectorAll('[data-o-idx]')].map((card,i)=>{
      const g=k=>card.querySelector(`[data-ok="${k}"]`)?.value.trim()||'';
      return {label:g('label'),key:g('key'),format:g('format')||'money',expr:g('expr'),sub:g('sub'),headline:i===headIdx,strong:i===headIdx};
     });
     d.schema.notes=(content.querySelector('#ed-notes')?.value||'').split('\n').map(x=>x.trim()).filter(Boolean);
    }else{
     d.code=content.querySelector('#ed-code')?.value||'';
    }
   }

   function refreshPreview(){
    syncDraftFromDom();
    const pbox=content.querySelector('#ed-preview-box');
    if(!pbox)return;
    if(d.mode==='sandbox'){
     mountSandbox(pbox,d.code);
     return;
    }
    const runtime=buildCustomToolRuntime({...d,title:d.title||'预览小工具'});
    pbox.innerHTML=`<form class="lc-form" id="ed-prev-form">${runtime.form()}</form><div class="lc-result lc-result-static" id="ed-prev-res"></div>`;
    const pf=pbox.querySelector('#ed-prev-form'),pr=pbox.querySelector('#ed-prev-res');
    pf.addEventListener('submit',e=>e.preventDefault());
    const runPrev=()=>{
     const v=visibleValues(pf);
     try{renderResult(pr,runtime,runtime.calc(v))}
     catch(e){renderResult(pr,runtime,null,e.message||String(e))}
    };
    pf.addEventListener('input',runPrev);
    pf.addEventListener('change',runPrev);
    pr.addEventListener('click',e=>{const b=e.target.closest('[data-copy]');if(b&&pr._text)copyText(pr._text,b)});
    runPrev();
   }

   content.querySelector('#ed-advanced-details')?.addEventListener('toggle',e=>{aiAdvOpen=e.currentTarget.open});
   content.querySelector('#ed-ai-prompt')?.addEventListener('input',e=>{aiPromptText=e.target.value});
   content.querySelectorAll('input[name="ed_ai_pref"]').forEach(r=>r.onchange=e=>{aiPrefMode=e.target.value});
   content.querySelector('#ed-ai-chips')?.addEventListener('click',e=>{
    const b=e.target.closest('[data-ai-tpl]');if(!b)return;
    const item=AI_EXAMPLE_PROMPTS[Number(b.dataset.aiTpl)];if(!item)return;
    aiPromptText=item[1];
    const ta=content.querySelector('#ed-ai-prompt');
    if(ta){ta.value=aiPromptText;ta.focus()}
   });
   content.querySelector('#ed-ai-gen-btn')?.addEventListener('click',async()=>{
    if(aiBusy)return;
    syncDraftFromDom();
    const errEl=content.querySelector('#ed-ai-err');
    errEl.hidden=true;
    const promptStr=aiPromptText.trim();
    if(promptStr.length<4){
     errEl.textContent='请先用至少 4 个字描述需要生成或调整的计算规则。';
     errEl.hidden=false;
     content.querySelector('#ed-ai-prompt')?.focus();
     return;
    }
    aiBusy=true;
    const btn=content.querySelector('#ed-ai-gen-btn');
    if(btn){btn.disabled=true;btn.textContent='AI 正在生成小工具…'}
    try{
     const payload={prompt:promptStr,preferred_mode:aiPrefMode};
     if(d.id||d._aiGenerated){
      payload.current_tool={
       title:d.title,desc:d.desc,scope_note:d.scope_note,icon:d.icon,accent:d.accent,
       mode:d.mode,schema:d.mode==='formula'?d.schema:null,code:d.mode==='sandbox'?d.code:''
      };
     }
     const res=await apiAiGenerate(payload);
     if(!editingDraft||editingDraft!==d)return;
     const gen=res.tool||{};
     d.title=gen.title||d.title;
     d.desc=gen.desc||d.desc;
     d.scope_note=gen.scope_note??d.scope_note;
     d.icon=ICONS[gen.icon]?gen.icon:d.icon;
     d.accent=ACCENTS_META[gen.accent]?gen.accent:d.accent;
     d.mode=gen.mode==='sandbox'?'sandbox':'formula';
     if(d.mode==='formula'&&gen.schema)d.schema=gen.schema;
     if(d.mode==='sandbox'&&gen.code)d.code=gen.code;
     d._aiGenerated=true;
     aiPromptText='';
     aiLastMeta=`已由平台 AI${res.model?'（'+res.model+'）':''}生成${d.mode==='sandbox'?'沙盒网页':'公式表单'}小工具。请在右侧试算核对，如需修改可直接再次输入调整意见，满意后点击下方「保存小工具」。`;
     showToast('AI 已生成小工具，请在右侧试算预览');
     renderEditor();
    }catch(ex){
     if(editingDraft===d){
      errEl.textContent=ex.message||String(ex);
      errEl.hidden=false;
     }
    }finally{
     aiBusy=false;
     const b=backdrop?.querySelector('#ed-ai-gen-btn');
     if(b){b.disabled=false;b.textContent=(d.id||d._aiGenerated)?'✦ 让 AI 按意见调整':'✦ 用平台 AI 生成小工具'}
    }
   });

   content.querySelectorAll('[data-ok="expr"]').forEach(inp=>{inp.addEventListener('focus',()=>{lastFocusedExpr=inp})});
   content.querySelector('#ed-fn-chips')?.addEventListener('click',e=>{
    const b=e.target.closest('[data-insert-fn]');if(!b)return;
    const target=lastFocusedExpr&&content.contains(lastFocusedExpr)?lastFocusedExpr:content.querySelector('[data-ok="expr"]');
    if(!target)return;
    const ins=b.dataset.insertFn;
    const stPos=target.selectionStart??target.value.length,enPos=target.selectionEnd??target.value.length;
    target.value=target.value.slice(0,stPos)+ins+target.value.slice(enPos);
    target.focus();refreshPreview();
   });

   const visEl=content.querySelector('#ed-vis');
   if(visEl)visEl.onchange=e=>{
    syncDraftFromDom();
    const mw=content.querySelector('#ed-members-wrap');
    if(mw)mw.hidden=e.target.value!=='members';
   };
   content.querySelector('#ed-accents').onclick=e=>{
    const b=e.target.closest('[data-ed-accent]');if(!b)return;
    syncDraftFromDom();d.accent=b.dataset.edAccent;renderEditor();
   };
   content.querySelector('#ed-icons').onclick=e=>{
    const b=e.target.closest('[data-ed-icon]');if(!b)return;
    syncDraftFromDom();d.icon=b.dataset.edIcon;renderEditor();
   };
   content.querySelectorAll('input[name="ed_mode"]').forEach(r=>r.onchange=e=>{
    syncDraftFromDom();d.mode=e.target.value;aiAdvOpen=true;renderEditor();
   });
   content.querySelector('#ed-fill-example')?.addEventListener('click',()=>{
    syncDraftFromDom();
    if(!d.title)d.title='逾期违约金与 4 倍 LPR 对照';
    if(!d.desc)d.desc='按合同日违约金标准测算，并自动对比同期 1 年期 LPR 四倍。';
    d.schema=EXAMPLE_FORMULA_SCHEMA();
    aiAdvOpen=true;
    renderEditor();
   });
   content.querySelector('#ed-fill-code-tpl')?.addEventListener('click',()=>{
    syncDraftFromDom();d.code=EXAMPLE_SANDBOX_CODE;aiAdvOpen=true;renderEditor();
   });
   content.querySelector('#ed-run-sandbox')?.addEventListener('click',refreshPreview);

   content.querySelector('#ed-add-field')?.addEventListener('click',()=>{
    syncDraftFromDom();
    const n=(d.schema.fields?.length||0)+1;
    d.schema.fields.push({key:'f'+n,label:'参数 '+n,type:'number',unit:'',default:'',hint:'',options:[]});
    renderEditor();
   });
   content.querySelector('#ed-add-output')?.addEventListener('click',()=>{
    syncDraftFromDom();
    const n=(d.schema.outputs?.length||0)+1;
    d.schema.outputs.push({label:'结果 '+n,key:'',format:'money',expr:'0',sub:'',headline:false,strong:false});
    renderEditor();
   });
   content.querySelectorAll('[data-del-field]').forEach(btn=>btn.onclick=()=>{
    syncDraftFromDom();
    if(d.schema.fields.length<=1){showToast('请至少保留一个输入项',true);return}
    d.schema.fields.splice(Number(btn.dataset.delField),1);
    renderEditor();
   });
   content.querySelectorAll('[data-del-output]').forEach(btn=>btn.onclick=()=>{
    syncDraftFromDom();
    if(d.schema.outputs.length<=1){showToast('请至少保留一个结果项',true);return}
    d.schema.outputs.splice(Number(btn.dataset.delOutput),1);
    if(!d.schema.outputs.some(o=>o.headline))d.schema.outputs[0].headline=true;
    renderEditor();
   });
   content.querySelectorAll('[data-fk="type"]').forEach(sel=>sel.onchange=()=>{
    const card=sel.closest('[data-f-idx]');
    const isSel=sel.value==='select';
    card.querySelector('[data-f-opts]').hidden=!isSel;
    card.querySelector('[data-f-hint]').hidden=isSel;
    refreshPreview();
   });
   content.querySelectorAll('#ed-fields-list input,#ed-outputs-list input,#ed-outputs-list select,#ed-notes').forEach(el=>{
    el.addEventListener('input',()=>{if(d.mode==='formula')refreshPreview()});
    el.addEventListener('change',()=>{if(d.mode==='formula')refreshPreview()});
   });

   content.querySelector('#ed-cancel-btn').onclick=()=>renderHome();
   content.querySelector('#ed-delete-btn')?.addEventListener('click',async()=>{
    if(!d.id||!confirm(`确定删除自定义小工具「${d.title}」吗？此操作不可恢复。`))return;
    try{
     const res=await apiCalc({action:'delete_tool',id:d.id});
     applyServerPayload(res);
     showToast('已删除小工具');
     renderHome();
    }catch(ex){showToast(ex.message,true)}
   });
   content.querySelector('#ed-save-btn').onclick=async ev=>{
    syncDraftFromDom();
    const errEl=content.querySelector('#ed-err');errEl.hidden=true;
    const btn=ev.currentTarget;btn.disabled=true;
    try{
     const res=await apiCalc({action:'save_tool',tool:d});
     applyServerPayload(res);
     showToast('小工具已保存');
     openTool(res.saved_id);
    }catch(ex){
     errEl.textContent=ex.message||String(ex);errEl.hidden=false;
    }finally{btn.disabled=false}
   };

   refreshPreview();
  }

  // ───────────── 浮层窗口拖动与挂载 ─────────────
  function applyWinTransform(modalEl){
   modalEl.style.transform=(winOffset.x||winOffset.y)?`translate3d(${winOffset.x}px,${winOffset.y}px,0)`:'';
  }
  function bindWindowDrag(modalEl,headEl){
   headEl.addEventListener('dblclick',e=>{
    if(e.target.closest('button,input,select'))return;
    winOffset={x:0,y:0};applyWinTransform(modalEl);
   });
   headEl.addEventListener('pointerdown',e=>{
    if(e.button!==0||e.target.closest('button,input,select,a'))return;
    const startX=e.clientX,startY=e.clientY,origX=winOffset.x,origY=winOffset.y;
    const rect=modalEl.getBoundingClientRect();
    const minDx=-rect.left+8,maxDx=window.innerWidth-rect.right-8;
    const minDy=-rect.top+8,maxDy=window.innerHeight-rect.bottom-8;
    let moved=false;
    const onMove=ev=>{
     const dx=ev.clientX-startX,dy=ev.clientY-startY;
     if(!moved&&Math.hypot(dx,dy)<4)return;
     moved=true;
     modalEl.classList.add('is-window-dragging');
     winOffset={
      x:origX+clamp(dx,minDx,maxDx),
      y:origY+clamp(dy,minDy,maxDy)
     };
     applyWinTransform(modalEl);
    };
    const onEnd=()=>{
     modalEl.classList.remove('is-window-dragging');
     window.removeEventListener('pointermove',onMove);
     window.removeEventListener('pointerup',onEnd);
     window.removeEventListener('pointercancel',onEnd);
     winDragState=null;
    };
    winDragState={onEnd};
    window.addEventListener('pointermove',onMove);
    window.addEventListener('pointerup',onEnd);
    window.addEventListener('pointercancel',onEnd);
   });
  }

  async function togglePinTool(id){
   const pinSet=new Set(pinnedIds);
   if(pinSet.has(id))pinSet.delete(id);else pinSet.add(id);
   const allIds=allToolsOrdered().map(t=>t.id);
   orderIds=allIds;
   pinnedIds=allIds.filter(x=>pinSet.has(x));
   saveLocalOrder();
   renderHome();
   try{
    const res=await apiCalc({action:'reorder',order_ids:orderIds,pinned_ids:pinnedIds});
    applyServerPayload(res);
   }catch{}
  }

  function ensureModal(){
   if(backdrop)return backdrop;
   backdrop=document.createElement('div');
   backdrop.id='legal-calc-backdrop';
   backdrop.className='lc-backdrop';
   backdrop.hidden=true;
   backdrop.innerHTML=`<section class="lc-modal" role="dialog" aria-modal="true" aria-labelledby="lc-title" tabindex="-1">
    <header class="lc-head" title="按住可自由拖动窗口位置，双击恢复居中">
     <div class="lc-head-left">
      <button type="button" class="lc-back" id="lc-back" hidden>‹ 全部工具</button>
      <span class="lc-brand-mark">${svg(ICONS.brand,17)}</span>
      <h2 id="lc-title">法律计算</h2>
      <span class="lc-drag-tip">可拖动窗口</span>
     </div>
     <div class="lc-head-right">
      <button type="button" class="lc-head-btn primary" id="lc-new-btn">＋ AI 生成小工具</button>
      <button type="button" class="lc-close" id="lc-close" aria-label="关闭法律计算">×</button>
     </div>
    </header>
    <div class="lc-content" id="lc-content"></div>
   </section>`;
   document.body.appendChild(backdrop);
   const modalEl=backdrop.querySelector('.lc-modal'),headEl=backdrop.querySelector('.lc-head');
   bindWindowDrag(modalEl,headEl);
   backdrop.addEventListener('mousedown',e=>{if(e.target===backdrop)closeModal()});
   backdrop.querySelector('#lc-close').onclick=closeModal;
   backdrop.querySelector('#lc-back').onclick=()=>renderHome();
   backdrop.querySelector('#lc-new-btn').onclick=()=>openEditor(null,false);
   const contentEl=backdrop.querySelector('#lc-content');
   contentEl.addEventListener('click',e=>{
    const pinBtn=e.target.closest('[data-pin-tool]');
    if(pinBtn){e.stopPropagation();togglePinTool(pinBtn.dataset.pinTool);return}
    const editBtn=e.target.closest('[data-edit-tool]');
    if(editBtn){e.stopPropagation();const t=customTools.find(x=>x.id===editBtn.dataset.editTool);if(t)openEditor(t,false);return}
    const dupBtn=e.target.closest('[data-dup-tool]');
    if(dupBtn){e.stopPropagation();const t=customTools.find(x=>x.id===dupBtn.dataset.dupTool);if(t)openEditor(t,true);return}
    const card=e.target.closest('.lc-card[data-tool]');
    if(card){
     if(Date.now()<suppressCardClickUntil)return;
     openTool(card.dataset.tool);
    }
   });
   contentEl.addEventListener('keydown',e=>{
    if((e.key==='Enter'||e.key===' ')&&e.target.matches?.('.lc-card[data-tool]')){
     e.preventDefault();openTool(e.target.dataset.tool);
    }
   });
   return backdrop;
  }

  function openModal(toolId){
   if(!isWorkspaceReady())return;
   ensureModal();
   window.HengzhangQuickLinks?.close?.();
   previousFocus=document.activeElement;
   isOpen=true;backdrop.hidden=false;
   syncFromServer(false);
   document.getElementById('legal-calc-trigger')?.setAttribute('aria-expanded','true');
   if(toolId)openTool(toolId);else renderHome();
   if(!toolId)requestAnimationFrame(()=>backdrop.querySelector('.lc-card')?.focus());
  }
  function closeModal(){
   if(!isOpen||!backdrop)return;
   cancelCardDrag(false);
   if(winDragState?.onEnd)winDragState.onEnd();
   isOpen=false;backdrop.hidden=true;activeSandboxFrame=null;editingDraft=null;
   // 移除表单节点，避免计算器输入被视为未保存草稿而阻止页面更新
   backdrop.querySelector('#lc-content').innerHTML='';current=null;
   document.getElementById('legal-calc-trigger')?.setAttribute('aria-expanded','false');
   if(previousFocus&&typeof previousFocus.focus==='function')previousFocus.focus();
  }

  function mountTrigger(){
   if(document.getElementById('legal-calc-trigger'))return true;
   const header=document.querySelector('.desk > main > header');
   if(!header)return false;
   const btn=document.createElement('button');
   btn.type='button';btn.id='legal-calc-trigger';btn.className='ql-trigger lc-trigger';
   btn.setAttribute('aria-haspopup','dialog');btn.setAttribute('aria-expanded','false');
   btn.title='打开法律计算与自定义小工具';
   btn.innerHTML=`<span class="lc-trig-emblem">${svg(ICONS.brand,13)}</span><span class="ql-trigger-label">法律计算</span>`;
   btn.addEventListener('click',()=>isOpen?closeModal():openModal());
   const updates=header.querySelector('.header-updates');
   const ql=document.getElementById('quick-links-trigger');
   if(updates){
    if(ql&&ql.parentNode===updates)updates.insertBefore(btn,ql);
    else updates.insertBefore(btn,updates.firstChild);
   }else{
    header.insertBefore(btn,ql||null);
   }
   return true;
  }

  document.addEventListener('keydown',e=>{
   if(!isOpen)return;
   if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeModal();return}
   if((e.metaKey||e.ctrlKey)&&!e.altKey&&!e.shiftKey&&e.key.toLowerCase()==='k')closeModal();
  },true);
  window.addEventListener('hengzhang-session-clear',()=>{
   serverLoaded=false;customTools=[];teamUsers=[];orderIds=[];pinnedIds=[];aiStatus={checked:false,ready:false,model:'',provider:'',can_configure:false};closeModal();
  });

  if(!mountTrigger()){document.addEventListener('DOMContentLoaded',mountTrigger,{once:true})}
  window.HengzhangLegalCalc={open:openModal,close:closeModal,refresh:()=>syncFromServer(true),_test:{rmbUpper,propertyFee,saveFee,diffYMD,toDay,iso,addMonths,isOff,segments,accrue,calcVatGross,calcVatNet,calcSurcharge,evalExpr,TOOLS}};
})();
