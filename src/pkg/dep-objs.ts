import * as semver from 'semver'
import { InnerRefError } from '../errors'
import { arrayToHash } from '../util/hash'
import { parsePkgVersionRangeArg } from '../util/version'
import InnerPkg from './InnerPkg'


export type VerRangeHash = { [pkgName: string]: string }

export interface PkgDeps {
  dependencies?: VerRangeHash
  devDependencies?: VerRangeHash
  peerDependencies?: VerRangeHash
  optionalDependencies?: VerRangeHash
}

export type DepType = keyof PkgDeps
export type DepFilterArg = string | string[] | { [pkgName: string]: any } // accepts a map


const DEP_TYPES: DepType[] = [ 'dependencies', 'devDependencies', 'optionalDependencies' ]
const INSTALLABLE_DEP_TYPES: DepType[] = [ 'dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies' ]


export function mapInstallableDeps<T>(deps: PkgDeps, func: (pkgName: string, versionRange: string) => T): T[] {
  let res: T[] = []

  for (let depType of INSTALLABLE_DEP_TYPES) {
    let depGroup = deps[depType]

    if (depGroup) {
      for (let pkgName in depGroup) {
        res.push(
          func(pkgName, depGroup[pkgName])
        )
      }
    }
  }

  return res
}


/*
removes the dependencies/devDependencies/etc keys from an arbitrary object
*/
export function removeDepGroups(props: any) {
  let copy = Object.assign({}, props)

  for (let depType of INSTALLABLE_DEP_TYPES) {
    delete copy[depType]
  }

  return copy
}


export function mergeDeps(deps0: PkgDeps, deps1: PkgDeps): PkgDeps {
  let res: PkgDeps = {}

  for (let depType of DEP_TYPES) {
    if (deps0[depType] || deps1[depType]) {
      res[depType] = Object.assign({}, deps0[depType] || {}, deps1.dependencies || {})
    }
  }

  return res
}


/*
Remove entries based on a filter function
*/
export function filterDeps(deps: PkgDeps, func: (pkgName: string, versionRange: string) => string | boolean) {
  let res: PkgDeps = {}

  for (let depType of DEP_TYPES) {
    let depGroup = deps[depType]

    if (depGroup) {
      let resGroup: any = {}
      let isAny = false

      for (let pkgName in depGroup) {
        let funcRes = func(pkgName, depGroup[pkgName])

        if (typeof funcRes === 'string') {
          resGroup[pkgName] = funcRes
          isAny = true

        } else if (funcRes) {
          resGroup[pkgName] = depGroup[pkgName]
          isAny = true
        }
      }

      if (isAny) {
        res[depType] = resGroup
      }
    }
  }

  return res
}


export function whitelistDeps(deps: PkgDeps, whitelist: DepFilterArg) {
  let hash = parseFilterArg(whitelist)

  return filterDeps(deps, (pkgName) => {
    return hash[pkgName]
  })
}


export function blacklistDeps(deps: PkgDeps, blacklist: DepFilterArg) {
  let hash = parseFilterArg(blacklist)

  return filterDeps(deps, (pkgName) => {
    return !hash[pkgName]
  })
}


/*
Given a list of args that might be given to `npm install ...`, decides which ones
are internal packages versus external. Makes sure internal packages match the request version.
*/
export function processPkgArgs(args: string[], innerPkgsByName: { [pkgName: string]: InnerPkg }) {
  let pkgsByName: { [pkgName: string]: InnerPkg } = {}
  let externalPkgArgs: string[] = []

  for (let arg of args) {
    let [ pkgName, pkgVerRange ] = parsePkgVersionRangeArg(arg)
    let innerPkg = innerPkgsByName[pkgName]

    if (innerPkg) {
      let actualVersion = innerPkg.jsonData.version

      if (
        actualVersion &&
        pkgVerRange &&
        semver.valid(pkgVerRange) && // not a tag or something else
        !semver.satisfies(actualVersion, pkgVerRange)
      ) {
        throw new InnerRefError(pkgName, pkgVerRange, actualVersion)
      }

      pkgsByName[pkgName] = innerPkg
    } else {
      externalPkgArgs.push(arg)
    }
  }

  return { pkgsByName, externalPkgArgs }
}


export function depsToFlags(deps: PkgDeps) {
  let res: { [pkgName: string]: true } = {}

  for (let depType in deps) {
    let depGroup = deps[depType as DepType]

    for (let pkgName in depGroup) {
      res[pkgName] = true
    }
  }

  return res
}


function parseFilterArg(arg: DepFilterArg): { [pkgName: string]: any } {
  if (typeof arg === 'string') {
    return { [arg]: true }

  } else if (Array.isArray(arg)) {
    return arrayToHash(arg)

  } else {
    return arg
  }
}
