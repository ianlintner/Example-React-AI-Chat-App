import { createFileRoute } from '@tanstack/react-router';
import { TokenShowcase } from '@/components/token-showcase';

export const Route = createFileRoute('/tokens')({ component: TokenShowcase });
