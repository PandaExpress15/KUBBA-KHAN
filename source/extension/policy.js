export const isKhan=url=>{try{const u=new URL(url);return u.protocol==='https:'&&['classroom.khanacademy.org','www.khanacademy.org'].includes(u.hostname);}catch{return false;}};
export const scope=url=>{const u=new URL(url);const m=u.pathname.match(/^\/learner\/class\/[^/]+/);return u.origin+(m?m[0]:'/');};
export const inScope=(url,s)=>isKhan(url)&&(url===s||url.startsWith(s.endsWith('/')?s:s+'/')||url.startsWith(s+'?'));
export const validMedia=url=>{try{const u=new URL(url);return u.protocol==='https:'&&['www.youtube.com','www.youtube-nocookie.com'].includes(u.hostname)&&u.pathname.startsWith('/embed/');}catch{return false;}};
export const safeRate=x=>[1,1.25,1.5,1.75,2].includes(Number(x))?Number(x):2;
