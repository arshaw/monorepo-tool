import { dirname } from 'path'
import { pathIsRoot } from './util/path'
import { extractPositionalArg, extractNamedFlag, peakPositionalArg, extractPositionalArgs, argsAreHelp } from './util/arg-parse'
import { CmdNotFoundError } from './errors'
import { showHelp } from './help'
import MonoRepo from './MonoRepo'
import { hashPkgsByDir } from './pkg/Pkg'
import InnerPkg from './pkg/InnerPkg'
import { installPkgsViaSymlink } from './pkg/install-via-symlink'
import { installPkgsViaLocalPath } from './pkg/install-via-localpath'
import { writeNeededSymlinksForPkgs } from './pkg/symlink'
import { bumpVersionsWithPrompt, prepareVersionBump } from './pkg/version-bump'
import { changedPkgsSincePoint } from './pkg/changed'
import { runDiff } from './pkg/diff'
import { addDepsToPkgs } from './pkg/add'
import { removeDepsFromPkgs } from './pkg/remove'
import { ensureMonoRepoHealth } from './pkg/check'
import { publishPkgsWithPrompt, preparePublish } from './pkg/publish'
import { runScriptInPkgs, execInPkgs } from './pkg/exec'
import { listPkgs } from './pkg/list'
import { removeAllPkgDepFiles } from './pkg/dep-file-rm'


export async function handleCmd(monoRepo: MonoRepo, subjectPkgs: InnerPkg[], args: string[], cwd: string, callerCmd: string): Promise<void> {
  let { npmClient } = monoRepo

  let alreadyInstalledRoot = callerCmd === 'install' || callerCmd === 'ci'
  let forceCi = callerCmd === 'ci'
  let cmd = args.shift() || ''

  // process command aliases
  if (cmd === 'install') {
    if (peakPositionalArg(args)) {
      cmd = 'add'
    }
  } else if (cmd === 'uninstall') {
    if (peakPositionalArg(args)) {
      cmd = 'remove'
    }
  } else if (cmd === 'ci') {
    cmd = 'install'
    forceCi = true
  }

  let cmdFuncs: { [cmd: string]: () => any } = {
    install() {
      ensureMonoRepoHealth(monoRepo)
      let doCopy = extractNamedFlag(args, 'copy-pkgs', false)
      let installFunc = doCopy ? installPkgsViaLocalPath : installPkgsViaSymlink
      return installFunc(subjectPkgs, monoRepo, !alreadyInstalledRoot, forceCi, args)
    },
    link() {
      ensureMonoRepoHealth(monoRepo)
      return writeNeededSymlinksForPkgs(subjectPkgs, monoRepo.innerPkgsByName)
    },
    add: async () => {
      ensureMonoRepoHealth(monoRepo)
      subjectPkgs = scopePkgsToDir(subjectPkgs, cwd)
      let pkgAddArgs = extractPositionalArgs(args)
      let pkgAddConfigs = await npmClient.queryAddConfig(args.slice(), monoRepo.rootDir)
      return addDepsToPkgs(monoRepo, subjectPkgs, pkgAddArgs, args, pkgAddConfigs)
    },
    remove() {
      ensureMonoRepoHealth(monoRepo)
      subjectPkgs = scopePkgsToDir(subjectPkgs, cwd)
      let pkgRemoveArgs = extractPositionalArgs(args)
      return removeDepsFromPkgs(monoRepo, subjectPkgs, pkgRemoveArgs, args)
    },
    check() {
      ensureMonoRepoHealth(monoRepo)
    },
    clean() {
      return removeAllPkgDepFiles(monoRepo.rootPkg, subjectPkgs)
    },
    version: async () => {
      // ensureMonoRepoHealth ?
      let versionConfig = await npmClient.queryVersionConfig(args, monoRepo.rootDir)
      let skipPrompt = extractNamedFlag(args, 'yes')
      let forceAllPkgs = extractNamedFlag(args, 'all-pkgs', false) // TODO: keep this flag?

      if (skipPrompt) {
        let prep = await prepareVersionBump(monoRepo, subjectPkgs, versionConfig, forceAllPkgs)
        if (prep) {
          return prep.execute()
        }
      } else {
        return bumpVersionsWithPrompt(monoRepo, subjectPkgs, versionConfig, forceAllPkgs)
      }
    },
    publish: async () => {
      let skipPrompt = extractNamedFlag(args, 'yes')

      if (skipPrompt) {
        let prep = await preparePublish(monoRepo, subjectPkgs, args)
        return prep.execute()
      } else {
        return publishPkgsWithPrompt(monoRepo, subjectPkgs, args)
      }
    },
    list() {
      listPkgs(subjectPkgs)
    },
    changed() {
      let versionish = extractPositionalArg(args) || ''
      return changedPkgsSincePoint(monoRepo, subjectPkgs, versionish, args).then((pkgs) => {
        listPkgs(pkgs)
      })
    },
    diff() {
      let versionish = extractPositionalArg(args) || ''
      return runDiff(monoRepo, subjectPkgs, versionish, args)
    },
    exec() {
      let isParallel = extractNamedFlag(args, 'parallel', true)
      return execInPkgs(monoRepo, subjectPkgs, isParallel, args)
    },
    run() {
      let isParallel = extractNamedFlag(args, 'parallel', true)
      return runScriptInPkgs(monoRepo, subjectPkgs, isParallel, args)
    }
  }

  let cmdFunc = cmdFuncs[cmd]

  if (cmdFunc) {
    if (argsAreHelp(args)) {
      return showHelp(cmd)
    } else {
      return cmdFunc()
    }
  } else {
    throw new CmdNotFoundError(cmd)
  }
}


function scopePkgsToDir(pkgs: InnerPkg[], dir: string): InnerPkg[] {
  let pkgsByDir = hashPkgsByDir(pkgs)

  do {
    if (pkgsByDir[dir]) { // within a pkg's dir
      return [ pkgsByDir[dir] ] // return single package
    }

    dir = dirname(dir)
  } while (!pathIsRoot(dir))

  return pkgs // not within a pkg's dir. return all pkgs
}
