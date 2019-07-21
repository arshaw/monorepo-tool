import { allSettledVoid } from '../util/async'
import MonoRepo from '../MonoRepo'
import Pkg from './Pkg'
import InnerPkg from './InnerPkg'
import { processPkgArgs } from './dep-objs'
import { removeExactPkgDepFiles } from './dep-file-rm'
import { removeExternalDeps, removeDepEntries } from './dep-json-fs'


export async function removeDepsFromPkgs(
  monoRepo: MonoRepo,
  subjectPkgs: Pkg[],
  delArgs: string[],
  npmRunTimeArgs: string[]
) {
  let allInnerPkgsByName = monoRepo.innerPkgsByName
  let { pkgsByName, externalPkgArgs } = processPkgArgs(delArgs, allInnerPkgsByName)

  return allSettledVoid(
    subjectPkgs.map((subjectPkg) => removeDepsFromPkg(
      monoRepo,
      subjectPkg,
      allInnerPkgsByName,
      pkgsByName,
      externalPkgArgs,
      npmRunTimeArgs
    ))
  )
}


export async function removeDepsFromPkg(
  monoRepo: MonoRepo,
  subjectPkg: Pkg,
  allInnerPkgsByName: { [pkgName: string]: InnerPkg },
  pkgsByName: { [pkgName: string]: InnerPkg }, // the ones to add
  externalPkgNames: string[], // the ones to add
  npmRunTimeArgs: string[]
): Promise<void> {
  // remove external deps. will write to package.json
  await removeExternalDeps(monoRepo, subjectPkg, allInnerPkgsByName, externalPkgNames, npmRunTimeArgs)

  // remove internals deps. will write to package.json also
  await Promise.all([
    removeDepEntries(subjectPkg, pkgsByName),
    removeExactPkgDepFiles(subjectPkg, pkgsByName)
  ])
}
