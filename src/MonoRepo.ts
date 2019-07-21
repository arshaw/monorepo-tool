import { promisify } from 'util'
import * as fs from 'fs'
import { join as joinPaths, dirname } from 'path'
import { pathIsRoot } from './util/path'
import { MissingConfigError } from './errors'
import Pkg, { hashPkgsByName } from './pkg/Pkg'
import InnerPkg from './pkg/InnerPkg'
import { queryInnerPkgs } from './pkg/inner-pkg-query'
import { parseConfig, BaseConfig, parseAllPkgInput, InnerPkgConfigInput, BaseConfigInput } from './pkg/parse'
import YarnNpmClient from './npm/YarnNpmClient'
import DefactoNpmClient from './npm/DefactoNpmClient'
import AbstractNpmClient from './npm/AbstractNpmClient'
const fileExists = promisify(fs.exists)

const JS_CONFIG_FILENAME = 'monorepo.config.js'
const JSON_CONFIG_FILENAME = 'monorepo.json'


export type CmdConfigs = { [cmd: string]: { npmClientArgs?: string[] } }

export interface RootConfigInput extends BaseConfigInput {
  packages: InnerPkgConfigInput | InnerPkgConfigInput[]
  commands?: CmdConfigs
  npmClient?: string
  npmClientArgs?: string[]
}


export default class MonoRepo {

  innerPkgsByName: { [pkgName: string]: InnerPkg } = {}


  constructor(
    public rootDir: string,
    public rootPkg: Pkg | null,
    public innerPkgs: InnerPkg[],
    public npmClient: AbstractNpmClient,
    public cmdConfigs: CmdConfigs
  ) {
    this.innerPkgsByName = hashPkgsByName(innerPkgs)
  }


  getCmdNpmArgs(cmd: string): string[] {
    return (this.cmdConfigs[cmd] || {}).npmClientArgs || []
  }

}


export async function queryMonoRepoWithDir(cwd: string): Promise<MonoRepo> {
  let configPath = await queryConfigPath(cwd)

  if (!configPath) {
    throw new MissingConfigError(cwd)
  }

  let rootConfigInput: RootConfigInput = require(configPath) // for JS or JSON
  let rootConfig = parseConfig(rootConfigInput)
  let rootDir = dirname(configPath)
  let innerPkgConfigs = parseAllPkgInput(rootConfigInput.packages, rootConfig)

  return Promise.all([
    queryRootPkg(rootConfig, rootDir),
    queryInnerPkgs(innerPkgConfigs, rootDir)
  ]).then(([
    rootPkg,
    innerPkgs
  ]) => {
    return new MonoRepo(
      rootDir,
      rootPkg,
      innerPkgs,
      buildNpmClient(rootConfigInput.npmClient),
      rootConfigInput.commands || {}
    )
  })
}


async function queryRootPkg(rootConfig: BaseConfig, rootDir: string): Promise<Pkg | null> {
  let pkgJsonPath = joinPaths(rootDir, 'package.json')
  let exists = await fileExists(pkgJsonPath)

  if (exists) {
    let pkg = new Pkg(rootDir, rootConfig.npmClientArgs || [])
    await pkg.loadJson()
    return pkg

  } else {
    return null
  }
}


async function queryConfigPath(dir: string): Promise<string> {
  do {
    let jsConfigPath = joinPaths(dir, JS_CONFIG_FILENAME)
    let jsonConfigPath = joinPaths(dir, JSON_CONFIG_FILENAME)

    if (await fileExists(jsConfigPath)) {
      return jsConfigPath
    }

    if (await fileExists(jsonConfigPath)) {
      return jsonConfigPath
    }

    dir = dirname(dir)
  } while (!pathIsRoot(dir))

  return ''
}


function buildNpmClient(npmClientName?: string): AbstractNpmClient {
  return npmClientName === 'yarn'
    ? new YarnNpmClient()
    : new DefactoNpmClient()
}
