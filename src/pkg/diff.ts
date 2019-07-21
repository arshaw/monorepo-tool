import { VersionishNotFoundError } from '../errors'
import { extractNamedFlag } from '../util/arg-parse'
import PkgGitRepo, { buildPkgGitRepo } from '../git/PkgGitRepo'
import MonoRepo from '../MonoRepo'
import InnerPkg from './InnerPkg'
import { resolveVersionish } from './version-utils'


/*
KNOWN ISSUE: when diffing from subrepos, doesn't use pager.
TODO: detect if in an interactive shell...
  https://stackoverflow.com/questions/7080458/test-whether-the-actual-output-is-a-terminal-or-not-in-node-js
  and then concat outputs togther, forcing color, into node-pager (can't use pure bash)
*/
export async function runDiff(monoRepo: MonoRepo, subjectPkgs: InnerPkg[], versionish: string, otherGitArgs: string[]) {

  let commitHash: string = await resolveVersionish(monoRepo, subjectPkgs, versionish)
  if (!commitHash) {
    throw new VersionishNotFoundError(versionish)
  }

  let pkgGitRepo = await buildPkgGitRepo<InnerPkg>(monoRepo.rootDir, subjectPkgs)

  // put the commit hash as first arg
  let gitArgs = otherGitArgs.slice()
  gitArgs.unshift(commitHash) // put at beginning

  // any nesting?
  // can't do pager because we need to do multuple `git diff` commands
  if (pkgGitRepo.submodules.length) {
    extractNamedFlag(gitArgs, 'pager') // will extract --no-pager too
    gitArgs.push('--no-pager')
  }

  return runDiffOnRepo(pkgGitRepo, gitArgs)
}


async function runDiffOnRepo(pkgGitRepo: PkgGitRepo<InnerPkg>, gitArgs: string[]): Promise<void> {
  let ignoreMatches: string[] = []

  for (let pkg of pkgGitRepo.pkgs) {
    ignoreMatches.push(...pkg.ignoreFiles)
  }

  await pkgGitRepo.runDiff( // is a passthrough
    pkgGitRepo.pkgs.map((pkg) => pkg.relDir),
    ignoreMatches,
    gitArgs
  )

  for (let submodule of pkgGitRepo.submodules) {
    await runDiffOnRepo(submodule, gitArgs)
  }
}
