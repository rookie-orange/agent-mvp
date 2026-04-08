export function countOccurrences(content: string, target: string) {
  if (!target) {
    return 0
  }

  let count = 0
  let startIndex = 0

  while (true) {
    const index = content.indexOf(target, startIndex)

    if (index === -1) {
      return count
    }

    count += 1
    startIndex = index + target.length
  }
}

export function replaceFirstOccurrence(content: string, find: string, replace: string) {
  const index = content.indexOf(find)

  if (index === -1) {
    return content
  }

  return `${content.slice(0, index)}${replace}${content.slice(index + find.length)}`
}
