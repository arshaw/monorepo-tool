import * as semver from 'semver'
import * as prompts from 'prompts'
import { log } from '../util/log'
import { updateVerRange } from '../util/version'
import { runPrettySerial } from '../util/pretty-task'
import { allSettled, runParallel, allSettledVoid } from '../util/async'
import { FailedNpmScript, UnknownVersionRangeBumpError, GitCleanWorkingTreeError } from '../errors'
import MonoRepo from '../MonoRepo'
import Pkg from './Pkg'
import InnerPkg from './InnerPkg'
import { changedPkgsSincePoint } from './changed'
import { computeBaseVersion } from './version-utils'
import { DepType, PkgDeps, mergeDeps, whitelistDeps } from './dep-objs'
import { getDirIsRepoRoot } from '../git/GitRepo'
import PkgGitRepo, { buildPkgGitRepo } from '../git/PkgGitRepo'
import GitRepo from '../git/GitRepo'
import AbstractNpmClient, { NpmVersionConfig } from '../npm/AbstractNpmClient'
import { mapHashToArray } from '../util/hash'


interface Mod {
  pkg: Pkg
  directlyChanged?: boolean
  version?: string // new version
  deps?: PkgDeps // dep updates
}

type ModMap = { [dir: string]: Mod }



export async function bumpVersionsWithPrompt(monoRepo: MonoRepo, subjectPkgs: InnerPkg[], versionConfig: NpmVersionConfig, forceAllPkgs: boolean) {
  let res = await prepareVersionBump(monoRepo, subjectPkgs, versionConfig, forceAllPkgs)

  if (res) {
    if (res.mods.length) {
      let okay = await confirmMods(res.mods, res.newVersion)
      if (okay) {
        return res.execute()
      }
    } else {
      console.log('No packages to bump')
    }
  }
}


/*
TODO: ordering of pkgs by who-depends-on-who
NOTE: gitTagEnabled means commit+tag
*/
export async function prepareVersionBump(monoRepo: MonoRepo, subjectPkgs: InnerPkg[], versionConfig: NpmVersionConfig, forceAllPkgs: boolean) {

  // SETUP
  // ----------------------------------------------------------------------------------------------------

  let { rootDir, rootPkg, npmClient } = monoRepo

  if (versionConfig.gitTagEnabled && !versionConfig.gitForce) {
    await checkCleanTree(rootDir)
  }

  let oldVersion = computeBaseVersion(rootPkg, subjectPkgs)
  let newVersion = versionConfig.versionExact ||
    semver.inc(oldVersion || '0.0.0', versionConfig.versionReleaseType || 'patch')

  if (!newVersion) {
    throw new Error('Could not compute new version number') // TODO: prettier error if old version was bad
  }

  log(`oldVersion: ${oldVersion}, newVersion: ${newVersion}`)

  // packages that need a version bump because of changes
  let namedPkgs = subjectPkgs.filter((pkg) => {
    return Boolean(pkg.jsonData.name)
  })

  let directBumpPkgs = forceAllPkgs
    ? namedPkgs
    : await changedPkgsSincePoint(monoRepo, namedPkgs, oldVersion, [])

  if (!directBumpPkgs.length) {
    console.log()
    console.log('No changed packages')
    console.log()
    return
  }

  let modMap = buildModMap(directBumpPkgs, newVersion, monoRepo.innerPkgs)
  let modUndos: (() => Promise<void>)[] = []

  // if root package has a version field, make an operation to update that too
  if (rootPkg && ('version' in rootPkg.jsonData)) {
    modMap[rootDir] = { pkg: rootPkg, version: newVersion }
  }

  let allBumpPkgs = mapHashToArray(modMap, (mod) => mod.pkg)
  let pkgGitRepo = versionConfig.gitTagEnabled
    ? await buildPkgGitRepo(rootDir, allBumpPkgs)
    : null

  let isFilesAdded = false


  // FUNCS
  // ----------------------------------------------------------------------------------------------------


  async function execute() {

    log('Running preversion hooks...')
    await preVersionHook()

    modUndos = await modifyFiles(modMap)

    if (pkgGitRepo) {
      await addFiles(pkgGitRepo, modMap).catch(undoAndReject)
      isFilesAdded = true
    }

    log('Running version hooks...')
    await versionHook()

    if (pkgGitRepo) {
      let messageTemplate = versionConfig.gitMessage || '%s' // TODO: gitMessage is a bad name. have NpmClients default to '%s' ?
      let message = messageTemplate.replace('%s', newVersion!)

      let committedRepos: GitRepo[] = [] // yuck
      await commitFiles(pkgGitRepo, modMap, versionConfig, message, committedRepos)
        .catch(undoAndReject)

      await allSettledVoid(
        committedRepos.map((repo) => {
          return repo.createTag(
            versionConfig.gitTagPrefix + newVersion,
            message,
            versionConfig.gitTagSign
          ).catch((err) => {
            console.error('Repo with problem making tag: ' + repo.rootDir)
            throw err
          })
        })
      )
    }

    log('Running postversion hooks...')
    await postVersionHook()
  }


  async function undo() {
    if (isFilesAdded) {
      await resetFiles(pkgGitRepo!, modMap)
    }

    await runParallel(modUndos)
  }


  async function undoAndReject(error: Error) {
    await undo() // undo first
    throw error // then rethrow error
  }


  async function preVersionHook() {
    if (!versionConfig.versionIgnoreScripts) {
      process.env.npm_package_version = oldVersion
      await runNpmScripts(npmClient, modMap, 'preversion').catch(undoAndReject)
    }
  }


  async function versionHook() {
    if (!versionConfig.versionIgnoreScripts) {
      process.env.npm_package_version = newVersion!
      await runNpmScripts(npmClient, modMap, 'version').catch(undoAndReject)
    }
  }


  async function postVersionHook() {
    if (!versionConfig.versionIgnoreScripts) {
      // npm_package_version will already be set to newVersion
      await runNpmScripts(npmClient, modMap, 'postversion') // don't undo with undoAndReject
    }
  }


  return { mods: Object.values(modMap), newVersion, execute }
}


// MOD CREATION
// ----------------------------------------------------------------------------------------------------


function buildModMap(directBumpPkgs: Pkg[], newVersion: string, allInnerPkgs: Pkg[]): ModMap {
  let modMap: ModMap = {}

  for (let pkg of directBumpPkgs) {
    if (pkg.jsonData.version !== newVersion) {
      let mod = processPkgBump(pkg, newVersion, allInnerPkgs, modMap)
      mod.directlyChanged = true
    }
  }

  return modMap
}


/*
Will populate the modifications that must happen if ONLY pkg were to be bumped. The [recursive] caller will add-in
the modifications to pkg's dependencies later
*/
function processPkgBump(pkg: Pkg, newVersion: string, allInnerPkgs: Pkg[], modMap: ModMap) {
  let mod = modMap[pkg.dir]

  if (!mod) {
    mod = modMap[pkg.dir] = { pkg }

    let pkgName = pkg.jsonData.name
    if (pkgName) { // can others refer to it?...

      mod.version = newVersion // ...if so, give it a version bump

      // identify other pkgs that refer to this one
      for (let userPkg of allInnerPkgs) {
        let matchedDeps = whitelistDeps(userPkg.jsonData, pkgName)
        let updatedDeps: PkgDeps = {}

        for (let depType in matchedDeps) {
          let existingRange = matchedDeps[depType as DepType]![pkgName]

          if (!semver.satisfies(newVersion, existingRange)) {
            let newVerRange = updateVerRange(existingRange, newVersion)

            if (!newVerRange) {
              throw new UnknownVersionRangeBumpError(userPkg.readableId(), pkg.readableId(), existingRange)
            } else {
              log(userPkg.readableId(), 'uses out of date', depType, pkgName, newVerRange)
              updatedDeps[depType as DepType] = { [pkgName]: newVerRange }
            }
          }
        }

        if (Object.keys(updatedDeps).length) {
          let depMod = processPkgBump(userPkg, newVersion, allInnerPkgs, modMap)

          if (depMod.deps) { // has some updated deps from a different mod
            depMod.deps = mergeDeps(depMod.deps, updatedDeps)
          } else {
            depMod.deps = updatedDeps
          }
        }
      }
    }
  }

  return mod
}


// MOD EXECUTION
// ----------------------------------------------------------------------------------------------------


function modifyFiles(modMap: ModMap): Promise<(() => Promise<void>)[]> {
  return allSettled(
    mapHashToArray(modMap, (mod, dir) => {
      return modifyPkgFiles(modMap[dir])
    })
  )
}


async function modifyPkgFiles(mod: Mod): Promise<() => Promise<void>> {
  let { pkg } = mod
  let newJsonData: any = Object.assign({}, pkg.jsonData)

  if (mod.version) {
    newJsonData.version = mod.version
  }

  if (mod.deps) {
    Object.assign(
      newJsonData,
      mergeDeps(newJsonData, mod.deps) // awkward
    )
  }

  return pkg.updateJson(newJsonData)
}


// GIT UTILS
// ----------------------------------------------------------------------------------------------------


async function checkCleanTree(rootDir: string) {
  let isGit = await getDirIsRepoRoot(rootDir) // BAD: done again for buildPkgGitRepo
  let gitRepo = new GitRepo(rootDir)

  if (isGit) {
    let isDirty = await gitRepo.isDirty()
    if (isDirty) {
      throw new GitCleanWorkingTreeError(rootDir)
    }
  }
}


function addFiles(pkgGitRepo: PkgGitRepo, modMap: ModMap): Promise<void> {

  async function addOwnFiles() {
    for (let pkg of pkgGitRepo.pkgs) {
      if (modMap[pkg.dir]) {
        await pkgGitRepo.addFile(pkg.jsonPath) // wait because can't do concurrent write ops on same repo
      }
    }
  }

  async function addSubmoduleFiles() {
    return allSettledVoid(
      pkgGitRepo.submodules.map((submodule) => {
        return addFiles(submodule, modMap)
      })
    )
  }

  return allSettledVoid([
    addOwnFiles(),
    addSubmoduleFiles()
  ])
}


function resetFiles(pkgGitRepo: PkgGitRepo, modMap: ModMap): Promise<void> {

  async function resetOwnFiles() {
    for (let pkg of pkgGitRepo.pkgs) {
      if (modMap[pkg.dir]) {
        await pkgGitRepo.resetFile(pkg.jsonPath) // wait because can't do concurrent write ops on same repo
      }
    }
  }

  async function resetSubmoduleFiles() {
    return allSettledVoid(
      pkgGitRepo.submodules.map((submodule) => {
        return resetFiles(submodule, modMap)
      })
    )
  }

  return allSettledVoid([
    resetOwnFiles(),
    resetSubmoduleFiles()
  ])
}


/*
all files have already been added except for submodule refs
*/
async function commitFiles(
  pkgGitRepo: PkgGitRepo,
  modMap: ModMap,
  config: NpmVersionConfig,
  message: string,
  committedRepos: GitRepo[] // by reference. TODO: move away from this
): Promise<boolean> {
  let { submodules } = pkgGitRepo

  async function commitSubmodules() { // recursively commit submodule children, in parallel
    return allSettled(
      submodules.map((submodule) => {
        return commitFiles(submodule, modMap, config, message, committedRepos)
      })
    )
  }

  function hasOwnMods() {
    for (let pkg of pkgGitRepo.pkgs) {
      if (modMap[pkg.dir]) {
        return true
      }
    }
    return false
  }

  let isSubmodulesCommited = await commitSubmodules()
  let hasSubmoduleCommits = false

  // add each submodule reference
  for (let i = 0; i < submodules.length; i++) {
    if (isSubmodulesCommited[i]) {
      await pkgGitRepo.addFile(submodules[i].rootDir) // can only do one at a time
      hasSubmoduleCommits = true
    }
  }

  if (hasSubmoduleCommits || hasOwnMods()) {
    await pkgGitRepo.commit(message, config.gitCommitHooks, config.gitCommitArgs)
    committedRepos.push(pkgGitRepo)
    return true

  } else {
    return false
  }
}


// NPM UTILS
// ----------------------------------------------------------------------------------------------------


async function runNpmScripts(npmClient: AbstractNpmClient, modMap: ModMap, scriptName: string): Promise<void> {
  let pkgsWithScripts: Pkg[] = []

  for (let dir in modMap) {
    let pkg = modMap[dir].pkg

    if (pkg.hasScript(scriptName)) {
      pkgsWithScripts.push(pkg)
    }
  }

  // TODO: use EXEC utils somehow. not DRY like this
  let tasks = pkgsWithScripts.map((pkg: Pkg) => ({
    label: pkg.readableId() + ' (script(bump): ' + scriptName + ')',
    func() {
      return pkg.runScript(npmClient, scriptName, false) // bufferOutput=false
    }
  }))

  // better to do serial in case there are interactive command prompts
  // TODO: make a setting to toggle this?
  // TODO: if change, will need to switch bufferOutput above
  return runPrettySerial(tasks).catch(() => {
    throw new FailedNpmScript(scriptName)
  })
}


// COMMAND LINE UI
// ----------------------------------------------------------------------------------------------------


function outputMods(mods: Mod[], newVersion: string) {
  let lines = []

  for (let mod of mods) {
    let parts = []

    if (mod.directlyChanged) {
      parts.push('CHANGED')
    }

    if (mod.deps) {
      parts.push('DEPS-BUMPED')
    }

    lines.push(parts.join('/') + ' ' + (mod.pkg.readableId()))
  }

  lines.sort()

  console.log()
  console.log('Will bump the following packages to ' + newVersion + ':')
  console.log()

  for (let line of lines) {
    console.log('  ', line)
  }

  console.log()
}


async function confirmMods(mods: Mod[], newVersion: string) {
  outputMods(mods, newVersion)

  let answer = await prompts({
    name: 'ok',
    type: 'confirm',
    message: 'Is this okay?',
    initial: false
  })

  return answer.ok
}
