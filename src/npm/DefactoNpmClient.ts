import { ReleaseType } from 'semver'
import { quote } from 'shell-quote'
import { UnsupportedDepTypeError } from '../errors'
import { extractNamedVal, extractNamedFlag, extractPositionalArg } from '../util/arg-parse'
import { DepType } from '../pkg/dep-objs'
import AbstractNpmClient, { NpmVersionConfig, NpmAddConfig } from './AbstractNpmClient'


export default class DefactoNpmClient extends AbstractNpmClient {

  baseCmd: string = 'npm'


  buildInstallCmd(forceCi: boolean, npmArgs: string[]) {
    return [ this.baseCmd, forceCi ? 'ci' : 'install' ].concat(npmArgs)
  }


  buildAddCmd(pkgArgs: string[], npmArgs: string[]): string[] {
    return [ this.baseCmd, 'install', ...pkgArgs, ...npmArgs ]
  }


  buildRemoveCmd(pkgArgs: string[], npmArgs: string[]): string[] {
    return [ this.baseCmd, 'install', ...pkgArgs, ...npmArgs ]
  }


  buildExecCmd(npmArgs: string[]): string[] {
    return [ 'npx', '-c', quote(npmArgs) ]
  }


  queryAddConfig(args: string[], rootDir: string): Promise<NpmAddConfig> {
    return Promise.all([
      this.queryConfigFlag([ 'save', 'S' ], args, rootDir),
      this.queryConfigFlag([ 'save-bundle', 'B' ], args, rootDir),
      this.queryConfigFlag([ 'save-prod', 'P' ], args, rootDir),
      this.queryConfigFlag([ 'save-dev', 'D' ], args, rootDir),
      this.queryConfigFlag([ 'save-optional', 'O' ], args, rootDir),
      this.queryConfigFlag([ 'save-exact', 'E' ], args, rootDir),
      this.queryConfigVal('save-prefix', args, rootDir)
    ]).then(([
      doSave,
      doSaveBundle,
      doSaveProd,
      doSaveDev,
      doSaveOptional,
      doExact,
      prefix
    ]) => {
      let depType: DepType | '' = ''

      if (doSaveBundle) {
        throw new UnsupportedDepTypeError('bundledDependencies')
      } else if (doSaveDev) {
        depType = 'devDependencies'
      } else if (doSaveOptional) {
        depType = 'optionalDependencies'
      } else if (doSaveProd || doSave) {
        depType = 'dependencies'
      }

      return { depType, versionPrefix: prefix, versionForceExact: doExact }
    })
  }


  queryVersionConfig(args: string[], rootDir: string): Promise<NpmVersionConfig> {
    return Promise.all([
      this.queryConfigFlag('allow-same-version', args, rootDir),
      this.queryConfigVal('tag-version-prefix', args, rootDir),
      this.queryConfigFlag('git-tag-version', args, rootDir),
      this.queryConfigFlag('commit-hooks', args, rootDir),
      this.queryConfigFlag([ 'sign-git-tag', 's' ], args, rootDir)
    ]).then(([
      allowSameVersion,
      tagVersionPrefix,
      gitTagVersion,
      commitHooks,
      signGitTag
    ]) => {
      let message = extractNamedVal(args, [ 'message', 'm' ]) || ''
      let force = extractNamedFlag(args, [ 'force', 'f' ], false)
      let versionIgnoreScripts = extractNamedFlag(args, 'ignore-scripts', false)
      let versionSpecifier = extractPositionalArg(args) || ''
      let versionExact = ''
      let versionReleaseType: ReleaseType | '' = ''

      if (versionSpecifier) {
        if (
          versionSpecifier === 'major' ||
          versionSpecifier === 'minor' ||
          versionSpecifier === 'patch' ||
          versionSpecifier === 'prepatch' ||
          versionSpecifier === 'prerelease'
        ) {
          versionReleaseType = versionSpecifier
        } else {
          versionExact = versionSpecifier
        }
      }

      let versionPreid = (versionReleaseType === 'prerelease' && extractNamedVal(args, 'preid')) || ''

      return {
        versionExact,
        versionReleaseType,
        versionPreid,
        versionAllowSame: allowSameVersion,
        versionIgnoreScripts,
        gitForce: force,
        gitMessage: message,
        gitTagEnabled: gitTagVersion,
        gitTagPrefix: tagVersionPrefix,
        gitTagSign: signGitTag,
        gitCommitHooks: commitHooks,
        gitCommitArgs: args
      }
    })
  }


  queryGitTagPrefix(rootDir: string): Promise<string> {
    return this.queryConfigVal('tag-version-prefix', [], rootDir)
  }

}
