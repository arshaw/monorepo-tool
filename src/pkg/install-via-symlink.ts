import { runPrettyParallel, PrettyTask } from '../util/pretty-task'
import MonoRepo from '../MonoRepo'
import InnerPkg from './InnerPkg'
import { writeNeededSymlinksForPkg } from './symlink'
import { removeDepEntries } from './dep-json-fs'
import { runPkgInstall } from './install-utils'


export function installPkgsViaSymlink(pkgs: InnerPkg[], monoRepo: MonoRepo, doRoot: boolean, forceCi: boolean, npmRunTimeArgs: string[]) {

  let tasks: PrettyTask[] = pkgs.map((pkg) => ({
    label: pkg.readableId(),
    func() {
      return installPkgViaSymlink(pkg, monoRepo, forceCi, npmRunTimeArgs)
    }
  }))

  if (doRoot && monoRepo.rootPkg) {
    tasks.unshift({ // unshift puts it at beginning
      label: 'root',
      func() {
        return runPkgInstall(monoRepo, monoRepo.rootPkg!, forceCi, npmRunTimeArgs)
      }
    })
  }

  return runPrettyParallel(tasks)
}


/*
TODO: put in parody with `execNpmTask` ?
*/
async function installPkgViaSymlink(pkg: InnerPkg, monoRepo: MonoRepo, forceCi: boolean, npmRunTimeArgs: string[]): Promise<string> {
  let { innerPkgsByName } = monoRepo

  // remove internal references temporarily because NPM will choke
  let undoJsonTransform = await removeDepEntries(pkg, innerPkgsByName)

  return runPkgInstall(monoRepo, pkg, forceCi, npmRunTimeArgs)
    .finally(undoJsonTransform)
    .then(async (installOutput) => {

      // defacto-npm kills all linked packages after almost any action. restore
      await writeNeededSymlinksForPkg(pkg, innerPkgsByName)

      return installOutput
    })
}
