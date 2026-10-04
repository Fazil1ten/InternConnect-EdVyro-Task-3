const $ = s => document.querySelector(s);
const cards = $('#cards'), search = $('#search'), domain = $('#domain'), mode = $('#mode'), locationEl = $('#location'), sort = $('#sort');
const count = $('#count'), empty = $('#empty'), error = $('#error'), loading = $('#loading');
const modal = $('#detailsModal'), modalContent = $('#modalContent'), modalClose = $('#modalClose');
const savedKey = 'internconnect-saved';
let internships = [];
let activeId = null;
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const getSaved = () => JSON.parse(localStorage.getItem(savedKey) || '[]');
const setSaved = a => localStorage.setItem(savedKey, JSON.stringify(a));

function card(x){
  const saved = getSaved().includes(String(x.id));
  return `<article class="card"><div class="card-top"><span class="badge">${esc(x.domain)}</span><button class="save ${saved?'saved':''}" type="button" data-save="${esc(x.id)}" aria-label="${saved?'Unsave':'Save'} ${esc(x.title)}" aria-pressed="${saved}" title="${saved?'Unsave internship':'Save internship'}">${saved?'♥':'♡'}</button></div>
  <div class="company-row"><span class="company-logo small">${esc(x.company.slice(0,2).toUpperCase())}</span><span>${esc(x.company)}</span></div><h3>${esc(x.title)}</h3><p class="desc">${esc(x.description)}</p>
  <div class="meta"><span>📍 ${esc(x.location)}</span><span>● ${esc(x.mode)}</span></div><div class="pay"><strong>₹${Number(x.stipend).toLocaleString('en-IN')}</strong><span>/ month</span><span class="duration">${esc(x.duration)} months</span></div>
  <div class="skills">${x.skills.map(s=>`<span>${esc(s)}</span>`).join('')}</div><button class="apply primary-btn" type="button" data-details="${esc(x.id)}">View details</button></article>`;
}

function fillSelect(select, values, label){
  const current=select.value;
  select.innerHTML=`<option value="all">All ${label}</option>`+values.sort().map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
  if(values.includes(current)) select.value=current;
}
function populateFilters(){
  fillSelect(domain,[...new Set(internships.map(x=>x.domain))],'domains');
  fillSelect(mode,[...new Set(internships.map(x=>x.mode))],'modes');
  fillSelect(locationEl,[...new Set(internships.map(x=>x.location))],'locations');
}
function filteredLocal(){
  const q=search.value.trim().toLowerCase();
  let a=internships.filter(x=>(domain.value==='all'||x.domain===domain.value)&&(mode.value==='all'||x.mode===mode.value)&&(locationEl.value==='all'||x.location===locationEl.value)&&(!q||[x.title,x.company,x.domain,x.location,x.mode,x.description,...x.skills].join(' ').toLowerCase().includes(q)));
  if(sort.value==='stipend') a.sort((a,b)=>b.stipend-a.stipend);
  if(sort.value==='duration') a.sort((a,b)=>a.duration-b.duration);
  return a;
}
function render(){
  const a=filteredLocal(); cards.innerHTML=a.map(card).join(''); empty.hidden=a.length>0; count.textContent=`${a.length} ${a.length===1?'opportunity':'opportunities'} found`;
}
async function loadInternships(){
  loading.hidden=false; error.hidden=true; cards.innerHTML=''; empty.hidden=true;
  try{
    const r=await fetch('/api/internships?limit=50');
    if(!r.ok) throw new Error('API request failed');
    const body=await r.json();
    if(body.status!=='success'||!Array.isArray(body.data)) throw new Error('Unexpected API response');
    internships=body.data; populateFilters(); render();
  }catch(e){ console.error(e); error.hidden=false; count.textContent=''; }
  finally{ loading.hidden=true; }
}
function toggleSave(id){
  const saved=getSaved(), sid=String(id); const next=saved.includes(sid)?saved.filter(x=>x!==sid):[...saved,sid]; setSaved(next); render();
}
function detailsMarkup(x){
  const saved=getSaved().includes(String(x.id));
  return `<div class="modal-top"><span class="modal-logo">${esc(x.company.slice(0,2).toUpperCase())}</span><div><strong>${esc(x.company)}</strong><div class="modal-company">${esc(x.domain)}</div></div></div>
  <h2 id="modalTitle">${esc(x.title)}</h2><p class="modal-description">${esc(x.description)}</p>
  <div class="modal-meta"><div><strong>LOCATION</strong>${esc(x.location)}</div><div><strong>WORK MODE</strong>${esc(x.mode)}</div><div><strong>STIPEND</strong>₹${Number(x.stipend).toLocaleString('en-IN')} / month</div><div><strong>DURATION</strong>${esc(x.duration)} months</div><div><strong>OPENINGS</strong>${esc(x.openings)}</div></div>
  <strong>Skills you'll use</strong><div class="modal-skills">${x.skills.map(s=>`<span>${esc(s)}</span>`).join('')}</div>
  <div class="modal-actions"><button class="secondary-btn" type="button" data-modal-save="${esc(x.id)}">${saved?'♥ Saved':'♡ Save internship'}</button><button class="primary-btn" type="button" data-apply="${esc(x.id)}">Apply now →</button></div>`;
}
function openDetails(id){
  const x=internships.find(i=>String(i.id)===String(id)); if(!x)return; activeId=x.id; modalContent.innerHTML=detailsMarkup(x); modal.hidden=false; document.body.style.overflow='hidden'; modalClose.focus();
}
function openApplication(id){
  const x=internships.find(i=>String(i.id)===String(id)); if(!x)return; activeId=x.id;
  modalContent.innerHTML=`<div class="modal-top"><span class="modal-logo">${esc(x.company.slice(0,2).toUpperCase())}</span><div><strong>Apply to ${esc(x.title)}</strong><div class="modal-company">${esc(x.company)}</div></div></div>
  <form id="applicationForm" novalidate><p class="modal-description">Submit a short application. Your email is used only for this demo submission.</p>
  <label for="appName">Full name</label><input id="appName" name="name" required autocomplete="name" placeholder="Your full name">
  <label for="appEmail">Email address</label><input id="appEmail" name="email" type="email" required autocomplete="email" placeholder="you@example.com">
  <label for="appPortfolio">Portfolio URL <span>(optional)</span></label><input id="appPortfolio" name="portfolio" type="url" placeholder="https://example.com">
  <p id="formMessage" class="form-message" role="status" aria-live="polite"></p>
  <div class="modal-actions"><button class="secondary-btn" type="button" id="backToDetails">Back</button><button class="primary-btn" type="submit">Submit application</button></div></form>`;
  $('#backToDetails').onclick=()=>openDetails(id); $('#appName').focus(); $('#applicationForm').onsubmit=e=>submitApplication(e,x.id);
}
async function submitApplication(e,id){
  e.preventDefault(); const form=e.currentTarget, msg=$('#formMessage'); msg.textContent='Submitting…';
  const body=Object.fromEntries(new FormData(form).entries()); body.internshipId=String(id);
  try{ const r=await fetch('/api/applications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}); const result=await r.json();
    if(!r.ok||result.status!=='success') throw new Error(result.error?.message||'Could not submit application.');
    msg.textContent='Application submitted successfully.'; form.querySelector('button[type="submit"]').disabled=true;
  }catch(err){ msg.textContent=err.message; }
}
function closeModal(){modal.hidden=true;document.body.style.overflow='';activeId=null;}

[domain,mode,locationEl,sort].forEach(e=>e.addEventListener('change',render));
search.addEventListener('input',render); $('#searchBtn').onclick=render;
document.querySelectorAll('.quick-tags button').forEach(b=>b.onclick=()=>{search.value=b.dataset.query;render();$('#internships').scrollIntoView({behavior:'smooth'});});
$('#clearAll').onclick=()=>{search.value='';domain.value='all';mode.value='all';locationEl.value='all';sort.value='new';render();};
$('#resetEmpty').onclick=$('#clearAll').onclick; $('#retry').onclick=loadInternships;
$('#menuBtn').onclick=()=>{const n=$('#main-nav'),open=n.classList.toggle('open');$('#menuBtn').setAttribute('aria-expanded',open);};
$('#themeBtn').onclick=()=>{document.body.classList.toggle('dark');localStorage.setItem('internconnect-theme',document.body.classList.contains('dark')?'dark':'light');};
if(localStorage.getItem('internconnect-theme')==='dark')document.body.classList.add('dark');
cards.addEventListener('click',e=>{const save=e.target.closest('[data-save]'),details=e.target.closest('[data-details]');if(save)toggleSave(save.dataset.save);else if(details)openDetails(details.dataset.details);});
modal.addEventListener('click',e=>{if(e.target===modal)closeModal();const save=e.target.closest('[data-modal-save]'),apply=e.target.closest('[data-apply]');if(save){toggleSave(save.dataset.modalSave);openDetails(save.dataset.modalSave);}if(apply)openApplication(apply.dataset.apply);});
modalClose.onclick=closeModal;
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.hidden)closeModal();});
loadInternships();
