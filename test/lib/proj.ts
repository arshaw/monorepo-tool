import { buildDirStruct, BuildDirConfig } from './dir'
import { buildGitRepo, GitRepoConfig, GitRepoRes } from './git'


export interface BuildProjConfig extends BuildDirConfig {
  git?: true | GitRepoConfig
}

export interface BuildProjRes {
  path: string
  delete: () => void
}

const TMP_DIR = 'tmp'
let activeProjs: BuildProjRes[]


export function buildProj(struct: any, config: BuildProjConfig = {}): BuildProjRes {
  config = Object.assign({ tmpDir: TMP_DIR }, config)

  let dirRes = buildDirStruct(struct, config)
  let gitRes: GitRepoRes

  if (config.git) {
    let gitConfig = Object.assign(
      { tmpDir: config.tmpDir },
      typeof config.git === 'object' ? config.git : {}
    )

    gitRes = buildGitRepo(dirRes.path, gitConfig)
  }

  let res: BuildProjRes = {
    path: dirRes.path,
    delete() {
      dirRes.delete()

      if (gitRes) {
        gitRes.delete()
      }
    }
  }

  if (activeProjs) {
    activeProjs.push(res)
  }

  return res
}


// Jest stuff

beforeEach(() => {
  activeProjs = []
})

afterEach(() => {
  for (let activeProj of activeProjs) {
    activeProj.delete()
  }
  activeProjs = []
})
