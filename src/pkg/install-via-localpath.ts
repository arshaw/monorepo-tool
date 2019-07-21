import { runPrettyParallel } from '../util/pretty-task'
import { runParallel, allSettled } from '../util/async'
import MonoRepo from '../MonoRepo'
import InnerPkg from './InnerPkg'
import { addDepEntries } from './dep-json-fs'
import { filterDeps } from './dep-objs'
import { relative as relativizePath } from 'path'
import { runPkgInstall } from './install-utils'


export function installPkgsViaLocalPath(pkgs: InnerPkg[], monoRepo: MonoRepo, doRoot: boolean, forceCi: boolean, npmRunTimeArgs: string[]) {
  let { innerPkgsByName } = monoRepo
  let undoTransformFuncs: (() => Promise<void>)[] = []

  let transformPromises = monoRepo.innerPkgs.map(async (pkg) => { // to ALL packages
    let undo = await addDepEntries(pkg, transformToLocalePaths(pkg.jsonData, innerPkgsByName))
    undoTransformFuncs.push(undo)
  })

  let installTasks = pkgs.map((pkg) => ({
    label: pkg.readableId(),
    func: async () => {
      return runPkgInstall(monoRepo, pkg, forceCi, npmRunTimeArgs)
    }
  }))

  if (doRoot && monoRepo.rootPkg) {
    installTasks.unshift({ // unshift puts it at beginning
      label: 'root',
      func: () => {
        return runPkgInstall(monoRepo, monoRepo.rootPkg!, forceCi, npmRunTimeArgs)
      }
    })
  }

  function undoTransforms() {
    return runParallel(undoTransformFuncs)
  }

  return allSettled(transformPromises).then(() => { // wait to transform ALL package.json's...
    return runPrettyParallel(installTasks) // and THEN run installs
  }).finally(undoTransforms) // and then undo all package.json transforms
}


function transformToLocalePaths(subjectPkg: InnerPkg, innerPkgsByName: { [pkgName: string]: InnerPkg }) {

  return filterDeps(subjectPkg.jsonData, (pkgName, versionRange) => {
    let innerPkg = innerPkgsByName[pkgName]

    if (innerPkg) {
      return 'file:' + relativizePath(subjectPkg.dir, innerPkg.dir)

    } else { // an external package. keep as-is
      return versionRange
    }
  })
}
