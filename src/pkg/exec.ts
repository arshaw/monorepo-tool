import { quote } from 'shell-quote'
import { execBuffered, execLive } from '../util/exec'
import { runPrettyParallel, runPrettySerial, PrettyTask } from '../util/pretty-task'
import MonoRepo from '../MonoRepo'
import InnerPkg from './InnerPkg'
import { log } from '../util/log'


export function runScriptInPkgs(monoRepo: MonoRepo, pkgs: InnerPkg[], isParallel: boolean, runArgs: string[]): Promise<void> {
  // let npmRunArgs = monoRepo.getCmdNpmArgs('run') // TODO: somehow pass these in

  let scriptName = runArgs[0] // TODO: handle other runArgs
  let tasks: PrettyTask[] = []

  for (let pkg of pkgs) {
    let cmd = pkg.buildScriptCmd(monoRepo.npmClient, scriptName)

    if (cmd) {
      tasks.push({
        label: pkg.readableId() + ' (script(run): ' + scriptName + ')',
        func() {
          return isParallel
            ? execBuffered(cmd!, pkg.dir)
            : execLive(cmd!, pkg.dir)
        }
      })
    }
  }

  return isParallel ? runPrettyParallel(tasks) : runPrettySerial(tasks)
}


export function execInPkgs(monoRepo: MonoRepo, pkgs: InnerPkg[], isParallel: boolean, cmd: string[]): Promise<void> {
  // let npmExecArgs = monoRepo.getCmdNpmArgs('exec') // dont want in exec command
  // nor pkg.npmClientArgs

  log('execInPkgs', cmd)

  let tasks = pkgs.map((pkg) => ({
    label: pkg.readableId() + '(exec: ' + cmd.join(' ') + ')',
    func() {
      let filteredCmd = monoRepo.npmClient.buildExecCmd(quote(cmd)) // with correct path and whatnot

      return isParallel
        ? execBuffered(filteredCmd, pkg.dir)
        : execLive(filteredCmd, pkg.dir)
    }
  }))

  return isParallel ? runPrettyParallel(tasks) : runPrettySerial(tasks)
}
