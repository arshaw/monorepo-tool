import { log } from '../util/log'
import { execLive } from '../util/exec'
import { filterHash } from '../util/hash'
import MonoRepo from '../MonoRepo'
import Pkg from './Pkg'
import InnerPkg from './InnerPkg'
import { PkgDeps, depsToFlags, DepType, whitelistDeps, blacklistDeps, removeDepGroups } from './dep-objs'
import { writeExactSymlinksForPkg } from './symlink'


export async function addExternalDeps(
  monoRepo: MonoRepo,
  subjectPkg: Pkg,
  allInnerPkgsByName: { [pkgName: string]: InnerPkg },
  externalPkgArgs: string[],
  npmRunTimeArgs: string[]
) {
  if (!externalPkgArgs.length) {
    return
  }

  let npmArgs = monoRepo.getCmdNpmArgs('add').concat(subjectPkg.npmClientArgs, npmRunTimeArgs)
  let cmd = monoRepo.npmClient.buildAddCmd(externalPkgArgs, npmArgs)

  await execNpmTask(
    subjectPkg,
    allInnerPkgsByName,
    () => execLive(cmd, subjectPkg.dir)
  )
}


export async function removeExternalDeps(
  monoRepo: MonoRepo,
  subjectPkg: Pkg,
  allInnerPkgsByName: { [pkgName: string]: InnerPkg },
  externalPkgArgs: string[],
  npmRunTimeArgs: string[]
) {
  if (!externalPkgArgs.length) {
    return
  }

  let npmArgs = monoRepo.getCmdNpmArgs('add').concat(subjectPkg.npmClientArgs, npmRunTimeArgs)
  let cmd = monoRepo.npmClient.buildRemoveCmd(externalPkgArgs, npmArgs)

  await execNpmTask(
    subjectPkg,
    allInnerPkgsByName,
    () => execLive(cmd, subjectPkg.dir)
  )
}


/*
Accepts a generic task that modifies a package's package.json, and allows it to happen
amidst entries that point to internal packages, which would normally choked the npm client.
*/
async function execNpmTask(
  subjectPkg: Pkg,
  allInnerPkgsByName: { [pkgName: string]: InnerPkg },
  npmTask: () => Promise<void>
) {
  let origInnerDeps: PkgDeps = whitelistDeps(subjectPkg.jsonData, allInnerPkgsByName)
  let origDepFlags = depsToFlags(origInnerDeps)
  let undoJson = await removeDepEntries(subjectPkg, origDepFlags) // remove inner-package from package.json

  function undoAndReject() {
    return undoJson().then(() => Promise.reject())
  }

  await npmTask().then(
    () => Promise.all([

      // defacto-npm kills all linked packages after almost any action. restore
      writeExactSymlinksForPkg(subjectPkg, filterHash(allInnerPkgsByName, origDepFlags)),

      // read the changes in package.json from npmTask
      subjectPkg.loadJson().then(
        () => addDepEntries(subjectPkg, origInnerDeps),
        undoAndReject
      )

    ]),
    undoAndReject
  )
}


// Change deps in package.json
// ----------------------------------------------------------------------------------------------------


export async function addDepEntries(subjectPkg: Pkg, deps: PkgDeps) {

  if (!Object.keys(deps).length) {
    return () => Promise.resolve()
  }

  let newJsonData = Object.assign({}, subjectPkg.jsonData) // copy

  // combine new deps with existing ones
  for (let depType in deps) {
    newJsonData[depType] = Object.assign(
      {},
      newJsonData[depType] || {},
      deps[depType as DepType]
    )
  }

  return await subjectPkg.updateJson(newJsonData)
}


export async function removeDepEntries(subjectPkg: Pkg, pkgHash: { [pkgName: string]: any }) {

  if (!Object.keys(pkgHash).length) {
    log(`No need to remove pkgs from ${subjectPkg.jsonPath}`, Object.keys(pkgHash))
    return () => Promise.resolve()
  }

  log(`Removing pkgs from ${subjectPkg.jsonPath}`, Object.keys(pkgHash))

  let newJsonData = Object.assign(
    removeDepGroups(subjectPkg.jsonData), // remove all deps
    blacklistDeps(subjectPkg.jsonData, pkgHash) // add-back deps without certain packages
  )

  return await subjectPkg.updateJson(newJsonData)
}
