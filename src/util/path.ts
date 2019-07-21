
const IS_ROOT_REGEX = /^$|[\//]$/ // empty or ends with a slash


export function pathIsRoot(s: string) {
  return IS_ROOT_REGEX.test(s)
}
