import { useSession } from './useSession';

export function LoginBanner() {
  const { data, isLoading } = useSession();
  if (isLoading || !data) return null;
  if (data.authenticated) return null;

  const href = data.loginUrl ?? '/oauth2/start';
  return (
    <div className='login-banner' role='status'>
      <span className='login-banner__text'>
        You&rsquo;re chatting as a guest on the free-tier model.{' '}
        <a className='login-banner__cta' href={href}>
          Sign in
        </a>{' '}
        for higher limits and better models.
      </span>
    </div>
  );
}

export function ModelTierBadge() {
  const { data } = useSession();
  if (!data) return null;
  const label = data.authenticated ? 'Pro' : 'Free';
  const title = data.authenticated
    ? 'Signed in — premium model tier'
    : 'Guest — free-tier model';
  return (
    <span
      className={`tier-badge tier-badge--${data.tier}`}
      title={title}
      aria-label={title}
    >
      {label}
    </span>
  );
}
