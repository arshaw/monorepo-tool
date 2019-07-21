
export function indentLines(s: string, indentStr: string) {
  return indentStr + s.replace(/[\n\r]+/g, '\n' + indentStr)
}
