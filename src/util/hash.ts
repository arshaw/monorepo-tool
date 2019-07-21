

export function arrayToHash(a: string[]) {
  let hash: { [key: string]: true } = {}

  for (let item of a) {
    hash[item] = true
  }

  return hash
}


export function filterHash<T>(hash: { [key: string]: T }, keyObj: { [key: string]: any }) {
  let res: { [key: string]: T } = {}

  for (let key in hash) {
    if (keyObj[key]) {
      res[key] = hash[key]
    }
  }

  return res
}


export function mapHashToArray<InType, OutType>(hash: { [key: string]: InType }, func: (val: InType, key: string) => OutType): OutType[] {
  let res: OutType[] = []

  for (let key in hash) {
    res.push(func(hash[key], key))
  }

  return res
}
