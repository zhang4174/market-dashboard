let charts = {};
let currentTab = 'overview';
let lbImages = [];
let lbIndex = 0;

function fmtNum(n){if(n>=10000)return(n/10000).toFixed(1)+'万';return n.toLocaleString()}
function getLayerClass(layer){if(!layer)return'';if(layer.includes('L1')||layer.includes('核心'))return'l1';if(layer.includes('L2')||layer.includes('街头')||layer.includes('篮球'))return'l2';if(layer.includes('L3')||layer.includes('复古'))return'l3';return''}
function getLayerLabel(layer){if(!layer)return'';if(layer.includes('L1')||layer.includes('核心'))return'L1 传统';if(layer.includes('L2')||layer.includes('篮球'))return'L2 街头';if(layer.includes('L3')||layer.includes('复古'))return'L3 复古';return layer}

function switchTab(tab){
  currentTab=tab;
  document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));
  document.querySelector('.nav-tab[data-tab="'+tab+'"]').classList.add('active');
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  document.getElementById('sec-'+tab).classList.add('active');
  window.scrollTo({top:0,behavior:'smooth'});
  setTimeout(()=>{
    if(tab==='overview')renderOverviewCharts();
    if(tab==='dewu')renderDewuCharts();
    if(tab==='farfetch')renderFfCharts();
    if(tab==='instagram')renderIgCharts();
  },50);
}

function openLightbox(images,index){lbImages=images;lbIndex=index;updateLightbox();document.getElementById('lightbox').classList.add('active');document.body.style.overflow='hidden'}
function closeLightbox(e){if(e&&e.target&&e.target.id!=='lightbox'&&!e.target.classList.contains('lb-close'))return;document.getElementById('lightbox').classList.remove('active');document.body.style.overflow=''}
function navLightbox(dir,e){e.stopPropagation();lbIndex=(lbIndex+dir+lbImages.length)%lbImages.length;updateLightbox()}
function updateLightbox(){const item=lbImages[lbIndex];document.getElementById('lb-img').src=item.src;document.getElementById('lb-title').textContent=item.title||'';document.getElementById('lb-desc').textContent=item.desc||'';const linkEl=document.getElementById('lb-link');if(item.link){linkEl.href=item.link;linkEl.style.display='inline-block'}else{linkEl.style.display='none'}}
document.addEventListener('keydown',e=>{
  if(!document.getElementById('lightbox').classList.contains('active'))return;
  if(e.key==='Escape')closeLightbox();
  if(e.key==='ArrowLeft')navLightbox(-1,{stopPropagation:()=>{}});
  if(e.key==='ArrowRight')navLightbox(1,{stopPropagation:()=>{}});
});

function disposeChart(id){if(charts[id]){charts[id].dispose();delete charts[id]}}

function renderOverviewCharts(){
  // 三层分类对比
  disposeChart('chart-layer-compare');
  const ch1=echarts.init(document.getElementById('chart-layer-compare'));
  charts['chart-layer-compare']=ch1;
  const dewuLayers={};
  DEWU_PRODUCTS.forEach(p=>{const l=p.catLabel||p.cat;dewuLayers[l]=(dewuLayers[l]||0)+1});
  ch1.setOption({
    tooltip:{trigger:'axis',axisPointer:{type:'shadow'}},
    legend:{data:['得物','Farfetch','Instagram'],textStyle:{color:'#8888a0'}},
    grid:{left:60,right:20,top:50,bottom:30},
    xAxis:{type:'category',data:['核心传统板鞋','街头板鞋/篮球衍生','复古街头板鞋'],axisLine:{lineStyle:{color:'#2a2a40'}},axisLabel:{color:'#8888a0'}},
    yAxis:{type:'value',name:'数量',axisLine:{lineStyle:{color:'#2a2a40'}},axisLabel:{color:'#8888a0'},splitLine:{lineStyle:{color:'#1a1a28'}}},
    series:[
      {name:'得物',type:'bar',data:[dewuLayers['L1 核心传统滑板鞋']||0,dewuLayers['L2 篮球衍生街头板鞋']||0,dewuLayers['L3 复古街头休闲板鞋']||0],itemStyle:{color:'#ff2e63',borderRadius:[4,4,0,0]}},
      {name:'Farfetch',type:'bar',data:LAYERS.map(l=>l.productCount),itemStyle:{color:'#a855f7',borderRadius:[4,4,0,0]}},
      {name:'Instagram',type:'bar',data:LAYERS.map(l=>l.igPosts),itemStyle:{color:'#ff4757',borderRadius:[4,4,0,0]}}
    ]
  });

  // 品牌覆盖对比
  disposeChart('chart-brand-compare');
  const ch2=echarts.init(document.getElementById('chart-brand-compare'));
  charts['chart-brand-compare']=ch2;
  const dewuBrands={};
  DEWU_PRODUCTS.forEach(p=>{dewuBrands[p.brand]=(dewuBrands[p.brand]||0)+1});
  const ffBrands={};
  FF_PRODUCTS.forEach(p=>{ffBrands[p.brand]=(ffBrands[p.brand]||0)+1});
  const allBrands=[...new Set([...Object.keys(dewuBrands),...Object.keys(ffBrands)])];
  const topBrands=allBrands.sort((a,b)=>(ffBrands[b]||0)+(dewuBrands[b]||0)-(ffBrands[a]||0)-(dewuBrands[a]||0)).slice(0,12);
  ch2.setOption({
    tooltip:{trigger:'axis',axisPointer:{type:'shadow'}},
    legend:{data:['得物款数','Farfetch款数'],textStyle:{color:'#8888a0'}},
    grid:{left:120,right:20,top:50,bottom:30},
    xAxis:{type:'value',axisLine:{lineStyle:{color:'#2a2a40'}},axisLabel:{color:'#8888a0'},splitLine:{lineStyle:{color:'#1a1a28'}}},
    yAxis:{type:'category',data:topBrands.slice().reverse(),axisLine:{lineStyle:{color:'#2a2a40'}},axisLabel:{color:'#8888a0'}},
    series:[
      {name:'得物款数',type:'bar',data:topBrands.map(b=>dewuBrands[b]||0).reverse(),itemStyle:{color:'#ff2e63'}},
      {name:'Farfetch款数',type:'bar',data:topBrands.map(b=>ffBrands[b]||0).reverse(),itemStyle:{color:'#a855f7'}}
    ]
  });

  // 价格带对比
  disposeChart('chart-price-compare');
  const ch3=echarts.init(document.getElementById('chart-price-compare'));
  charts['chart-price-compare']=ch3;
  const priceRanges=['0-300','300-500','500-800','800-1500','1500-3000','3000-5000','5000-10000','10000+'];
  const dewuPriceDist=[0,0,0,0,0,0,0,0];
  DEWU_PRODUCTS.forEach(p=>{const pr=p.price;if(pr<300)dewuPriceDist[0]++;else if(pr<500)dewuPriceDist[1]++;else if(pr<800)dewuPriceDist[2]++;else if(pr<1500)dewuPriceDist[3]++;else if(pr<3000)dewuPriceDist[4]++;else if(pr<5000)dewuPriceDist[5]++;else if(pr<10000)dewuPriceDist[6]++;else dewuPriceDist[7]++});
  const ffPriceDist=[0,0,0,0,0,0,0,0];
  FF_PRODUCTS.forEach(p=>{const pr=p.price_cny;if(pr<300)ffPriceDist[0]++;else if(pr<500)ffPriceDist[1]++;else if(pr<800)ffPriceDist[2]++;else if(pr<1500)ffPriceDist[3]++;else if(pr<3000)ffPriceDist[4]++;else if(pr<5000)ffPriceDist[5]++;else if(pr<10000)ffPriceDist[6]++;else ffPriceDist[7]++});
  ch3.setOption({
    tooltip:{trigger:'axis',axisPointer:{type:'shadow'}},
    legend:{data:['得物','Farfetch'],textStyle:{color:'#8888a0'}},
    grid:{left:60,right:20,top:50,bottom:40},
    xAxis:{type:'category',data:priceRanges,axisLine:{lineStyle:{color:'#2a2a40'}},axisLabel:{color:'#8888a0',rotate:30}},
    yAxis:{type:'value',name:'商品数',axisLine:{lineStyle:{color:'#2a2a40'}},axisLabel:{color:'#8888a0'},splitLine:{lineStyle:{color:'#1a1a28'}}},
    series:[
      {name:'得物',type:'bar',data:dewuPriceDist,itemStyle:{color:'#ff2e63',borderRadius:[4,4,0,0]}},
      {name:'Farfetch',type:'bar',data:ffPriceDist,itemStyle:{color:'#a855f7',borderRadius:[4,4,0,0]}}
    ]
  });

  // 三层占比
  disposeChart('chart-layer-pie');
  const ch4=echarts.init(document.getElementById('chart-layer-pie'));
  charts['chart-layer-pie']=ch4;
  ch4.setOption({
    tooltip:{trigger:'item',formatter:'{b}: {c} 款 ({d}%)'},
    legend:{bottom:0,textStyle:{color:'#8888a0'}},
    series:[{type:'pie',radius:['50%','75%'],center:['50%','45%'],itemStyle:{borderColor:'#1a1a28',borderWidth:3},label:{color:'#e8e8f0',formatter:'{b}\n{d}%'},
      data:LAYERS.map((l,i)=>({value:l.productCount,name:l.layer,itemStyle:{color:['#00ff88','#ffaa00','#00aaff'][i]}}))
    }]
  });
}

// === 得物 ===
let dewuFilter='all';
function renderDewuFilters(){
  const bar=document.getElementById('dewu-filters');
  const cats=['all',...new Set(DEWU_PRODUCTS.map(p=>p.catLabel||p.cat))];
  bar.innerHTML=cats.map(c=>'<div class="filter-btn '+(dewuFilter===c?'active':'')+'" onclick="filterDewu(\''+c+'\')">'+(c==='all'?'全部':getLayerLabel(c))+'</div>').join('');
}
function filterDewu(cat){dewuFilter=cat;renderDewuFilters();renderDewuGrid()}
function renderDewuGrid(){
  const grid=document.getElementById('dewu-grid');
  let products=DEWU_PRODUCTS;
  if(dewuFilter!=='all'){products=products.filter(p=>(p.catLabel===dewuFilter||p.cat===dewuFilter))}
  const imgs=products.map(p=>({src:p.img,title:p.name,desc:p.brand+' · ¥'+p.price+' · '+p.buyers+'人付款',link:p.link}));
  grid.innerHTML=products.map((p,i)=>{
    const lc=getLayerClass(p.catLabel||p.cat);
    return '<div class="img-card" onclick="openDewuLightbox('+i+')"><div class="img-wrap"><img src="'+p.img+'" alt="'+p.name+'" loading="lazy"></div><div class="card-tag '+lc+'">'+getLayerLabel(p.catLabel||p.cat)+'</div>'+(p.isNew?'<div class="card-badge">NEW</div>':'')+'<div class="card-info"><div class="card-title" title="'+p.name+'"><a href="'+p.link+'" target="_blank" rel="noopener" class="card-link" onclick="event.stopPropagation()">'+p.name+'</a></div><div class="card-meta"><span>'+p.brand+'</span><span class="card-price">¥'+p.price+'</span></div><div class="card-meta" style="margin-top:2px;color:var(--dewu)"><span>🔥 '+p.buyers+'</span></div></div></div>';
  }).join('');
  window._dewuImgs=imgs;
  window._dewuProducts=products;
}
function openDewuLightbox(i){openLightbox(window._dewuImgs,i)}

function renderDewuCharts(){
  // Top15
  disposeChart('chart-dewu-top');
  const ch=echarts.init(document.getElementById('chart-dewu-top'));
  charts['chart-dewu-top']=ch;
  const top=DEWU_PRODUCTS.slice(0,15);
  ch.setOption({
    tooltip:{trigger:'axis',axisPointer:{type:'shadow'},formatter:p=>{const d=p[0];return d.name+'<br/>付款人数: '+top[d.dataIndex].buyers+'<br/>价格: ¥'+top[d.dataIndex].price}},
    grid:{left:180,right:40,top:20,bottom:30},
    xAxis:{type:'value',axisLine:{lineStyle:{color:'#2a2a40'}},axisLabel:{color:'#8888a0',formatter:v=>fmtNum(v)},splitLine:{lineStyle:{color:'#1a1a28'}}},
    yAxis:{type:'category',inverse:true,data:top.map(p=>p.name.length>20?p.name.slice(0,20)+'...':p.name),axisLine:{lineStyle:{color:'#2a2a40'}},axisLabel:{color:'#e8e8f0',fontSize:11}},
    series:[{type:'bar',data:top.map(p=>p.buyersNum),
      itemStyle:{color:new echarts.graphic.LinearGradient(0,0,1,0,[{offset:0,color:'#ff2e63'},{offset:1,color:'#ff6b9d'}]),borderRadius:[0,4,4,0]},
      label:{show:true,position:'right',color:'#ff2e63',fontWeight:600,formatter:p=>top[p.dataIndex].buyers}
    }]
  });

  // 品牌分布
  disposeChart('chart-dewu-brand');
  const ch2=echarts.init(document.getElementById('chart-dewu-brand'));
  charts['chart-dewu-brand']=ch2;
  const brandCount={};
  DEWU_PRODUCTS.forEach(p=>{brandCount[p.brand]=(brandCount[p.brand]||0)+1});
  const sortedBrands=Object.entries(brandCount).sort((a,b)=>b[1]-a[1]).slice(0,10);
  ch2.setOption({
    tooltip:{trigger:'item',formatter:'{b}: {c} 款 ({d}%)'},
    series:[{type:'pie',radius:['40%','70%'],center:['50%','50%'],itemStyle:{borderColor:'#1a1a28',borderWidth:2},label:{color:'#e8e8f0',fontSize:11},data:sortedBrands.map(([name,value])=>({name,value}))}],
    color:['#ff2e63','#ff6b9d','#ffaa00','#ffd93d','#00ff88','#00d68f','#00aaff','#4da6ff','#a855f7','#d8b4fe']
  });

  // 价格分布
  disposeChart('chart-dewu-price');
  const ch3=echarts.init(document.getElementById('chart-dewu-price'));
  charts['chart-dewu-price']=ch3;
  const bins=[],binLabels=[];
  for(let i=0;i<=1700;i+=100){binLabels.push('¥'+i);bins.push(DEWU_PRODUCTS.filter(p=>p.price>=i&&p.price<i+100).length)}
  ch3.setOption({
    tooltip:{trigger:'axis',axisPointer:{type:'shadow'}},
    grid:{left:50,right:20,top:20,bottom:40},
    xAxis:{type:'category',data:binLabels,axisLine:{lineStyle:{color:'#2a2a40'}},axisLabel:{color:'#8888a0',rotate:45,interval:2}},
    yAxis:{type:'value',name:'款数',axisLine:{lineStyle:{color:'#2a2a40'}},axisLabel:{color:'#8888a0'},splitLine:{lineStyle:{color:'#1a1a28'}}},
    series:[{type:'bar',data:bins,itemStyle:{color:new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:'#ff2e63'},{offset:1,color:'rgba(255,46,99,0.2)'}]),borderRadius:[4,4,0,0]}}]
  });

  // 热力图
  disposeChart('chart-dewu-heatmap');
  const ch4=echarts.init(document.getElementById('chart-dewu-heatmap'));
  charts['chart-dewu-heatmap']=ch4;
  const layers=['L1 核心传统滑板鞋','L2 篮球衍生街头板鞋','L3 复古街头休闲板鞋'];
  const heatBrands=Object.entries(brandCount).sort((a,b)=>b[1]-a[1]).slice(0,10).map(x=>x[0]);
  const heatData=[];
  heatBrands.forEach((b,bi)=>{layers.forEach((l,li)=>{const count=DEWU_PRODUCTS.filter(p=>p.brand===b&&(p.catLabel===l||p.cat===l)).length;heatData.push([li,bi,count])})});
  ch4.setOption({
    tooltip:{position:'top',formatter:p=>heatBrands[p.data[1]]+'<br/>'+layers[p.data[0]]+'<br/>'+p.data[2]+' 款'},
    grid:{left:100,right:20,top:10,bottom:60},
    xAxis:{type:'category',data:['L1核心','L2街头','L3复古'],splitArea:{show:true,areaStyle:{color:['rgba(0,255,136,0.05)','rgba(255,170,0,0.05)','rgba(0,170,255,0.05)']}},axisLine:{lineStyle:{color:'#2a2a40'}},axisLabel:{color:'#8888a0'}},
    yAxis:{type:'category',data:heatBrands,axisLine:{lineStyle:{color:'#2a2a40'}},axisLabel:{color:'#e8e8f0',fontSize:11}},
    visualMap:{min:0,max:15,calculable:true,orient:'horizontal',left:'center',bottom:0,textStyle:{color:'#8888a0'},inRange:{color:['#1a1a28','#ff2e63','#ff6b9d']}},
    series:[{type:'heatmap',data:heatData,label:{show:true,color:'#fff',fontSize:11}}]
  });
}

// === Farfetch ===
let ffFilter='all';
let ffFilterType='layer';
function renderFfFilters(){
  const bar=document.getElementById('ff-filters');
  const layers=['all',...new Set(FAMILIES.map(f=>f.layer))];
  bar.innerHTML='<div class="filter-btn '+(ffFilterType==='layer'&&ffFilter==='all'?'active':'')+'" onclick="filterFf(\'all\',\'layer\')">全部</div>'+
    layers.filter(l=>l!=='all').map(l=>'<div class="filter-btn '+getLayerClass(l)+' '+(ffFilterType==='layer'&&ffFilter===l?'active':'')+'" onclick="filterFf(\''+l+'\',\'layer\')">'+getLayerLabel(l)+'</div>').join('')+
    '<span style="width:1px;background:var(--border);margin:0 8px"></span>'+
    '<div class="filter-btn '+(ffFilter==='men'?'active':'')+'" onclick="filterFf(\'men\',\'gender\')">👨 男装</div>'+
    '<div class="filter-btn '+(ffFilter==='women'?'active':'')+'" onclick="filterFf(\'women\',\'gender\')">👩 女装</div>';
}
function filterFf(val,type){ffFilter=val;ffFilterType=type||'layer';renderFfFilters();renderFfGrid()}
function renderFfGrid(){
  const grid=document.getElementById('ff-grid');
  let products=FF_PRODUCTS;
  if(ffFilterType==='layer'){if(ffFilter!=='all')products=products.filter(p=>p.layer===ffFilter)}
  else if(ffFilterType==='gender'){products=products.filter(p=>p.market===ffFilter)}
  else{products=products.filter(p=>p.family===ffFilter)}
  
  const imgs=products.map(p=>({src:p._img_b64,title:p.product_name,desc:p.brand+' · '+p.family+' · ¥'+p.price_cny+' · '+(p.market==='men'?'男装':'女装'),link:p.source_url}));
  grid.innerHTML=products.map((p,i)=>{
    const lc=getLayerClass(p.layer);
    return '<div class="img-card" onclick="openFfLightbox('+i+')"><div class="img-wrap"><img src="'+p._img_b64+'" alt="'+p.product_name+'" loading="lazy"></div><div class="card-tag '+lc+'">'+getLayerLabel(p.layer)+'</div><div class="card-info"><div class="card-title" title="'+p.product_name+'"><a href="'+p.source_url+'" target="_blank" rel="noopener" class="card-link" onclick="event.stopPropagation()">'+(p.product_name.length>30?p.product_name.slice(0,30)+'...':p.product_name)+'</a></div><div class="card-meta"><span>'+p.brand+'</span><span class="card-price">¥'+p.price_cny+'</span></div><div class="card-meta" style="margin-top:2px;color:var(--text-mute);font-size:.65em"><span>'+p.family+'</span></div></div></div>';
  }).join('');
  window._ffImgs=imgs;
  window._ffProducts=products;
}
function openFfLightbox(i){openLightbox(window._ffImgs,i)}

function openOppLightbox(i,e){e.stopPropagation();openLightbox(window._oppImgs,i)}
function renderOppList(){
  const list=document.getElementById('opp-list');
  if(!list)return;
  const sorted=[...FAMILIES].sort((a,b)=>b.opportunityScore-a.opportunityScore);
  const familyImgMap={};FF_PRODUCTS.forEach(p=>{if(!familyImgMap[p.family])familyImgMap[p.family]=p._img_b64});
  window._oppImgs=sorted.map(ff=>{
    
    return {
      src:familyImgMap[ff.family]||ff._img_b64||'',
      title:ff.family,
      desc:ff.brand+' · '+ff.productCount+'款 · 机会分'+ff.opportunityScore+' · 均价¥'+ff.avgPrice,
      link:ff.sourceUrl||'#'
    };
  });
  list.innerHTML=sorted.map((f,i)=>{
    const img=familyImgMap[f.family]||f._img_b64||'';
    return '<div class="opp-card"><div class="opp-img" onclick="openOppLightbox('+i+',event)">'+(img?'<img src="'+img+'" alt="'+f.family+'">':'<div style="width:100%;height:100%;background:var(--surface)"></div>')+'</div><div class="opp-info"><div class="opp-name"><a href="'+(f.sourceUrl||'#')+'" target="_blank" rel="noopener" class="opp-link" onclick="event.stopPropagation()">'+f.family+'</a></div><div class="opp-meta">'+f.brand+' · '+f.productCount+'款 · '+f.layer+'</div><div class="opp-scores"><span>机会分 <b>'+f.opportunityScore+'</b></span><span>社媒 <b>'+f.socialScore+'</b></span><span>供给 <b>'+f.supplyScore+'</b></span></div></div></div>';
  }).join('');
}

function renderFfCharts(){
  // 鞋型款数vs均价
  disposeChart('chart-ff-family');
  const ch=echarts.init(document.getElementById('chart-ff-family'));
  charts['chart-ff-family']=ch;
  const sorted=[...FAMILIES].sort((a,b)=>b.productCount-a.productCount);
  ch.setOption({
    tooltip:{trigger:'axis',axisPointer:{type:'shadow'}},
    legend:{data:['商品数','均价(¥)'],textStyle:{color:'#8888a0'}},
    grid:{left:180,right:60,top:40,bottom:30},
    xAxis:[
      {type:'value',name:'商品数',position:'bottom',axisLine:{lineStyle:{color:'#2a2a40'}},axisLabel:{color:'#8888a0'},splitLine:{lineStyle:{color:'#1a1a28'}}},
      {type:'value',name:'均价(¥)',position:'top',axisLine:{lineStyle:{color:'#2a2a40'}},axisLabel:{color:'#8888a0'},splitLine:{show:false}}
    ],
    yAxis:{type:'category',data:sorted.map(f=>f.family).reverse(),axisLine:{lineStyle:{color:'#2a2a40'}},axisLabel:{color:'#e8e8f0',fontSize:11}},
    series:[
      {name:'商品数',type:'bar',data:sorted.map(f=>f.productCount).reverse(),xAxisIndex:0,itemStyle:{color:new echarts.graphic.LinearGradient(0,0,1,0,[{offset:0,color:'#a855f7'},{offset:1,color:'#c084fc'}]),borderRadius:[0,4,4,0]}},
      {name:'均价(¥)',type:'line',data:sorted.map(f=>f.avgPrice).reverse(),xAxisIndex:1,itemStyle:{color:'#ffaa00'},lineStyle:{width:2},symbol:'circle',symbolSize:8}
    ]
  });

  // 男女分布
  disposeChart('chart-ff-gender');
  const ch2=echarts.init(document.getElementById('chart-ff-gender'));
  charts['chart-ff-gender']=ch2;
  const men=FF_PRODUCTS.filter(p=>p.market==='men').length;
  const women=FF_PRODUCTS.filter(p=>p.market==='women').length;
  ch2.setOption({
    tooltip:{trigger:'item',formatter:'{b}: {c} 款 ({d}%)'},
    series:[{type:'pie',radius:['50%','75%'],center:['50%','50%'],itemStyle:{borderColor:'#1a1a28',borderWidth:3},label:{color:'#e8e8f0'},
      data:[{value:women,name:'女装',itemStyle:{color:'#ff00aa'}},{value:men,name:'男装',itemStyle:{color:'#00aaff'}}]}]
  });

  // 价格金字塔
  disposeChart('chart-ff-price-pyramid');
  const ch3=echarts.init(document.getElementById('chart-ff-price-pyramid'));
  charts['chart-ff-price-pyramid']=ch3;
  const tiers=[
    {name:'入门 ¥500以下',min:0,max:500},
    {name:'大众 ¥500-1000',min:500,max:1000},
    {name:'轻奢 ¥1000-2000',min:1000,max:2000},
    {name:'中奢 ¥2000-5000',min:2000,max:5000},
    {name:'高奢 ¥5000-10000',min:5000,max:10000},
    {name:'顶奢 ¥10000+',min:10000,max:999999}
  ];
  const tierData=tiers.map(t=>{const count=FF_PRODUCTS.filter(p=>p.price_cny>=t.min&&p.price_cny<t.max).length;return{name:t.name,value:count}}).reverse();
  ch3.setOption({
    tooltip:{trigger:'axis',axisPointer:{type:'shadow'},formatter:p=>p[0].name+'<br/>'+p[0].value+' 款'},
    grid:{left:120,right:40,top:10,bottom:30},
    xAxis:{type:'value',axisLine:{lineStyle:{color:'#2a2a40'}},axisLabel:{color:'#8888a0'},splitLine:{lineStyle:{color:'#1a1a28'}}},
    yAxis:{type:'category',data:tierData.map(t=>t.name),axisLine:{lineStyle:{color:'#2a2a40'}},axisLabel:{color:'#e8e8f0'}},
    series:[{type:'bar',data:tierData.map(t=>t.value),barWidth:'60%',
      itemStyle:{color:new echarts.graphic.LinearGradient(0,0,1,0,[{offset:0,color:'#a855f7'},{offset:1,color:'#f0abfc'}]),borderRadius:[0,4,4,0]},
      label:{show:true,position:'right',color:'#a855f7',fontWeight:600}
    }]
  });

  // 品牌排名
  disposeChart('chart-ff-brands');
  const ch4=echarts.init(document.getElementById('chart-ff-brands'));
  charts['chart-ff-brands']=ch4;
  const brandCounts={};
  FF_PRODUCTS.forEach(p=>{brandCounts[p.brand]=(brandCounts[p.brand]||0)+1});
  const brandSorted=Object.entries(brandCounts).sort((a,b)=>b[1]-a[1]).slice(0,10);
  ch4.setOption({
    tooltip:{trigger:'axis',axisPointer:{type:'shadow'}},
    grid:{left:160,right:20,top:10,bottom:30},
    xAxis:{type:'value',axisLine:{lineStyle:{color:'#2a2a40'}},axisLabel:{color:'#8888a0'},splitLine:{lineStyle:{color:'#1a1a28'}}},
    yAxis:{type:'category',data:brandSorted.map(b=>b[0]).reverse(),axisLine:{lineStyle:{color:'#2a2a40'}},axisLabel:{color:'#e8e8f0'}},
    series:[{type:'bar',data:brandSorted.map(b=>b[1]).reverse(),
      itemStyle:{color:new echarts.graphic.LinearGradient(0,0,1,0,[{offset:0,color:'#a855f7'},{offset:1,color:'#c084fc'}]),borderRadius:[0,4,4,0]},
      label:{show:true,position:'right',color:'#a855f7',fontWeight:600}
    }]
  });
}

// === Instagram ===
let igFilter='all';
function renderIgFilters(){
  const bar=document.getElementById('ig-filters');
  const layers=['all',...new Set(IG_POSTS.map(p=>p['层级']))];
  bar.innerHTML='<div class="filter-btn '+(igFilter==='all'?'active':'')+'" onclick="filterIg(\'all\')">全部 200</div>'+
    layers.filter(l=>l!=='all').map(l=>'<div class="filter-btn '+getLayerClass(l)+' '+(igFilter===l?'active':'')+'" onclick="filterIg(\''+l+'\')">'+getLayerLabel(l)+'</div>').join('');
}
function filterIg(val){igFilter=val;renderIgFilters();renderIgMasonry()}
function renderIgMasonry(){
  const container=document.getElementById('ig-masonry');
  let posts=IG_POSTS;
  if(igFilter!=='all'){posts=posts.filter(p=>p['层级']===igFilter)}
  const imgs=posts.map(p=>({src:p._img,title:p['鞋型'],desc:(p['账号']||'未知账号')+' · '+(p['点赞']||0)+' 赞 · '+(p['评论']||0)+' 评论',link:p['帖子URL']}));
  container.innerHTML=posts.map((p,i)=>{
    const likes=p['点赞']||0;
    const lc=getLayerClass(p['层级']);
    return '<div class="masonry-item" onclick="openIgLightbox('+i+')">'+
      (p._img?'<img src="'+p._img+'" alt="'+p['鞋型']+'" loading="lazy">':'<div style="aspect-ratio:1;background:var(--surface)"></div>')+
      '<div class="card-tag '+lc+'" style="position:absolute;top:6px;left:6px;padding:2px 8px;border-radius:8px;font-size:.65em;background:rgba(0,0,0,0.7);backdrop-filter:blur(4px)">'+getLayerLabel(p['层级'])+'</div>'+
      '<div class="ms-info"><div style="display:flex;justify-content:space-between;align-items:center"><span class="ms-likes">❤ '+fmtNum(likes)+'</span></div><div class="ms-fam" style="margin-top:2px"><a href="'+p['帖子URL']+'" target="_blank" rel="noopener" class="card-link" onclick="event.stopPropagation()">'+p['鞋型']+'</a></div></div></div>';
  }).join('');
  window._igImgs=imgs;
}
function openIgLightbox(i){openLightbox(window._igImgs,i)}

function renderIgCharts(){
  // 平均点赞
  disposeChart('chart-ig-likes');
  const ch=echarts.init(document.getElementById('chart-ig-likes'));
  charts['chart-ig-likes']=ch;
  const likesByFam={};
  IG_POSTS.forEach(p=>{const f=p['鞋型'];if(!likesByFam[f])likesByFam[f]=[];if(p['点赞']&&!isNaN(p['点赞']))likesByFam[f].push(p['点赞'])});
  const avgLikesByFam=Object.entries(likesByFam).map(([f,arr])=>({family:f,avg:arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:0,max:arr.length?Math.max(...arr):0})).sort((a,b)=>b.avg-a.avg).slice(0,10);
  ch.setOption({
    tooltip:{trigger:'axis',axisPointer:{type:'shadow'},formatter:p=>{const d=avgLikesByFam[p[0].dataIndex];return d.family+'<br/>平均点赞: '+d.avg.toFixed(0)+'<br/>最高: '+d.max.toFixed(0)}},
    grid:{left:180,right:40,top:20,bottom:30},
    xAxis:{type:'value',axisLine:{lineStyle:{color:'#2a2a40'}},axisLabel:{color:'#8888a0',formatter:v=>fmtNum(v)},splitLine:{lineStyle:{color:'#1a1a28'}}},
    yAxis:{type:'category',inverse:true,data:avgLikesByFam.map(l=>l.family),axisLine:{lineStyle:{color:'#2a2a40'}},axisLabel:{color:'#e8e8f0',fontSize:11}},
    series:[{type:'bar',data:avgLikesByFam.map(l=>l.avg),
      itemStyle:{color:new echarts.graphic.LinearGradient(0,0,1,0,[{offset:0,color:'#ff4757'},{offset:1,color:'#ff6b81'}]),borderRadius:[0,4,4,0]},
      label:{show:true,position:'right',color:'#ff4757',fontWeight:600,formatter:p=>fmtNum(Math.round(p.value))}
    }]
  });

  // 箱线图
  disposeChart('chart-ig-box');
  const ch2=echarts.init(document.getElementById('chart-ig-box'));
  charts['chart-ig-box']=ch2;
  const boxData=Object.entries(likesByFam).sort((a,b)=>{
    const aMed=a[1].slice().sort((x,y)=>x-y)[Math.floor(a[1].length/2)]||0;
    const bMed=b[1].slice().sort((x,y)=>x-y)[Math.floor(b[1].length/2)]||0;
    return bMed-aMed;
  }).slice(0,6);
  ch2.setOption({
    tooltip:{trigger:'item'},
    grid:{left:140,right:20,top:20,bottom:30},
    xAxis:{type:'value',axisLine:{lineStyle:{color:'#2a2a40'}},axisLabel:{color:'#8888a0'},splitLine:{lineStyle:{color:'#1a1a28'}}},
    yAxis:{type:'category',data:boxData.map(b=>b[0]),axisLine:{lineStyle:{color:'#2a2a40'}},axisLabel:{color:'#e8e8f0',fontSize:10}},
    series:[{type:'boxplot',data:boxData.map(b=>b[1]),itemStyle:{color:'rgba(255,71,87,0.3)',borderColor:'#ff4757',borderWidth:2}}]
  });

  // 三层分类社媒热度对比
  disposeChart('chart-ig-layer');
  const ch3=echarts.init(document.getElementById('chart-ig-layer'));
  charts['chart-ig-layer']=ch3;
  const layerStats={};
  IG_POSTS.forEach(p=>{
    const l=p['层级'];
    if(!layerStats[l])layerStats[l]={count:0,totalLikes:0,maxLikes:0};
    const likes=p['点赞']||0;
    layerStats[l].count++;
    layerStats[l].totalLikes+=likes;
    layerStats[l].maxLikes=Math.max(layerStats[l].maxLikes,likes);
  });
  const layerNames=Object.keys(layerStats);
  const layerAvgLikes=layerNames.map(l=>layerStats[l].count?layerStats[l].totalLikes/layerStats[l].count:0);
  ch3.setOption({
    tooltip:{trigger:'axis',axisPointer:{type:'shadow'},formatter:p=>{
      const l=layerNames[p[0].dataIndex];
      const s=layerStats[l];
      return getLayerLabel(l)+'<br/>帖子数: '+s.count+'<br/>平均点赞: '+s.totalLikes/s.count.toFixed(0)+'<br/>最高点赞: '+s.maxLikes.toFixed(0);
    }},
    legend:{data:['帖子数','平均点赞'],textStyle:{color:'#8888a0'}},
    grid:{left:60,right:60,top:40,bottom:30},
    xAxis:{type:'category',data:layerNames.map(l=>getLayerLabel(l)),axisLine:{lineStyle:{color:'#2a2a40'}},axisLabel:{color:'#8888a0'}},
    yAxis:[
      {type:'value',name:'帖子数',position:'left',axisLine:{lineStyle:{color:'#ff4757'}},axisLabel:{color:'#8888a0'},splitLine:{lineStyle:{color:'#1a1a28'}}},
      {type:'value',name:'平均点赞',position:'right',axisLine:{lineStyle:{color:'#ffaa00'}},axisLabel:{color:'#8888a0',formatter:v=>fmtNum(v)},splitLine:{show:false}}
    ],
    series:[
      {name:'帖子数',type:'bar',data:layerNames.map(l=>layerStats[l].count),barWidth:'35%',
        itemStyle:{color:new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:'#ff4757'},{offset:1,color:'rgba(255,71,87,0.3)'}]),borderRadius:[4,4,0,0]}},
      {name:'平均点赞',type:'line',yAxisIndex:1,data:layerAvgLikes,smooth:true,
        itemStyle:{color:'#ffaa00'},lineStyle:{width:3},symbol:'circle',symbolSize:10,
        areaStyle:{color:'rgba(255,170,0,0.1)'}}
    ]
  });

  // 高赞帖 Top 10 账号
  disposeChart('chart-ig-accounts');
  const ch4=echarts.init(document.getElementById('chart-ig-accounts'));
  charts['chart-ig-accounts']=ch4;
  const accStats={};
  IG_POSTS.forEach(p=>{
    const a=p['账号']||'unknown';
    const likes=p['点赞']||0;
    if(!accStats[a])accStats[a]={count:0,totalLikes:0,maxLikes:0,shoes:new Set()};
    accStats[a].count++;
    accStats[a].totalLikes+=likes;
    accStats[a].maxLikes=Math.max(accStats[a].maxLikes,likes);
    accStats[a].shoes.add(p['鞋型']);
  });
  const topAccs=Object.entries(accStats)
    .map(([a,s])=>({account:a,count:s.count,avgLikes:s.totalLikes/s.count,maxLikes:s.maxLikes,shoes:s.shoes.size}))
    .sort((a,b)=>b.avgLikes-a.avgLikes)
    .slice(0,10);
  ch4.setOption({
    tooltip:{trigger:'axis',axisPointer:{type:'shadow'},formatter:p=>{
      const a=topAccs[p[0].dataIndex];
      return '@'+a.account+'<br/>平均点赞: '+a.avgLikes.toFixed(0)+'<br/>最高点赞: '+a.maxLikes.toFixed(0)+'<br/>帖子数: '+a.count+'<br/>涉及鞋型: '+a.shoes+' 款';
    }},
    grid:{left:120,right:60,top:20,bottom:30},
    xAxis:[
      {type:'value',name:'平均点赞',axisLine:{lineStyle:{color:'#2a2a40'}},axisLabel:{color:'#8888a0',formatter:v=>fmtNum(v)},splitLine:{lineStyle:{color:'#1a1a28'}}}
    ],
    yAxis:{type:'category',inverse:true,data:topAccs.map(a=>'@'+a.account),axisLine:{lineStyle:{color:'#2a2a40'}},axisLabel:{color:'#e8e8f0',fontSize:11}},
    series:[
      {type:'bar',data:topAccs.map(a=>a.avgLikes),
        itemStyle:{color:new echarts.graphic.LinearGradient(0,0,1,0,[{offset:0,color:'#ff4757'},{offset:1,color:'#ff6b81'}]),borderRadius:[0,4,4,0]},
        label:{show:true,position:'right',color:'#ff4757',fontWeight:600,formatter:p=>fmtNum(topAccs[p.dataIndex].maxLikes)+' 最高'}
      }
    ]
  });
}

// 初始化
document.addEventListener('DOMContentLoaded',()=>{
  renderOverviewCharts();
  renderDewuFilters();
  renderDewuGrid();
  renderOppList();
  renderFfFilters();
  renderFfGrid();
  renderIgFilters();
  renderIgMasonry();
});
window.addEventListener('resize',()=>{Object.values(charts).forEach(c=>c.resize())});
