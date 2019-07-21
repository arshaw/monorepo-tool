import { ReleaseType } from 'semver'
import { execBuffered } from '../util/exec'
import { extractNamedFlag, ArgNameInput, extractNamedVal } from '../util/arg-parse'
import { DepType } from '../pkg/dep-objs'


export interface NpmVersionConfig {
  versionAllowSame: boolean
  gitTagEnabled: boolean
  gitMessage: string
  gitTagPrefix: string
  gitTagSign: boolean
  gitCommitHooks: boolean
  versionExact: string
  versionReleaseType: ReleaseType | '' // if there's an exact, will be blank
  versionPreid: string
  versionIgnoreScripts: boolean
  gitForce: boolean
  gitCommitArgs: string[]
}

export interface NpmAddConfig {
  depType: DepType | '' // empty string means don't save to package.json
  versionPrefix: string
  versionForceExact: boolean
}


export default abstract class AbstractNpmClient {

  abstract baseCmd: string


  abstract buildInstallCmd(forceCi: boolean, npmArgs: string[]): string[]
  abstract buildAddCmd(pkgArgs: string[], npmArgs: string[]): string[]
  abstract buildRemoveCmd(pkgArgs: string[], npmArgs: string[]): string[]
  abstract buildExecCmd(npmArgs: string[]): string[]


  buildRunCmd(npmArgs: string[]): string[] {
    return [ this.baseCmd, 'run', ...npmArgs ]
  }

  buildPublishCmd(npmArgs: string[]): string[] {
    return [ this.baseCmd, 'publish', ...npmArgs ]
  }


  abstract queryAddConfig(args: string[], rootDir: string): Promise<NpmAddConfig>
  abstract queryVersionConfig(args: string[], rootDir: string): Promise<NpmVersionConfig>
  abstract queryGitTagPrefix(rootDir: string): Promise<string>


  async queryConfigFlag(nameInput: ArgNameInput, args: string[], rootDir: string): Promise<boolean> {
    let varName = Array.isArray(nameInput) ? nameInput[0] : nameInput
    let varVal = extractNamedFlag(args, nameInput)

    if (varVal !== null) {
      return varVal
    }

    let raw = this.getEnvConfigVar(varName)
    if (raw != null) {
      return JSON.parse(raw)
    }

    return JSON.parse(await this.queryUserConfigVar(varName, rootDir))
  }


  async queryConfigVal(nameInput: ArgNameInput, args: string[], rootDir: string): Promise<string> {
    let varName = Array.isArray(nameInput) ? nameInput[0] : nameInput
    let varVal = extractNamedVal(args, nameInput)

    if (varVal !== null) {
      return varVal
    }

    varVal = this.getEnvConfigVar(varName)
    if (varVal != null) {
      return varVal
    }

    return await this.queryUserConfigVar(varName, rootDir)
  }


  getEnvConfigVar(varName: string): string | null {
    let key = 'npm_config_' + varName.replace('-', '_')
    let val = process.env[key]

    return val === undefined ? null : val
  }


  queryUserConfigVar(varName: string, rootDir: string) {
    return execBuffered([ this.baseCmd, 'config', 'get', varName ], rootDir)
      .then((output) => output.trim())
  }

}
