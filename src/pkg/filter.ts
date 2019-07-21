import * as minimatch from 'minimatch'
import InnerPkg from './InnerPkg'


export function filterPkgs(
  pkgs: InnerPkg[],
  explicits: string[],
  filters: string[],
  excludes: string[]
): InnerPkg[] {

  if (explicits.length) {
    pkgs = pkgs.filter((pkg) => matchesExplicits(pkg, explicits))
  }

  if (filters.length) {
    pkgs = pkgs.filter((pkg) => matchesFilters(pkg, filters))
  }

  pkgs = pkgs.filter((pkg) => !matchesFilters(pkg, excludes))

  return pkgs
}


function matchesExplicits(pkg: InnerPkg, explicits: string[]) {

  for (let explicit of explicits) {
    let pkgName = pkg.jsonData.name

    if (
      pkgName === explicit ||
      pkg.relDir === explicit
    ) {
      return true
    }
  }

  return false
}


function matchesFilters(pkg: InnerPkg, filters: string[]) {

  for (let filter of filters) {
    let pkgName = pkg.jsonData.name

    if (
      pkgName && minimatch(pkg.jsonData.name, filter) ||
      minimatch(pkg.relDir, filter)
    ) {
      return true
    }
  }

  return false
}
