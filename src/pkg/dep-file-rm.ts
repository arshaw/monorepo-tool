import { promisify } from 'util'
import Pkg from './Pkg'
import InnerPkg from './InnerPkg'
import { allSettledVoid } from '../util/async'
import { join as joinPaths } from 'path'
import * as rimrafCb from 'rimraf'
import { mapHashToArray } from '../util/hash';
const rimraf = promisify(rimrafCb)


/*
TODO: really slow. somehow call native `rm -rf` shell portably. shelljs?
*/
export async function removeAllPkgDepFiles(rootPkg: Pkg | null, subjectPkgs: InnerPkg[]) {
  let pkgs = (rootPkg ? [ rootPkg ] : []).concat(subjectPkgs)

  return allSettledVoid(
    pkgs.map((pkg) => {
      return rimraf(
        joinPaths(pkg.dir, 'node_modules')
      )
    })
  )
}


export function removeExactPkgDepFiles(subjectPkg: Pkg, innerPkgsByName: { [pkgName: string]: InnerPkg }) {
  return allSettledVoid(
    mapHashToArray(innerPkgsByName, (pkg, pkgName) => {
      return removePkgDepFile(subjectPkg, pkgName)
    })
  )
}


export async function removePkgDepFile(subjectPkg: Pkg, refPkgName: string): Promise<void> {
  let refPath = joinPaths(subjectPkg.dir, 'node_modules', refPkgName)

  await rimraf(refPath)
}
