import { join as joinPaths } from 'path'
import { execLive, execBuffered } from '../util/exec'


export default class GitRepo {

  constructor(public rootDir: string) {
  }


  /*
  Run diff interactively without buffering
  */
  runDiff(pathMatches: string[], ignoreMatches: string[], gitArgs: string[] = []) {
    return this.execLive([ 'diff', ...gitArgs, '--', ...buildDiffFileArgs(pathMatches, ignoreMatches) ])
  }


  addFile(filePath: string, gitArgs: string[] = []) {
    return this.exec([ 'add', ...gitArgs, '--', filePath ])
  }


  resetFile(filePath: string, gitArgs: string[] = []) {
    return this.exec([ 'reset', ...gitArgs, '--', filePath ])
  }


  createTag(tagName: string, message: string, doSign: boolean, gitArgs: string[] = []) {
    return this.exec([ 'tag', doSign ? '-s' : '-a', tagName, '-m', message, ...gitArgs ])
  }


  commit(message: string, doHooks: boolean, gitArgs: string[] = []) {
    let cmd = [ 'commit', '-m', message ]

    if (!doHooks) {
      cmd.push('--no-verify')
    }

    cmd.push(...gitArgs)

    return this.exec(cmd)
  }


  /*
  ignoreFiles is an array of strings that can have globs
  */
  hasChangesSince(sinceCommit: string, pathMatches: string[] | null = null, ignoreMatches: string[] = [], gitArgs: string[] = []) {
    let cmd = [
      'diff', sinceCommit, '--name-only', '--ignore-submodules', ...gitArgs,
      '--', ...buildDiffFileArgs(pathMatches, ignoreMatches)
    ]

    return this.exec(cmd).then((output) => {
      return Boolean(output.trim())
    })
  }


  isDirty(gitArgs: string[] = []) {
    return this.exec([ 'status', '--porcelain', '--untracked-files=no', ...gitArgs ])
      .then((output) => Boolean(output.trim()))
  }


  /*
  help from:
  https://stackoverflow.com/a/16818141/96342
  */
  getTagUnderlyingHash(tagName: string): Promise<string> {
    return this.exec([ 'rev-parse', tagName + '^{}' ]).then((output) => {
      return output.trim()
    }, () => {
      return ''
    })
  }


  /*
  returns absolute dir paths
  */
  getSubmoduleDirs(): Promise<string[]> {
    return this.exec([ 'submodule' ]).then((output) => {
      output = output.trim()

      if (!output) {
        return []
      } else {
        return output.split(/[\n\r]+/g).map((line: string) => {
          let parts = line.trim().split(/\s+/g)
          let relDir = parts[1]

          if (relDir) {
            return joinPaths(this.rootDir, relDir)
          } else {
            return ''
          }
        })
      }
    })
  }


  getSubmoduleCommit(parentCommit: string, submoduleDir: string): Promise<string> {
    return this.exec([ 'ls-tree', parentCommit, '--', submoduleDir ]).then((output) => {
      let parts = output.trim().split(/\s+/g)
      return parts[2] || ''
    }, () => {
      return '' // submodule didnt exist at that point? return blank string
    })
  }


  exec(cmd: string[]) {
    return execBuffered([ 'git' ].concat(cmd), this.rootDir)
  }


  execLive(cmd: string[]) {
    return execLive([ 'git' ].concat(cmd), this.rootDir)
  }

}


/*
https://stackoverflow.com/questions/957928/is-there-a-way-to-get-the-git-root-directory-in-one-command
*/
export function getRepoRootDir(currentDir: string): Promise<string> {
  return execBuffered([ 'git', 'rev-parse', '--show-toplevel' ], currentDir)
    .then(
      (output) => output.trim(),
      () => '' // no git repo root? return blank string
    )
}


export async function getDirIsRepoRoot(rootDir: string) {
  return (await getRepoRootDir(rootDir)) === rootDir
}


function buildDiffFileArgs(pathMatches: string[] | null, ignoreMatches: string[]) {
  let args = []

  if (pathMatches === null) {
    args.push('.') // all
  } else {
    for (let pathMatch of pathMatches) {
      args.push(':' + pathMatch)
    }
  }

  for (let ignoreMatch of ignoreMatches) {
    args.push(':!' + ignoreMatch)
  }

  return args
}
