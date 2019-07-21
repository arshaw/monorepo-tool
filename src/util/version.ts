import * as semver from 'semver'


/*
breaks up a package+version specifier
handles scoped package names
*/
export function parsePkgVersionRangeArg(s: string) {
  let lastAt = s.lastIndexOf('@')
  let pkgName = s
  let pkgVersionRange = ''

  if (lastAt > 0) { // found, and not the first character
    pkgName = s.substr(0, lastAt)
    pkgVersionRange = s.substr(lastAt + 1)
  }

  return [ pkgName, pkgVersionRange ]
}


/*
Given a version range string with ~/^/exact, returns a new version range string
with the new semver string injected. Returns false on failure.
*/
export function updateVerRange(existingRange: string, newSemVer: string) {

  if (existingRange.match(/^\^[\d\w\-\+\.]+$/)) {
    return '^' + newSemVer

  } else if (existingRange.match(/^\~[\d\w\-\+\.]+$/)) {
    return '~' + newSemVer

  } else if (semver.valid(newSemVer)) { // exact
    return newSemVer
  }

  return false
}
