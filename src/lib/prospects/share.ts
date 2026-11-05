/** Deal rows out in turn, best first, until each person has `each` or the pool runs out. */
export function dealOut<T>(pool: T[], people: string[], each: number): Map<string, T[]> {
  const out = new Map(people.map((p) => [p, [] as T[]]));
  let i = 0;
  for (const row of pool) {
    const open = people.filter((p) => out.get(p)!.length < each);
    if (!open.length) break;
    out.get(open[i % open.length])!.push(row);
    i++;
  }
  return out;
}
