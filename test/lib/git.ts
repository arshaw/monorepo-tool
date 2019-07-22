import { renameSync } from 'fs'
import { join as joinPaths, isAbsolute } from 'path'
import * as mkdirp from 'mkdirp'
import * as rimraf from 'rimraf'
import * as tmp from 'tmp'
import { exec } from './exec'


export interface GitRepoConfig {
  tmpDir?: string
  submodules?: SubModulesInput
}

export interface GitRepoRes {
  cleanup: () => void
  delete: () => void
}

export type SubModulesInput = { [path: string]: SubModulesInput } | string[]


export function buildGitRepo(dir: string, config: GitRepoConfig = {}): GitRepoRes {
  let tmpDir = config.tmpDir

  if (tmpDir) {
    if (!isAbsolute(tmpDir)) {
      tmpDir = joinPaths(process.cwd(), tmpDir)
    }
    mkdirp.sync(tmpDir)
  }

  let tmpPaths = _buildGitRepo(dir, config.submodules, tmpDir)

  function cleanup() {
    for (let tmpPath of tmpPaths) {
      rimraf.sync(tmpPath)
    }
  }

  return {
    cleanup,
    delete() {
      rimraf.sync(dir)
      cleanup()
    }
  }
}


function _buildGitRepo(dir: string, submodulesInput?: SubModulesInput, tmpDir?: string): string[] {
  let submoduleStructs: any = {}
  let tmpPaths: string[] = []

  if (Array.isArray(submodulesInput)) {
    for (let submodulePath of submodulesInput) {
      submoduleStructs[submodulePath] = {}
    }
  } else if (typeof submodulesInput === 'object' && submodulesInput) {
    submoduleStructs = submodulesInput
  }

  exec('git init', dir)

  for (let submodulePath in submoduleStructs) {
    let tmpPath = tmp.tmpNameSync({ dir: tmpDir })
    renameSync(joinPaths(dir, submodulePath), tmpPath)
    let subTmpPaths = _buildGitRepo(tmpPath, submoduleStructs[submodulePath], tmpDir)
    tmpPaths.push(tmpPath, ...subTmpPaths)
    exec([ 'git', 'submodule', 'add', '--quiet', tmpPath, submodulePath ], dir)
  }

  exec('git add *', dir)
  exec('git commit -m "initial commit"', dir)

  if (Object.keys(submoduleStructs).length) {
    exec('git submodule update --init --recursive --quiet', dir)
  }

  return tmpPaths
}


export function isGitTreeDirty(dir: string) {
  let { success, output } = exec('git status --porcelain --untracked-files=no', dir)
  return !success || Boolean(output.trim())
}
