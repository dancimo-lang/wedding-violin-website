import TuneView from './tune-view';
import { tipReturnState } from '@/lib/payments/resource-tip';

export default async function TunePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tip?: string | string[] }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return <TuneView id={id} tip={tipReturnState(query.tip)} />;
}
