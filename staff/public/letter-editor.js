import {cleanDocument,plainDocument,documentHtml,documentText,para} from './letter-content.js';

// Never insert pasted HTML. Read it in an inert document, retain only our model,
// then rebuild escaped HTML. The server independently validates the same model.
export function readEditor(root){
 const forbidden=new Set(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','IMG','SVG','MATH','LINK','META','INPUT','BUTTON','TEXTAREA']);
 const css=(el,key)=>(el.getAttribute?.('style')||'').split(';').map(part=>{const at=part.indexOf(':');return [part.slice(0,at).trim().toLowerCase(),part.slice(at+1).trim().replace(/\s*!important\s*$/i,'')];}).filter(([name])=>name===key).at(-1)?.[1]||'';
 const points=value=>{const n=parseFloat(value)||0;return n*(String(value).endsWith('pt')?1:String(value).endsWith('in')?72:String(value).endsWith('cm')?72/2.54:String(value).endsWith('mm')?72/25.4:.75);};
 const props=(el,parent={})=>({align:el.dataset?.align||el.getAttribute?.('align')||css(el,'text-align').toLowerCase()||parent.align||'left',indent:el.dataset?.indent!==undefined?Number(el.dataset.indent):css(el,'margin-left')?Math.round(points(css(el,'margin-left'))/18):parent.indent||0,space:el.dataset?.space!==undefined?Number(el.dataset.space):css(el,'margin-bottom')?Math.min(18,Math.round(points(css(el,'margin-bottom'))/6)*6):parent.space??6});
 function runs(node,marks={}){if(node.nodeType===3)return [{text:node.textContent,...marks}];if(node.nodeType!==1||forbidden.has(node.tagName))return [];if(node.tagName==='BR')return [{text:'\n',...marks}];
  const weight=css(node,'font-weight').toLowerCase(),slant=css(node,'font-style').toLowerCase(),bold=weight?/^(bold|bolder|[6-9]00)$/.test(weight):marks.bold||['B','STRONG'].includes(node.tagName),italic=slant?slant==='italic'||slant==='oblique':marks.italic||['I','EM'].includes(node.tagName),underline=marks.underline||node.tagName==='U'||css(node,'text-decoration').toLowerCase().includes('underline');
  return [...node.childNodes].flatMap(n=>runs(n,{...(bold?{bold:true}:{}),...(italic?{italic:true}:{}),...(underline?{underline:true}:{})}));
 }
 function p(el,attr={}){const r=[];for(const item of runs(el)){const prev=r.at(-1);if(prev&&!!prev.bold===!!item.bold&&!!prev.italic===!!item.italic&&!!prev.underline===!!item.underline)prev.text+=item.text;else r.push({...item});}if(r.length===1&&r[0].text==='\n')r[0].text='';return {...para('',props(el.tagName==='LI'?(el.querySelector(':scope > p')||el):el,attr)),runs:r};}
 function blocks(parent,attr={}){const out=[];let inline=[];
  const flush=()=>{if(inline.length){out.push({...para('',attr),runs:inline});inline=[];}};
  for(const n of parent.childNodes){if(n.nodeType===3){if(n.textContent.trim()||inline.length)inline.push(...runs(n));continue;}if(n.nodeType!==1||forbidden.has(n.tagName))continue;
   if(n.tagName==='TABLE'){flush();const trs=[...n.querySelectorAll('tr')].filter(r=>r.closest('table')===n),cells=r=>[...r.children].filter(c=>c.tagName==='TD'||c.tagName==='TH'),rows=trs.map(r=>cells(r).map(c=>{const child=blocks(c);return child.filter(b=>b.type==='paragraph').length?child.filter(b=>b.type==='paragraph'):[p(c)];}));if(rows.length){let widths=[...n.querySelectorAll(':scope > colgroup > col')].map(c=>parseFloat(c.getAttribute('width')));if(!widths.length)widths=cells(trs[0]).map(c=>parseFloat(c.getAttribute('width')||css(c,'width')));if(widths.every(w=>Number.isFinite(w)&&w>0)){const total=widths.reduce((a,w)=>a+w,0);widths=widths.map(w=>w/total*100);}out.push({type:'table',border:n.dataset.border==='none'||n.getAttribute('border')==='0'||(css(n,'border-style')==='none'||/\bnone\b/.test(css(n,'border')))?'none':'grid',...(widths.length===rows[0].length?{widths}:{}),rows});}continue;}
   if(['OL','UL'].includes(n.tagName)){flush();const items=[...n.children].filter(c=>c.tagName==='LI').map(c=>p(c,props(n,attr)));if(items.length)out.push({type:'list',ordered:n.tagName==='OL',start:Number(n.getAttribute('start'))||1,items});continue;}
   if(/^(P|DIV|H[1-6]|BLOCKQUOTE|LI)$/.test(n.tagName)){flush();if([...n.children].some(c=>/^(P|DIV|TABLE|OL|UL)$/.test(c.tagName))){out.push(...blocks(n,props(n,attr)));continue;}
    const item=p(n,attr),mso=/mso-list\s*:/i.test(n.getAttribute('style')||'');const text=item.runs.map(r=>r.text).join(''),prefix=mso&&text.match(/^\s*(\d+[.)]|[\u2022\u00b7\uf0b7])\s+/);
    if(mso){let remove=prefix?.[0].length||0;item.runs=item.runs.map(r=>{const count=Math.min(remove,r.text.length);remove-=count;return {...r,text:r.text.slice(count)};});const ordered=!prefix||/\d/.test(prefix[1]),last=out.at(-1);if(last?.type==='list'&&last.ordered===ordered)last.items.push(item);else out.push({type:'list',ordered,start:ordered?(parseInt(prefix?.[1],10)||1):1,items:[item]});}else out.push(item);continue;
   }inline.push(...runs(n));
  }flush();return out;
 }
 return cleanDocument({version:1,blocks:blocks(root)});
}

export class LetterEditor{
 constructor(root,toolbar,onChange){this.root=root;this.toolbar=toolbar;this.onChange=onChange;this.history=[];this.index=-1;this.range=null;this.disabled=false;
  root.addEventListener('input',()=>this.commit());root.addEventListener('keyup',()=>this.remember());root.addEventListener('mouseup',()=>this.remember());root.addEventListener('touchend',()=>this.remember());
  document.addEventListener('selectionchange',()=>this.remember());
  root.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();this.undo(e.shiftKey?1:-1);}else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();this.undo(1);}else if((e.ctrlKey||e.metaKey)&&['b','i','u'].includes(e.key.toLowerCase())){e.preventDefault();this.command({b:'bold',i:'italic',u:'underline'}[e.key.toLowerCase()]);}else if(e.key==='Tab'&&this.cell()){e.preventDefault();const cells=[...this.cell().closest('table').querySelectorAll('td')],i=cells.indexOf(this.cell()),next=cells[i+(e.shiftKey?-1:1)];if(next)this.caret(next);else{const table=this.cell().closest('table');let target=e.shiftKey?table.previousElementSibling:table.nextElementSibling;if(!target){target=document.createElement('p');target.append(document.createElement('br'));if(e.shiftKey)table.before(target);else table.after(target);this.commit();}this.caret(target);}}});
  root.addEventListener('paste',e=>{e.preventDefault();if(this.disabled)return;try{const html=e.clipboardData.getData('text/html'),text=e.clipboardData.getData('text/plain');if((html||text).length>100000)throw Error('Tempelan terlalu panjang.');const doc=html?readEditor(new DOMParser().parseFromString(html,'text/html').body):plainDocument(text);this.insert(documentHtml(doc));this.status('Tempelan Word dibersihkan; hanya format yang didukung dipertahankan.');}catch(error){this.status(error.message);}});
  root.addEventListener('drop',e=>e.preventDefault());
  toolbar.addEventListener('pointerdown',e=>{if(e.target.closest('button'))e.preventDefault();});
  toolbar.addEventListener('click',e=>{const button=e.target.closest('button[data-command]');if(button&&!this.disabled)this.command(button.dataset.command);});
  toolbar.addEventListener('change',e=>{if(e.target.dataset.command&&!this.disabled)this.command(e.target.dataset.command,e.target.value);});
 }
 status(text){document.querySelector('#body-editor-status').textContent=text;}
 remember(){const s=getSelection();if(s.rangeCount&&this.root.contains(s.anchorNode)&&this.root.contains(s.focusNode)){this.range=s.getRangeAt(0).cloneRange();for(const command of ['bold','italic','underline'])this.toolbar.querySelector('[data-command='+command+']')?.setAttribute('aria-pressed',String(document.queryCommandState(command)));}}
 restore(){this.root.focus();const s=getSelection();s.removeAllRanges();if(this.range&&this.root.contains(this.range.startContainer))s.addRange(this.range);else{const r=document.createRange();r.selectNodeContents(this.root);r.collapse(false);s.addRange(r);}}
 caret(el){const r=document.createRange();r.selectNodeContents(el);r.collapse(true);getSelection().removeAllRanges();getSelection().addRange(r);this.range=r;el.focus?.();this.root.focus();}
 set(value,disabled=false){this.disabled=disabled;this.root.contentEditable=String(!disabled);this.root.setAttribute('aria-readonly',String(disabled));this.toolbar.querySelectorAll('button,select,input').forEach(e=>e.disabled=disabled);this.root.innerHTML=documentHtml(value);if(!this.root.innerHTML)this.root.innerHTML='<p><br></p>';this.history=[JSON.stringify(this.get())];this.index=0;this.range=null;}
 get(){return readEditor(this.root);}
 text(){return documentText(this.get());}
 commit(){try{const snapshot=JSON.stringify(this.get());if(snapshot!==this.history[this.index]){this.history.splice(this.index+1);this.history.push(snapshot);if(this.history.length>100)this.history.shift();this.index=this.history.length-1;}this.remember();this.onChange();this.status('');}catch(e){this.status(e.message);}}
 undo(delta){const i=this.index+delta;if(i<0||i>=this.history.length)return;this.index=i;this.root.innerHTML=documentHtml(JSON.parse(this.history[i]));this.range=null;this.restore();this.onChange();}
 cell(){const s=getSelection(),node=s.anchorNode?.nodeType===1?s.anchorNode:s.anchorNode?.parentElement;const cell=node?.closest('td,th');return cell&&this.root.contains(cell)?cell:null;}
 paragraphs(){const selection=getSelection(),range=selection.rangeCount?selection.getRangeAt(0):null;if(!range)return [];
  let found=[...this.root.querySelectorAll('p,li')].filter(p=>range.intersectsNode(p));if(!found.length){document.execCommand('formatBlock',false,'p');found=[...this.root.querySelectorAll('p,li')].filter(p=>getSelection().getRangeAt(0).intersectsNode(p));}return found;}
 insert(html){this.restore();document.execCommand('insertHTML',false,html);this.commit();}
 command(command,value){if(this.disabled)return;if(command==='undo'||command==='redo'){this.undo(command==='undo'?-1:1);return;}this.restore();
  if(['bold','italic','underline','insertOrderedList','insertUnorderedList'].includes(command)){document.execCommand('styleWithCSS',false,false);document.execCommand(command,false,null);}
  else if(['left','center','right','justify'].includes(command))this.paragraphs().forEach(p=>{p.removeAttribute('style');p.dataset.align=command;});
  else if(command==='indent'||command==='outdent')this.paragraphs().forEach(p=>p.dataset.indent=Math.max(0,Math.min(4,Number(p.dataset.indent||0)+(command==='indent'?1:-1))));
  else if(command==='space')this.paragraphs().forEach(p=>p.dataset.space=value);
  else if(command==='table'){const rows=Math.max(1,Math.min(20,Math.floor(Number(document.querySelector('#table-rows').value)||3))),cols=Math.max(2,Math.min(6,Math.floor(Number(document.querySelector('#table-cols').value)||3)));document.querySelector('#table-rows').value=String(rows);document.querySelector('#table-cols').value=String(cols);const border=document.querySelector('#table-border').value;const table={type:'table',border,widths:Array(cols).fill(100/cols),rows:Array.from({length:rows},()=>Array.from({length:cols},()=>[para('',{space:0})]))};this.insert(documentHtml({version:1,blocks:[table,para('')]}));return;}
  else if(command==='borders'){const table=this.cell()?.closest('table');if(table)table.dataset.border=document.querySelector('#table-border').value;}
  else if(command==='addRow'){const cell=this.cell();if(cell){if(cell.closest('table').rows.length>=40){this.status('Tabel maksimal 40 baris.');return;}const row=cell.parentElement.cloneNode(true);row.querySelectorAll('td,th').forEach(c=>c.innerHTML='<p><br></p>');cell.parentElement.after(row);this.caret(row.cells[0]);}}
  else if(command==='deleteRow'){const cell=this.cell();if(cell){const table=cell.closest('table');if(table.rows.length>1)cell.parentElement.remove();else table.replaceWith(document.createElement('p'));this.range=null;}}
  else if(command==='deleteTable'){const table=this.cell()?.closest('table');if(table){const p=document.createElement('p');p.append(document.createElement('br'));table.replaceWith(p);this.caret(p);}}
  this.commit();
 }
}
