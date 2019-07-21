#!/usr/bin/env node

/// <reference path='./type-hacks.d.ts' />

import { join as joinPaths } from 'path'
import chalk from 'chalk'
import { log, enableLogging } from './util/log'
import { extractNamedVals, argsAreHelp, argsAreVersion } from './util/arg-parse'
import { handleCmd } from './cmds'
import { LibError } from './errors'
import { showHelp } from './help'
import MonoRepo, { queryMonoRepoWithDir } from './MonoRepo'
import { filterPkgs } from './pkg/filter'


// Debugging
// ----------------------------------------------------------------------------------------------------

let debugVal = process.env.DEBUG // TODO: use NODE_ENV?

if (debugVal) {
  require('source-map-support').install()

  if (debugVal === 'verbose') {
    enableLogging()
  }
}


// Process Misc
// ----------------------------------------------------------------------------------------------------

function handleError(error: Error) {
  console.error()

  if (error instanceof LibError) {
    console.error(chalk.red('FAILURE'), error.message)

    if (debugVal) {
      console.error()
      console.error(error)
    }
  } else {
    console.error(error) // output everything
  }

  console.error()
  process.exit(1)
}

process.on('uncaughtException', handleError)

// for some reason, we need to attach a handler in order for a SIGINT to kill child processes
process.on('SIGINT', () => {})


// Main Execution, Arg Processing
// ----------------------------------------------------------------------------------------------------

let cwd = process.cwd()
let args = process.argv.slice(2)

if (argsAreHelp(args)) {
  showHelp('main')

} else if (argsAreVersion(args)) {
  let libVersion = require(joinPaths(__dirname, '../../package.json')).version
  console.log(libVersion)

} else {
  let pkgArgs = extractNamedVals(args, 'pkgs')
  let pkgFilterArgs = extractNamedVals(args, 'filter-pkgs')
  let pkgExcludeArgs = extractNamedVals(args, 'exclude-pkgs')

  queryMonoRepoWithDir(cwd).then((monoRepo: MonoRepo) => {
    let subjectPkgs = filterPkgs(monoRepo.innerPkgs, pkgArgs, pkgFilterArgs, pkgExcludeArgs)
    return handleCmd(monoRepo, subjectPkgs, args, cwd, getCallerNpmCmd())

  }).then(() => {
    log('exited with no errors')
  }, handleError)
}


// NPM Utils
// ----------------------------------------------------------------------------------------------------

function getCallerNpmCmd(): string {
  let infoStr = process.env.npm_config_argv

  if (infoStr) {
    let info = JSON.parse(infoStr)
    return info.original[0]
  }

  return ''
}
