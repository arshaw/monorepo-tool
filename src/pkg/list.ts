import Pkg from './Pkg'

export function listPkgs(pkgs: Pkg[]) {
  for (let pkg of pkgs) {
    console.log(pkg.readableId())
  }
}
