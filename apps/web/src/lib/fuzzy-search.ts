export function fuzzyMatch(text: string, query: string): boolean {
	const searchLower = query.toLowerCase();
	const textLower = text.toLowerCase();

	if (textLower.includes(searchLower)) return true;

	let searchIndex = 0;
	for (let i = 0; i < textLower.length && searchIndex < searchLower.length; i++) {
		if (textLower[i] === searchLower[searchIndex]) {
			searchIndex++;
		}
	}
	return searchIndex === searchLower.length;
}

export function fuzzyFilter<T>(
	items: Array<T>,
	query: string,
	getSearchText: (item: T) => string | Array<string>,
): Array<T> {
	if (!query.trim()) return items;

	return items.filter((item) => {
		const searchTexts = getSearchText(item);
		const texts = Array.isArray(searchTexts) ? searchTexts : [searchTexts];
		return texts.some((text) => fuzzyMatch(text, query));
	});
}
