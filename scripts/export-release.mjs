import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const distDir = path.join(projectRoot, 'dist')
const releaseDir = path.resolve(projectRoot, process.env.RELEASE_DIR ?? 'release')

execSync('npm run build', {
  cwd: projectRoot,
  stdio: 'inherit',
})

if (!existsSync(distDir)) {
  throw new Error(`构建失败：dist 目录不存在：${distDir}`)
}

rmSync(releaseDir, { recursive: true, force: true })
mkdirSync(releaseDir, { recursive: true })
cpSync(distDir, releaseDir, { recursive: true })

console.log(`Release exported to ${releaseDir}`)