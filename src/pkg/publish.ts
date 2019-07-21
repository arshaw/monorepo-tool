import * as prompts from 'prompts'
import { PubPkgNeedsNameError } from '../errors'
import { allSettled } from '../util/async'
import { execBuffered } from '../util/exec'
import { log } from '../util/log'
import { runPrettyParallel } from '../util/pretty-task'
import MonoRepo from '../MonoRepo'
import InnerPkg from './InnerPkg'
import { computeBaseVersion } from './version-utils'


export async function publishPkgsWithPrompt(monoRepo: MonoRepo, subjectPkgs: InnerPkg[], npmArgs: string[]) {
  let res = await preparePublish(monoRepo, subjectPkgs, npmArgs)

  if (res) {
    let okay = await confirmPublish(res.pkgs, res.version)
    if (okay) {
      return res.execute()
    }
  }
}


/*
TODO: ordering of pkgs by who-depends-on-who
TODO: more robust settings about knowing which packages to publish
keep package.json publishConfig in mind:
  https://docs.npmjs.com/files/package.json#publishconfig
*/
export async function preparePublish(monoRepo: MonoRepo, subjectPkgs: InnerPkg[], npmRunTimeArgs: string[]) {
  let currentVersion = computeBaseVersion(monoRepo.rootPkg, subjectPkgs)

  let isPublics = await allSettled(
    subjectPkgs.map(async (pkg) => {
      let distData = await pkg.queryPublishJsonData()

      if (!distData.name) {
        throw new PubPkgNeedsNameError(pkg.relDir)
      }

      return !distData.private
    })
  )

  let queuedPkgs = subjectPkgs.filter((pkg, i) => {
    return pkg.jsonData.version === currentVersion && isPublics[i]
  })

  async function execute() {
    let { rootPkg, npmClient } = monoRepo

    if (rootPkg) {
      await rootPkg.runScript(npmClient, 'prepublish')
      await rootPkg.runScript(npmClient, 'prepare')
      await rootPkg.runScript(npmClient, 'prepublishOnly')
    }

    let tasks = queuedPkgs.map((pkg) => ({
      label: pkg.readableId(),
      func: () => runPkgPublish(monoRepo, pkg, npmRunTimeArgs)
    }))

    await runPrettyParallel(tasks)

    if (rootPkg) {
      await rootPkg.runScript(npmClient, 'publish')
      await rootPkg.runScript(npmClient, 'postpublish')
    }
  }

  return { version: currentVersion, pkgs: queuedPkgs, execute }
}


function runPkgPublish(monoRepo: MonoRepo, pkg: InnerPkg, npmRunTimeArgs: string[]) {
  let npmArgs = monoRepo.getCmdNpmArgs('publish').concat(pkg.npmClientArgs, npmRunTimeArgs)
  let cmd = monoRepo.npmClient.buildPublishCmd(npmArgs)

  log('PUBLISH CMD', cmd.join(' '), 'in', pkg.distDir || pkg.dir)

  return execBuffered(cmd, pkg.distDir || pkg.dir)
}


async function confirmPublish(pkgs: InnerPkg[], version: string) {

  console.log()
  console.log('Will publish the following packages:')
  console.log()

  for (let pkg of pkgs) {
    console.log('  ' + version + ' ' + pkg.readableId())
  }

  console.log()

  let answer = await prompts({
    name: 'ok',
    type: 'confirm',
    message: 'Is this okay?',
    initial: false
  })

  return answer.ok
}
