import { InnerPkgConfig } from './InnerPkg'

export type DistDirInput = string | ((relDir: string, dir: string, baseDir: string) => string)

export interface BaseConfig {
  distDir: DistDirInput
  ignoreFiles: string[]
  npmClientArgs: string[]
}

export interface BaseConfigInput {
  distDir?: string | (() => string)
  ignoreFiles?: string | string[]
  npmClientArgs?: string[]
}

export interface InnerPkgConfigComplexInput extends BaseConfigInput {
  path: string
}

export type InnerPkgConfigInput = string | InnerPkgConfigComplexInput


export function parseAllPkgInput(
  allPkgInput: InnerPkgConfigInput | InnerPkgConfigInput[],
  rootConfig: BaseConfig
): InnerPkgConfig[] {
  let allPkgInputArray = Array.isArray(allPkgInput)
    ? allPkgInput
    : (allPkgInput ? [ allPkgInput ] : [])

  return allPkgInputArray.map(
    (pkgInput) => combinePkgConfigs(rootConfig, parsePkgInput(pkgInput))
  )
}


export function parseConfig(input: BaseConfigInput): BaseConfig {
  let distDir = input.distDir || ''
  let ignoreFiles = Array.isArray(input.ignoreFiles)
    ? input.ignoreFiles
    : (input.ignoreFiles ? [ input.ignoreFiles ] : [])
  let npmClientArgs = input.npmClientArgs || []

  return { distDir, ignoreFiles, npmClientArgs }
}


export function parsePkgInput(input: InnerPkgConfigInput): InnerPkgConfig { // TODO: move into config-PARSE util file, rename
  if (typeof input === 'string') {
    return Object.assign(parseConfig({}), { path: input })
  } else {
    return Object.assign(parseConfig(input), { path: input.path || '' })
  }
}


function combinePkgConfigs(config0: BaseConfig, config1: InnerPkgConfig): InnerPkgConfig { // bad name
  return {
    path: config1.path,
    distDir: config1.distDir || config0.distDir,
    ignoreFiles: config0.ignoreFiles.concat(config1.ignoreFiles),
    npmClientArgs: config0.npmClientArgs.concat(config1.npmClientArgs)
  }
}
