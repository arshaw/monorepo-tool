import { ReleaseType } from 'semver'
import { UnsupportedDepTypeError } from '../errors'
import { extractNamedFlag, extractNamedVal } from '../util/arg-parse'
import { DepType } from '../pkg/dep-objs'
import AbstractNpmClient, { NpmVersionConfig, NpmAddConfig } from './AbstractNpmClient'


export default class YarnNpmClient extends AbstractNpmClient {

  baseCmd: string = 'yarn'


  buildInstallCmd(forceCi: boolean, otherArgs: string[]) {
    return [ this.baseCmd, 'install' ].concat(otherArgs)
  }


  buildExecCmd(cmdStr: string): string[] {
    // pipe directly to bash! no npx equiv! TODO: x-platform compat?
    // TODO: use spawn() with shell:true arg?
    return [ 'eval', cmdStr ]
  }


  buildAddCmd(pkgArgs: string[], otherArgs: string[]): string[] {
    return [ this.baseCmd, 'add', ...pkgArgs, ...otherArgs ]
  }


  buildRemoveCmd(pkgArgs: string[], otherArgs: string[]): string[] {
    return [ this.baseCmd, 'remove', ...pkgArgs, ...otherArgs ]
  }


  async queryAddConfig(args: string[], rootDir: string): Promise<NpmAddConfig> {
    let doDev = extractNamedFlag(args, [ 'dev', 'D' ], false)
    let doPeer = extractNamedFlag(args, [ 'peer', 'P' ], false)
    let doOptional = extractNamedFlag(args, [ 'optional', 'O' ], false)
    let doExact = extractNamedFlag(args, [ 'exact', 'E' ], false)
    let doTilde = extractNamedFlag(args, [ 'tilde', 'T' ], false)
    let depType: DepType

    if (doPeer) {
      throw new UnsupportedDepTypeError('peerDependencies')
    } else if (doDev) {
      depType = 'devDependencies'
    } else if (doOptional) {
      depType = 'optionalDependencies'
    } else {
      depType = 'dependencies'
    }

    return { depType, versionPrefix: doTilde ? '~' : '^', versionForceExact: doExact }
  }


  queryVersionConfig(args: string[], rootDir: string): Promise<NpmVersionConfig> {
    return Promise.all([
      this.queryConfigVal('version-tag-prefix', args, rootDir),
      this.queryConfigVal('version-git-message', args, rootDir),
      this.queryConfigFlag('version-sign-git-tag', args, rootDir),
      this.queryConfigFlag('version-git-tag', args, rootDir),
      this.queryConfigFlag('version-commit-hooks', args, rootDir)
    ]).then(([
      tagPrefix,
      gitMessage,
      signGitTag,
      gitTag,
      commitHooks
    ]) => {
      let versionExact = extractNamedVal(args, 'new-version') || ''
      let versionReleaseType: ReleaseType | '' = ''
      let versionIgnoreScripts = extractNamedFlag(args, 'ignore-scripts', false)
      let isMajor = extractNamedVal(args, 'major')
      let isMinor = extractNamedVal(args, 'minor')
      let isPatch = extractNamedVal(args, 'patch')
      let force = extractNamedFlag(args, [ 'force', 'f' ], false) // not a real Yarn setting

      if (!versionExact) {
        if (isMajor) { versionReleaseType = 'major' }
        else if (isMinor) { versionReleaseType = 'minor' }
        else if (isPatch) { versionReleaseType = 'patch' }
      }

      return {
        versionExact,
        versionReleaseType,
        versionPreid: '',
        versionAllowSame: true, // TODO: investigate Yarn's default behavior
        versionIgnoreScripts,
        gitForce: force,
        gitTagEnabled: gitTag,
        gitMessage: gitMessage,
        gitTagPrefix: tagPrefix,
        gitTagSign: signGitTag,
        gitCommitHooks: commitHooks,
        gitCommitArgs: args
      }
    })
  }


  queryGitTagPrefix(rootDir: string): Promise<string> {
    return this.queryConfigVal('version-tag-prefix', [], rootDir)
  }

}
