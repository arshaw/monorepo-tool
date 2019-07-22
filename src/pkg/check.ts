import * as semver from 'semver'
import MonoRepo from '../MonoRepo'
import { whitelistDeps, DepType } from './dep-objs'
import Pkg from './Pkg'
import { RootInnerRefError, InnerInnerRefError } from '../errors'
import InnerPkg from './InnerPkg'


// TODO: check that a package isnt referring to itself


export function ensureMonoRepoHealth(monoRepo: MonoRepo) {
  let { rootPkg, innerPkgs, innerPkgsByName } = monoRepo

  if (rootPkg) {
    ensureRootHealth(rootPkg, innerPkgsByName)
  }

  ensureInnerHealth(innerPkgs, innerPkgsByName)
}


function ensureRootHealth(rootPkg: Pkg, innerPkgsByName: { [pkgName: string]: Pkg }) {

  for (let innerPkgName in innerPkgsByName) {
    let refs = whitelistDeps(rootPkg.jsonData, innerPkgName)

    for (let depType in refs) {
      throw new RootInnerRefError(depType as DepType, innerPkgName) // TODO: better DepType stategy
    }
  }
}


function ensureInnerHealth(innerPkgs: Pkg[], innerPkgsByName: { [pkgName: string]: InnerPkg }) { // InnerPkg

  for (let subjectPkg of innerPkgs) {

    for (let searchPkgName in innerPkgsByName) {
      let searchPkg = innerPkgsByName[searchPkgName]
      let actualVersion = searchPkg.jsonData.version
      let refs = whitelistDeps(subjectPkg.jsonData, searchPkgName)

      for (let depType in refs) {
        let refVerRange = refs[depType as DepType]![searchPkgName]

        if (refVerRange !== '*') {
          if (!actualVersion) {
            throw new InnerInnerRefError(subjectPkg.readableId(), searchPkgName)

          } else if (!semver.satisfies(actualVersion, refVerRange)) {
            throw new InnerInnerRefError(subjectPkg.readableId(), searchPkgName, refVerRange, actualVersion)
          }
        }
      }
    }
  }
}
