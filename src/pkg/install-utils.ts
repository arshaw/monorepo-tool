import { execBuffered } from '../util/exec'
import MonoRepo from '../MonoRepo'
import Pkg from './Pkg'


export function runPkgInstall(
  monoRepo: MonoRepo,
  pkg: Pkg,
  forceCi: boolean,
  npmRunTimeArgs: string[],
  ignoreScripts: boolean
) {
  let { npmClient } = monoRepo

  let npmArgs = monoRepo.getCmdNpmArgs('install').concat(
    pkg.npmClientArgs,
    npmRunTimeArgs,
    ignoreScripts ? [ npmClient.ignoreScriptsFlag ] : []
  )

  let cmd = npmClient.buildInstallCmd(forceCi, npmArgs)

  return execBuffered(cmd, pkg.dir)
}
