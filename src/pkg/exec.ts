import { execBuffered, execLive } from '../util/exec'
import { runPrettyParallel, runPrettySerial } from '../util/pretty-task'
import MonoRepo from '../MonoRepo'
import InnerPkg from './InnerPkg'


export function runScriptInPkgs(monoRepo: MonoRepo, pkgs: InnerPkg[], isParallel: boolean, npmRunTimeArgs: string[]): Promise<void> {
  let npmRunArgs = monoRepo.getCmdNpmArgs('run')

  return execCmdsInPkgs(
    pkgs.map((pkg) => monoRepo.npmClient.buildRunCmd(npmRunArgs.concat(pkg.npmClientArgs, npmRunTimeArgs))),
    pkgs,
    isParallel
  )
}


export function execInPkgs(monoRepo: MonoRepo, pkgs: InnerPkg[], isParallel: boolean, npmRunTimeArgs: string[]): Promise<void> {
  let npmExecArgs = monoRepo.getCmdNpmArgs('exec')

  return execCmdsInPkgs(
    pkgs.map((pkg) => monoRepo.npmClient.buildExecCmd(npmExecArgs.concat(pkg.npmClientArgs, npmRunTimeArgs))),
    pkgs,
    isParallel
  )
}


function execCmdsInPkgs(cmds: string[][], pkgs: InnerPkg[], isParallel: boolean) {

  let tasks = pkgs.map((pkg, i) => ({
    label: pkg.readableId(),
    func() {
      return isParallel
        ? execBuffered(cmds[i], pkg.dir)
        : execLive(cmds[i], pkg.dir)
    }
  }))

  return isParallel ? runPrettyParallel(tasks) : runPrettySerial(tasks)
}
