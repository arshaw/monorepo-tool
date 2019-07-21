import { DepType } from "./pkg/dep-objs"

export class LibError extends Error {
}

export class MissingConfigError extends LibError {
  constructor(cwd: string) {
    super(`Couldn\'t find config file in directory or parent directories. In ${cwd}`)
  }
}

export class RootInnerRefError extends LibError {
  constructor(depType: DepType, innerPkgName: string) {
    super(`Root package should not reference child package ${innerPkgName} from ${depType}`)
  }
}

export class InnerInnerRefError extends LibError {
  constructor(subjectPkgId: string, searchPkgName: string, refVerRange?: string, actualVersion?: string) {
    super(
      `Pkg ${subjectPkgId} accessing ${searchPkgName}` +
      (refVerRange ? `@${refVerRange}` : '') + ' ' +
      (actualVersion
        ? `which is out range with ${actualVersion}`
        : 'which doesn\'t have a version')
    )
  }
}

export class InnerRefError extends LibError {
  constructor(searchPkgName: string, searchPkgVersionRange: string, actualVersion: string) {
    super(
      `Problem referencing ${searchPkgName}@${searchPkgVersionRange}. Current version is ${actualVersion}`
    )
  }
}

export class PkgNameCollisionError extends LibError {
  constructor(pkgName: string) {
    super(`Multiple packages with same name "${pkgName}"`)
  }
}

export class CmdNotFoundError extends LibError {
  constructor(cmd: string) {
    super(`Command '${cmd}' is not supported`)
  }
}

export class LinkInnerPkgNoVersionError extends LibError {
  constructor(innerPkgName: string) {
    super(`Can't link to package ${innerPkgName} because it has no defined version`)
  }
}

export class FailedNpmScript extends LibError {
  constructor(scriptName: string) {
    super(`Failed executing NPM script '${scriptName}'`)
  }
}

export class MissingDistJsonError extends LibError {
  constructor(pkgId: string) {
    super(`Missing dist package.json for package '${pkgId}'`)
  }
}

export class NoRepoRootError extends LibError {
  constructor(dir: string) {
    super(`A git repo does not exist at ${dir}`)
  }
}

export class UnsupportedDepTypeError extends LibError {
  constructor(depType: string) {
    super(`The dependency type '${depType}' is not supported for this operation`)
  }
}

export class VersionishNotFoundError extends LibError {
  constructor(versionish: string) {
    super(`The version specifier ${versionish} could not be found`)
  }
}

export class UnknownVersionRangeBumpError extends LibError {
  constructor(userPkgId: string, depPkgId: string, versionRange: string) {
    super(`Cannot bump ${depPkgId} becauses uses non-standard version range '${versionRange}'. Please do it yourself first.`)
  }
}

export class GitCleanWorkingTreeError extends LibError {
  constructor(dir: string) {
    super(`Need clean git working tree in ${dir}`)
  }
}

export class PubPkgNeedsNameError extends LibError {
  constructor(pkgDir: string) {
    super(`Trying top publish package '${pkgDir}' but doesn't have a name`)
  }
}
