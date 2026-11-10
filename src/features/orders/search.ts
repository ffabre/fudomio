// Case- and accent-insensitive key: "Jamón" and "jamon" both become "jamon".
export function searchKey(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("en")
    .trim();
}

export function matchesSearch(name: string, query: string): boolean {
  const needle = searchKey(query);
  if (needle === "") return true;
  return searchKey(name).includes(needle);
}
