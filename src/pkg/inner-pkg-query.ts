import { promisify } from 'util'
import * as fs from 'fs'
import { join as joinPaths } from 'path'
import * as globCb from 'glob'
import { collectResults } from '../util/async'
import InnerPkg, { InnerPkgConfig } from './InnerPkg'
const glob = promisify(globCb)
const fileExists = promisify(fs.exists)


export function queryInnerPkgs(condensedConfigs: InnerPkgConfig[], baseDir: string): Promise<InnerPkg[]> {
  return expandPkgConfigs(condensedConfigs, baseDir).then((expandedConfigs) => {
    return collectResults(
      expandedConfigs.map((pkgConfig) => {
        return fileExists(
          joinPaths(baseDir, pkgConfig.path, 'package.json')
        ).then((bool) => {
          if (bool) {
            let pkg = new InnerPkg(pkgConfig, baseDir)
            return pkg.loadJson().then(() => [ pkg ])
          } else {
            return []
          }
        })
      })
    )
  })
}


function expandPkgConfigs(pkgConfigs: InnerPkgConfig[], baseDir: string): Promise<InnerPkgConfig[]> {
  return collectResults(
    pkgConfigs.map((pkgConfig) => {
      return expandPkgConfig(pkgConfig, baseDir)
    })
  )
}


function expandPkgConfig(pkgConfig: InnerPkgConfig, baseDir: string): Promise<InnerPkgConfig[]> {
  return glob(pkgConfig.path, {
    cwd: baseDir
  }).then((paths: string[]) => {
    return paths.map((path) => {
      return Object.assign({}, pkgConfig, { path })
    })
  })
}
