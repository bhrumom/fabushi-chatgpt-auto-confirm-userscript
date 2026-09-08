import http from 'node:http';
import { readFile } from 'node:fs/promises';
const directory = new URL('./',import.meta.url);
http.createServer(async(req,res)=>{
 const path=new URL(req.url,'http://127.0.0.1').pathname;
 const file=path==='/chatgpt-auto-confirm.user.js'?'chatgpt-auto-confirm.user.js':'preview.html';
 try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8');res.end(await readFile(new URL(file,directory)));}
 catch{res.statusCode=500;res.end('Preview unavailable');}
}).listen(4178,'127.0.0.1',()=>console.log('Local simulation: http://127.0.0.1:4178'));
