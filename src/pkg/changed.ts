import { join as joinPaths } from 'path'
import { VersionishNotFoundError } from '../errors'
import MonoRepo from '../MonoRepo'
import Pkg from './Pkg'
import PkgGitRepo, { buildPkgGitRepo } from '../git/PkgGitRepo'
import InnerPkg from './InnerPkg'
import { resolveVersionish } from './version-utils'
import { collectResults } from '../util/async'


export async function changedPkgsSincePoint( // TODO: rename from "point"
  monoRepo: MonoRepo,
  subjectPkgs: InnerPkg[],
  versionish: string,
  gitDiffArgs: string[]
): Promise<Pkg[]> {
  let commitHash: string = await resolveVersionish(monoRepo, subjectPkgs, versionish)

  if (!commitHash) {
    if (versionish) {
      throw new VersionishNotFoundError(versionish)
    } else {
      return subjectPkgs // no version yet. return all pkgs
    }
  }

  let pkgGitRepo = await buildPkgGitRepo<InnerPkg>(monoRepo.rootDir, subjectPkgs)

  return getChangedRepoPkgs(pkgGitRepo, commitHash, gitDiffArgs)
}


async function getChangedRepoPkgs(pkgGitRepo: PkgGitRepo<InnerPkg>, commitHash: string, otherGitArgs: string[]): Promise<InnerPkg[]> {

  let ownPromises = pkgGitRepo.pkgs.map((pkg) => {
    let ignoresFromRepoRoot = pkg.ignoreFiles.map((ignoreFile) => joinPaths(pkg.relDir, ignoreFile))
    return pkgGitRepo.hasChangesSince(commitHash, [ pkg.relDir ], ignoresFromRepoRoot, otherGitArgs)
      .then((bool) => bool ? [ pkg ] : [])
  })

  let subPromises = pkgGitRepo.submodules.map((submodule) => {
    return pkgGitRepo.getSubmoduleCommit(commitHash, submodule.rootDir).then((subCommit) => {
      if (subCommit) {
        return getChangedRepoPkgs(submodule, subCommit, otherGitArgs)
      } else { // when no associated commit for submodule, means it didnt exist, so its new
        return submodule.pkgs
      }
    })
  })

  return collectResults(ownPromises.concat(subPromises))
}
