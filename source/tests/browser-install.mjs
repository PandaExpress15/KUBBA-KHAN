import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {launch,extension} from './browser-support.mjs';
const b=await launch();
try{
 async function files(dir,prefix=''){
  const result=[];for(const item of await readdir(dir,{withFileTypes:true})){
   const name=prefix+item.name;
   result.push(...(item.isDirectory()?await files(path.join(dir,item.name),name+'/'):[name]));
  }return result.sort();
 }
 const names=await files(extension),local={};
 for(const name of names)local[name]=createHash('sha256').update(await readFile(path.join(extension,name))).digest('hex');
 const loaded=await b.worker.evaluate(async names=>{
  const entries=[];for(const name of names){
   const response=await fetch(chrome.runtime.getURL(name));if(!response.ok)throw Error('Extension asset unavailable');
   const hash=await crypto.subtle.digest('SHA-256',await response.arrayBuffer());
   entries.push([name,[...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('')]);
  }return Object.fromEntries(entries);
 },names);
 assert.deepEqual(loaded,local,'all loaded extension bytes match final source');
 const manifest=await b.worker.evaluate(()=>chrome.runtime.getManifest());assert.equal(manifest.version,'2.1.7');
 assert.ok(await b.worker.evaluate(()=>chrome.permissions.contains({origins:['https://classroom.khanacademy.org/*','https://www.khanacademy.org/*','https://www.youtube.com/*','https://www.youtube-nocookie.com/*']})));
 const page=await b.context.newPage();await page.goto('chrome://extensions/');
 const info=await page.evaluate(async id=>(await chrome.developerPrivate.getExtensionsInfo({includeDisabled:true})).find(e=>e.id===id),b.id);
 assert.equal(info.state,'ENABLED');assert.equal(info.path,extension.replace(/\/$/,''));assert.deepEqual(info.manifestErrors,[]);
 const treeHash=createHash('sha256').update(JSON.stringify(local)).digest('hex');
 const evidence={browser:b.context.browser().version(),version:manifest.version,id:b.id,path:info.path,enabled:true,allHostPermissionsGranted:true,manifestErrors:info.manifestErrors,extensionTreeSHA256:treeHash,files:loaded,syntheticSiteOnly:true};
 console.log('PASS fresh installation and all loaded source bytes',JSON.stringify(evidence));
 if(process.env.BROWSER_EVIDENCE_DIR)await writeFile(process.env.BROWSER_EVIDENCE_DIR+'/installed-source.json',JSON.stringify(evidence,null,2));
}finally{await b.close();}
