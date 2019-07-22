import { promisify } from 'util'
import * as fs from 'fs'
import { join as joinPaths, dirname, relative as relativizePath } from 'path'
import * as mkdirpCb from 'mkdirp'
import { mapHashToArray } from '../util/hash'
import { allSettledVoid } from '../util/async'
import { log } from '../util/log'
import Pkg from './Pkg'
import InnerPkg from './InnerPkg'
import { mapInstallableDeps, depsToFlags } from './dep-objs'
import { removePkgDepFile } from './dep-file-rm'
const mkdirp = promisify(mkdirpCb)
const fileExists = promisify(fs.exists)
const copyFile = promisify(fs.copyFile)
const symlink = promisify(fs.symlink)


export function writeNeededSymlinksForPkgs(subjectPkgs: Pkg[], innerPkgsByName: { [pkgName: string]: InnerPkg }) {
  return allSettledVoid(
    subjectPkgs.map((subjectPkg) => writeNeededSymlinksForPkg(subjectPkg, innerPkgsByName))
  )
}


/*
will only write the symlinks that the package actually uses
*/
export function writeNeededSymlinksForPkg(subjectPkg: Pkg, innerPkgsByName: { [pkgName: string]: InnerPkg }) {
  let flags = depsToFlags(subjectPkg.jsonData)

  return allSettledVoid(
    mapHashToArray(flags, (pkgVersionRange, pkgName) => {
      if (innerPkgsByName[pkgName]) {
        return writePkgSymlink(subjectPkg, pkgName, innerPkgsByName[pkgName])
      } else {
        return Promise.resolve()
      }
    })
  )
}


export function writeExactSymlinksForPkg(subjectPkg: Pkg, addInnerPkgsByName: { [pkgName: string]: InnerPkg }) {
  return allSettledVoid(
    mapHashToArray(addInnerPkgsByName, (pkg, pkgName) => {
      return writePkgSymlink(subjectPkg, pkgName, pkg)
    })
  )
}


export async function writePkgSymlink(subjectPkg: Pkg, otherPkgName: string, otherPkg: InnerPkg) {
  await removePkgDepFile(subjectPkg, otherPkgName) // clear the old file

  // the symlink file itself
  let linkFile = joinPaths(subjectPkg.dir, 'node_modules', otherPkgName)
  let linkDir = dirname(linkFile)

  await mkdirp(linkDir)

  let targetDir = otherPkg.distDir || otherPkg.dir
  log('writing symlink to', otherPkg.readableId(), targetDir)

  // ensure the pointed-do package has a package.json
  if (otherPkg.distDir) {
    let distJsonPath = joinPaths(targetDir, 'package.json')
    let distJsonExists = await fileExists(distJsonPath)

    if (!distJsonExists) {
      let origJsonPath = joinPaths(otherPkg.dir, 'package.json')

      await mkdirp(targetDir)
      await copyFile(origJsonPath, distJsonPath)
    }
  }

  let relTarget = relativizePath(linkDir, targetDir)

  log('writing link', linkFile, 'content:', relTarget)
  await symlink(relTarget, linkFile)
}
