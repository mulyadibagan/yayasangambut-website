// Published article pairs only: no third-party translation request or selection
// telemetry. Template content is inert, so alternate images are never loaded.
export const blockSelector='p,h2,h3,h4,li,figcaption,td,th';
export function textOf(block){const copy=block.cloneNode(true);copy.querySelectorAll('.reader-paragraph,script,style').forEach(e=>e.remove());return copy.textContent.trim();}
export function readingBlocks(root){return [...root.querySelectorAll(blockSelector)].filter(e=>!e.querySelector(blockSelector)&&textOf(e));}
export function alignBlocks(source,target,sourceLanguage='id',targetLanguage='en'){
  // Translation keeps semantic block structure. If an edition has been reworked,
  // never guess a counterpart by paragraph number alone.
  if(source.length!==target.length)return null;
  const numbers=(text,language)=>(text.match(/\d+(?:[.,]\d+)*/g)||[]).map(value=>{
    // Grouping and decimal separators differ between the two published editions.
    const normalized=language==='id'?value.replace(/\./g,'').replace(',','.'):value.replace(/,/g,'');
    const [integer,fraction='']=normalized.split('.');
    const whole=integer.replace(/^0+(?=\d)/,'');
    const decimal=fraction.replace(/0+$/,'');
    return decimal?whole+'.'+decimal:whole;
  }).sort().join('|');
  if(source.some((e,i)=>e.tagName!==target[i].tagName||numbers(textOf(e),sourceLanguage)!==numbers(textOf(target[i]),targetLanguage)))return null;
  return source.map((e,i)=>({source:textOf(e),target:textOf(target[i])}));
}
function initReader(reader){
  if(reader.dataset.ready)return;reader.dataset.ready='true';
  const body=reader.querySelector('[data-reader-content]'),template=reader.querySelector('[data-reader-alternate]');
  const blocks=readingBlocks(body),targets=readingBlocks(template.content),pairs=alignBlocks(blocks,targets,reader.dataset.language,reader.dataset.target);
  const guide=reader.querySelector('.reader-guide');
  if(!pairs){guide.querySelector('span').textContent=reader.dataset.language==='id'?'Baca artikel ini dalam bahasa Inggris melalui tautan berikut.':'Read this article in Indonesian using the link below.';return;}
  const dialog=reader.querySelector('[data-reader-dialog]'),popup=reader.querySelector('[data-reader-selection]');
  let selected=[],anchor=null,timer;
  function open(indices,trigger){
    for(const [key,field] of [['source','[data-reader-source]'],['target','[data-reader-target]']]){
      const root=dialog.querySelector(field);root.replaceChildren();
      for(const i of indices){const p=document.createElement('p');p.textContent=pairs[i][key];root.append(p);}
    }
    popup.hidden=true;anchor=trigger;dialog.showModal();
  }
  blocks.forEach((block,i)=>{
    block.classList.add('reader-block');
    const button=document.createElement('button');button.type='button';button.className='reader-paragraph';button.textContent=reader.dataset.target.toUpperCase();
    button.setAttribute('aria-label',(reader.dataset.language==='id'?'Lihat bahasa Inggris untuk paragraf ini':'View this paragraph in Indonesian'));button.setAttribute('aria-haspopup','dialog');
    button.addEventListener('click',()=>open([i],button));block.append(button);
  });
  function selectionChanged(){
    if(dialog.open)return;
    const selection=window.getSelection();
    if(!selection||selection.isCollapsed||!selection.rangeCount||!selection.toString().trim()){popup.hidden=true;return;}
    const range=selection.getRangeAt(0);
    if(!body.contains(range.startContainer)||!body.contains(range.endContainer)){popup.hidden=true;return;}
    selected=blocks.flatMap((block,i)=>range.intersectsNode(block)?[i]:[]);
    if(!selected.length){popup.hidden=true;return;}
    const rect=range.getBoundingClientRect();popup.hidden=false;
    const width=popup.offsetWidth,height=popup.offsetHeight;
    popup.style.left=Math.max(12,Math.min(innerWidth-width-12,rect.left))+'px';
    popup.style.top=Math.max(12,Math.min(innerHeight-height-12,rect.bottom+8))+'px';
  }
  document.addEventListener('selectionchange',()=>{clearTimeout(timer);timer=setTimeout(selectionChanged,80);});
  popup.addEventListener('pointerdown',e=>e.preventDefault());popup.addEventListener('click',()=>{if(selected.length)open(selected,popup);});
  reader.querySelector('[data-reader-close]').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',e=>{const r=dialog.getBoundingClientRect();if(e.target===dialog&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))dialog.close();});
  dialog.addEventListener('close',()=>{window.getSelection()?.removeAllRanges();if(anchor&&anchor!==popup)anchor.focus();});
  window.addEventListener('scroll',()=>popup.hidden=true,{passive:true});window.addEventListener('resize',()=>popup.hidden=true,{passive:true});
}
if(typeof document!=='undefined')document.querySelectorAll('[data-bilingual-reader]').forEach(initReader);
