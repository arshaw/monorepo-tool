import { execBuffered } from '../util/exec'
import MonoRepo from '../MonoRepo'
import Pkg from './Pkg'


export function runPkgInstall(monoRepo: MonoRepo, pkg: Pkg, forceCi: boolean, npmRunTimeArgs: string[]) {

  let npmArgs = pkg.npmClientArgs.concat(
    monoRepo.getCmdNpmArgs('install'),
    npmRunTimeArgs
  )

  let cmd = monoRepo.npmClient.buildInstallCmd(forceCi, npmArgs)

  return execBuffered(cmd, pkg.dir)
}
