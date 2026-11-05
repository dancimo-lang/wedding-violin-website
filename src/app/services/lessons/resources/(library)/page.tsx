import LibraryView from './library-view';
import { tipReturnState } from '@/lib/payments/resource-tip';

export default async function ResourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ tip?: string | string[] }>;
}) {
  const query = await searchParams;
  return <LibraryView tip={tipReturnState(query.tip)} />;
}
