import { join as joinPaths } from 'path'
import { VersionishNotFoundError } from '../errors'
import { extractNamedFlag } from '../util/arg-parse'
import PkgGitRepo, { buildPkgGitRepo } from '../git/PkgGitRepo'
import MonoRepo from '../MonoRepo'
import InnerPkg from './InnerPkg'
import { resolveVersionish, computeBaseVersion } from './version-utils'


/*
KNOWN ISSUE: when diffing from subrepos, doesn't use pager.
TODO: detect if in an interactive shell...
  https://stackoverflow.com/questions/7080458/test-whether-the-actual-output-is-a-terminal-or-not-in-node-js
  and then concat outputs togther, forcing color, into node-pager (can't use pure bash)
*/
export async function runDiff(monoRepo: MonoRepo, subjectPkgs: InnerPkg[], versionish: string, otherGitArgs: string[]) {

  if (!versionish) {
    versionish = computeBaseVersion(monoRepo.rootPkg, subjectPkgs)
    // TODO: if fails, error should talk about the git tag not found
  }

  let commitHash: string = await resolveVersionish(monoRepo, subjectPkgs, versionish) // TODO: pass-in pkgGitRepo?
  if (!commitHash) {
    throw new VersionishNotFoundError(versionish)
  }

  let pkgGitRepo = await buildPkgGitRepo<InnerPkg>(monoRepo.rootDir, subjectPkgs)

  return runDiffOnRepo(
    pkgGitRepo,
    commitHash,
    otherGitArgs,
    !pkgGitRepo.submodules.length // can't do pager because we need to do multiple `git diff` commands
  )
}


async function runDiffOnRepo(pkgGitRepo: PkgGitRepo<InnerPkg>, commitHash: string, otherGitArgs: string[], doPager: boolean): Promise<void> {
  let ignoreMatches: string[] = []

  for (let pkg of pkgGitRepo.pkgs) {
    for (let ignoreFile of pkg.ignoreFiles) {
      ignoreMatches.push(
        joinPaths(pkg.relDir, ignoreFile)
      )
    }
  }

  await pkgGitRepo.runDiff( // is a passthrough
    pkgGitRepo.pkgs.map((pkg) => pkg.relDir),
    ignoreMatches,
    [ commitHash ].concat(otherGitArgs),
    doPager
  )

  for (let submodule of pkgGitRepo.submodules) {
    let submoduleCommitHash = await pkgGitRepo.getSubmoduleCommit(commitHash, submodule.rootDir)

    // means this subrepo didn't exist at time of the tag
    // TODO: reevaluate if this is correct behavior. should everything instead?
    if (submoduleCommitHash) {
      await runDiffOnRepo(submodule, submoduleCommitHash, otherGitArgs, doPager)
    }
  }
}
