import { NoRepoRootError } from '../errors'
import GitRepo, { getRepoRootDir, getDirIsRepoRoot } from './GitRepo'
import Pkg from '../pkg/Pkg'


/*
Represents a git repo that contains one or more *packages* and one or more git *submodules*.
Shouln't be instantiated directly :( Use buildPkgGitRepo instead
*/
export default class PkgGitRepo<PkgType extends Pkg = Pkg> extends GitRepo {

  pkgs: PkgType[] = []
  submodules: PkgGitRepo<PkgType>[] = []


  async loadSubmodules() {
    let submoduleDirs = await this.getSubmoduleDirs()
    this.submodules = submoduleDirs.map((dir) => new PkgGitRepo(dir))
  }


  populatePkgs(pkgsByGitDir: { [dir: string]: PkgType[] }) {
    let ownPkgs = pkgsByGitDir[this.rootDir]

    if (ownPkgs) {
      this.pkgs = ownPkgs
    }

    for (let submodule of this.submodules) {
      submodule.populatePkgs(pkgsByGitDir)
    }
  }

}


export function buildPkgGitRepo<PkgType extends Pkg = Pkg>(rootDir: string, pkgs: PkgType[]): Promise<PkgGitRepo<PkgType>> {
  let pkgGitRepo = new PkgGitRepo<PkgType>(rootDir)

  return Promise.all([
    getDirIsRepoRoot(rootDir),
    getPkgsByGitDir(pkgs),
    pkgGitRepo.loadSubmodules()
  ]).then(([ isRepoRoot, pkgsByGitDir ]) => {
    if (isRepoRoot) {
      pkgGitRepo.populatePkgs(pkgsByGitDir)
      return pkgGitRepo
    } else {
      throw new NoRepoRootError(rootDir)
    }
  })
}


/*
TODO: more consistent ordering
*/
function getPkgsByGitDir<PkgType extends Pkg = Pkg>(pkgs: PkgType[]) {
  let pkgsByGitDir: { [dir: string]: PkgType[] } = {}
  let promises = []

  for (let pkg of pkgs) {
    promises.push(
      getRepoRootDir(pkg.dir).then((gitDir) => {
        ;(pkgsByGitDir[gitDir] || (pkgsByGitDir[gitDir] = []))
          .push(pkg)
      })
    )
  }

  return Promise.all(promises).then(() => pkgsByGitDir)
}
