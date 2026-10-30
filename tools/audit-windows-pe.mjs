import fs from 'node:fs';
const file=process.argv[2];if(!file)throw Error('Usage: node tools/audit-windows-pe.mjs <exe>');const b=fs.readFileSync(file),pe=b.readUInt32LE(0x3c),opt=pe+24,sections=pe+24+b.readUInt16LE(pe+20),count=b.readUInt16LE(pe+6);
if(b.toString('ascii',pe,pe+4)!=='PE\0\0'||b.readUInt16LE(opt)!==0x20b)throw Error('Expected x64 PE32+ executable');
const rva=value=>{for(let i=0;i<count;i++){const s=sections+i*40,va=b.readUInt32LE(s+12),size=Math.max(b.readUInt32LE(s+8),b.readUInt32LE(s+16));if(value>=va&&value<va+size)return value-va+b.readUInt32LE(s+20)}throw Error('Unmapped RVA '+value)};
const str=at=>b.toString('ascii',at,b.indexOf(0,at));const imports=[];const importRva=b.readUInt32LE(opt+120);
if(importRva)for(let d=rva(importRva);b.readUInt32LE(d+12);d+=20){const dll=str(rva(b.readUInt32LE(d+12))),symbols=[];let thunk=rva(b.readUInt32LE(d)||b.readUInt32LE(d+16));for(;b.readBigUInt64LE(thunk);thunk+=8){const x=b.readBigUInt64LE(thunk);symbols.push(x>>63n?'ordinal:'+String(x&0xffffn):str(rva(Number(x))+2))}imports.push({dll,symbols})}
const knownWindows11Only=['GetThreadSelectedCpuSetMasks','SetThreadSelectedCpuSetMasks','GetProcessDefaultCpuSetMasks','SetProcessDefaultCpuSetMasks'];
const found=imports.flatMap(x=>x.symbols.filter(s=>knownWindows11Only.includes(s)).map(symbol=>({dll:x.dll,symbol})));
console.log(JSON.stringify({file,machine:b.readUInt16LE(pe+4).toString(16),osVersion:[b.readUInt16LE(opt+40),b.readUInt16LE(opt+42)],subsystemVersion:[b.readUInt16LE(opt+48),b.readUInt16LE(opt+50)],imports,knownWindows11OnlyImports:found,scope:'Static imports only; COM interface version requirements and dynamically loaded APIs require source/API documentation review.'},null,2));if(found.length)process.exitCode=1;
