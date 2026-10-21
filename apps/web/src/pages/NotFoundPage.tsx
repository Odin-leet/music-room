import { IoCompassOutline } from 'react-icons/io5';
import { useNavigate } from 'react-router';
import { EmptyState, Page } from '@/ui';

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <Page>
      <EmptyState icon={IoCompassOutline} title="Nothing here" text="This page doesn't exist." action="Go home" onAction={() => navigate('/')} />
    </Page>
  );
}
