const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const crypto = require('crypto');
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const seed = JSON.parse(fs.readFileSync(path.join(ROOT, 'seed.json'), 'utf8'));
const applications = new Map();

const MIME = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
const send = (res, status, payload, headers={}) => { res.writeHead(status, {'Content-Type':'application/json; charset=utf-8', ...headers}); res.end(JSON.stringify(payload)); return true; };
const ok = (data, pagination={}) => ({status:'success', data, pagination});
const fail = (message, code='BAD_REQUEST') => ({status:'error', error:{code,message}});
const readBody = req => new Promise((resolve,reject)=>{ let body=''; req.on('data', c=>{ body += c; if(body.length > 100000) req.destroy(); }); req.on('end',()=>{ try{resolve(body ? JSON.parse(body) : {});}catch(e){reject(new Error('Invalid JSON body.'));} }); req.on('error',reject); });
const isSafeUrl = value => { try { const u = new URL(value); return ['http:','https:'].includes(u.protocol) && !/^(javascript|data|file):/i.test(value); } catch { return false; } };

function handleApi(req,res,url){
  if(req.method === 'GET' && url.pathname === '/api/internships'){
    const q=(url.searchParams.get('q')||'').trim().toLowerCase();
    const domain=url.searchParams.get('domain')||'all'; const mode=url.searchParams.get('mode')||'all'; const location=url.searchParams.get('location')||'all';
    const sort=url.searchParams.get('sort')||'recommended';
    const page=Math.max(1, Number(url.searchParams.get('page')||1)); const limit=Math.min(50,Math.max(1,Number(url.searchParams.get('limit')||10)));
    let rows=seed.internships.filter(x => (domain==='all'||x.domain===domain)&&(mode==='all'||x.mode===mode)&&(location==='all'||x.location===location)&&(!q||JSON.stringify(x).toLowerCase().includes(q)));
    if(sort==='stipend') rows.sort((a,b)=>b.stipend-a.stipend); if(sort==='duration') rows.sort((a,b)=>a.duration-b.duration);
    const total=rows.length, start=(page-1)*limit;
    return send(res,200,ok(rows.slice(start,start+limit),{page,limit,total,totalPages:Math.max(1,Math.ceil(total/limit))}));
  }
  if(req.method === 'POST' && url.pathname === '/api/applications'){
    readBody(req).then(body=>{
      const name=String(body.name||'').trim(); const email=String(body.email||'').trim().toLowerCase(); const portfolio=String(body.portfolio||'').trim(); const internshipId=String(body.internshipId||'').trim();
      if(!name) return send(res,400,fail('Name is required.','NAME_REQUIRED'));
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return send(res,400,fail('Enter a valid email address.','INVALID_EMAIL'));
      if(portfolio && !isSafeUrl(portfolio)) return send(res,400,fail('Portfolio URL must use http or https.','UNSAFE_URL'));
      if(!seed.internships.some(x=>x.id===internshipId)) return send(res,404,fail('Internship not found.','INTERNSHIP_NOT_FOUND'));
      const key=`${internshipId}:${email}`;
      if(applications.has(key)) return send(res,409,fail('You have already applied to this internship.','DUPLICATE_APPLICATION'));
      const record={id:crypto.randomUUID(),internshipId,name,email,portfolio:portfolio||null,createdAt:new Date().toISOString()};
      applications.set(key,record);
      // Never log applicant email, name, portfolio, or other personal data.
      return send(res,201,ok({applicationId:record.id,internshipId:record.internshipId}));
    }).catch(()=>send(res,400,fail('Invalid JSON body.','INVALID_JSON')));
    return true;
  }
  return false;
}

const server=http.createServer((req,res)=>{
  const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);
  if(url.pathname.startsWith('/api/')) return handleApi(req,res,url) || send(res,404,fail('API route not found.','NOT_FOUND'));
  let pathname=decodeURIComponent(url.pathname); if(pathname==='/') pathname='/index.html';
  const file=path.normalize(path.join(ROOT,pathname)); if(!file.startsWith(ROOT)) return send(res,403,fail('Forbidden.','FORBIDDEN'));
  fs.readFile(file,(err,data)=>{ if(err) return res.writeHead(404,{'Content-Type':'text/plain'}).end('Not found'); res.writeHead(200,{'Content-Type':MIME[path.extname(file)]||'application/octet-stream'}); res.end(data); });
});
server.listen(PORT,()=>console.log(`InternConnect running on http://localhost:${PORT}`));
