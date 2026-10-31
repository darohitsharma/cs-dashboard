// Module registry. To add a plug-in, create src/modules/<name>/index.js that exports
// { id, title, group, render(container) } and add it to this list.
import csQueries from './cs-queries/index.js';
import placeholder from './placeholder.js';

export const modules = [
  csQueries,
  placeholder('competitor-search', 'Competitor Search Tracking', ''),
  placeholder('others', 'Others', ''),
];
