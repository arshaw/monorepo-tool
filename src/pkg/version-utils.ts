import MonoRepo from "../MonoRepo";
import InnerPkg from "./InnerPkg";
import GitRepo from "../git/GitRepo";
import Pkg from "./Pkg";
import * as semver from 'semver'


/*
Accepts something that identifies a version: a version number, a git tag of verion number, or a git commit hash.
Returns a git commit hash.
*/
export async function resolveVersionish(monoRepo: MonoRepo, subjectPkgs: InnerPkg[], versionish: string): Promise<string> {
  let commitHash: string = ''

  if (!versionish) {
    versionish = computeBaseVersion(monoRepo.rootPkg, subjectPkgs)

    if (!versionish) {
      return ''
    }
  }

  let tagPrefix = await monoRepo.npmClient.queryGitTagPrefix(monoRepo.rootDir)
  let gitRepo = new GitRepo(monoRepo.rootDir)

  if (tagPrefix) {
    commitHash = await gitRepo.getTagUnderlyingHash(tagPrefix + versionish)
  }

  if (!commitHash) {
    commitHash = await gitRepo.getTagUnderlyingHash(versionish) // second call of getTagUnderlyingHash?
  }

  return commitHash
}


export function computeBaseVersion(rootPkg: Pkg | null, subjectPkgs: Pkg[]): string {

  if (rootPkg && rootPkg.jsonData.version) {
    return rootPkg.jsonData.version
  }

  return computeHighestVersion(subjectPkgs)
}


function computeHighestVersion(pkgs: Pkg[]): string {
  let versions: string[] = []

  for (let pkg of pkgs) {
    let version = pkg.jsonData.version

    if (version) {
      versions.push(version)
    }
  }

  if (versions.length) {
    versions.sort(semver.rcompare)

    return versions[0]
  }

  return ''
}
