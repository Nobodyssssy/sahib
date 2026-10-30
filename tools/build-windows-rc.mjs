import fs from 'node:fs';import {spawn} from 'node:child_process';
const args=['node_modules/@tauri-apps/cli/tauri.js','build','--config','src-tauri/tauri.rc.conf.json','--features','native-widget-rc,brand-preview','--bundles','nsis','--','--locked'];
const child=spawn(process.execPath,args,{stdio:'inherit',windowsHide:true,env:{...process.env,SAHIB_BRAND_PREVIEW:'1'}});child.on('error',e=>{console.error(e);process.exitCode=1});child.on('exit',c=>process.exitCode=c??1);
