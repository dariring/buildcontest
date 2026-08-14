import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const ROOT = path.dirname(fileURLToPath(import.meta.url))

/**
 * 클라이언트 번들만 담당합니다. API 는 express(src/server) 가 처리하고,
 * 개발 중에는 그 express 가 이 설정을 그대로 받아 vite 를 미들웨어로 물고 돕니다.
 *
 * 경로를 전부 절대경로로 두는 이유: 개발 서버가 이 객체를 import 해서 쓰는데,
 * 상대경로면 실행 위치(cwd)에 따라 엉뚱한 폴더를 가리킬 수 있습니다.
 */
export default defineConfig({
  plugins: [react()],
  root: ROOT,
  publicDir: path.join(ROOT, 'public'),
  resolve: {
    alias: {
      '@': path.join(ROOT, 'src/client'),
    },
  },
  build: {
    outDir: path.join(ROOT, 'dist'),
    emptyOutDir: true,
    // 파일명에 해시가 붙으므로 서버에서 캐시를 오래 걸어도 안전합니다.
    assetsDir: 'assets',
    sourcemap: false,
  },
})
