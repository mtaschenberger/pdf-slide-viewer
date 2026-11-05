import {defineConfig} from 'vite';
import {fileURLToPath, URL} from 'node:url';
export default defineConfig(({mode})=>({resolve:{alias:mode==='integration'?{'@wailsio/runtime':fileURLToPath(new URL('./tests/runtime.ts',import.meta.url))}:{}}}));
