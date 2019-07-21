import { LinkInnerPkgNoVersionError } from '../errors'
import { allSettledVoid } from '../util/async'
import MonoRepo from '../MonoRepo'
import Pkg from './Pkg'
import InnerPkg from './InnerPkg'
import { addExternalDeps, addDepEntries } from './dep-json-fs'
import { PkgDeps, processPkgArgs } from './dep-objs'
import { writeExactSymlinksForPkg } from './symlink'
import { NpmAddConfig } from '../npm/AbstractNpmClient'


export function addDepsToPkgs(
  monoRepo: MonoRepo,
  subjectPkgs: Pkg[],
  pkgAddArgs: string[],
  npmRunTimeArgs: string[],
  addConfig: NpmAddConfig
) {
  let allInnerPkgsByName = monoRepo.innerPkgsByName
  let { pkgsByName, externalPkgArgs } = processPkgArgs(pkgAddArgs, monoRepo.innerPkgsByName)

  return allSettledVoid(
    subjectPkgs.map((pkg) => addDepsToPkg(
      monoRepo,
      pkg,
      allInnerPkgsByName,
      pkgsByName,
      externalPkgArgs,
      npmRunTimeArgs,
      addConfig
    ))
  )
}


export async function addDepsToPkg(
  monoRepo: MonoRepo,
  subjectPkg: Pkg,
  allInnerPkgsByName: { [pkgName: string]: InnerPkg },
  innerPkgsByName: { [pkgName: string]: InnerPkg }, // the ones to add
  externalPkgArgs: string[], // the ones to add
  npmRunTimeArgs: string[],
  addConfig: NpmAddConfig
): Promise<void> {
  // install external deps. wait for package.json to be written
  await addExternalDeps(monoRepo, subjectPkg, allInnerPkgsByName, externalPkgArgs, npmRunTimeArgs)

  // install inner deps. will write to package.json also
  await Promise.all([
    addDepEntries(subjectPkg, buildNewDeps(innerPkgsByName, addConfig)),
    writeExactSymlinksForPkg(subjectPkg, innerPkgsByName)
  ])
}


function buildNewDeps(innerPkgsByName: { [pkgName: string]: InnerPkg }, addConfig: NpmAddConfig): PkgDeps {
  let { depType } = addConfig
  let deps: PkgDeps = {}

  if (depType) { // otherwise, we dont want to write at all
    for (let innerPkgName in innerPkgsByName) {

      let version = innerPkgsByName[innerPkgName].jsonData.version
      if (!version) {
        throw new LinkInnerPkgNoVersionError(innerPkgName)
      }

      let versionRange: string
      if (addConfig.versionForceExact) {
        versionRange = version
      } else {
        versionRange = addConfig.versionPrefix + version
      }

      ;(deps[depType] || (deps[depType] = {}))[innerPkgName] = versionRange
    }
  }

  return deps
}
