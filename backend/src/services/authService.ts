import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { User } from '../../../shared/types';
import userStorage from '../storage/userStorage';
import { logger } from '../logger';

/**
 * Configure Passport with GitHub OAuth strategy
 */
export const configureGitHubStrategy = (): void => {
  const clientID = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const callbackURL =
    process.env.GITHUB_CALLBACK_URL ||
    'http://localhost:5001/api/auth/github/callback';

  if (!clientID || !clientSecret) {
    logger.warn('GitHub OAuth credentials not configured');
    return;
  }

  passport.use(
    new GitHubStrategy(
      {
        clientID,
        clientSecret,
        callbackURL,
        scope: ['user:email'],
      },
      async (
        accessToken: string,
        refreshToken: string,
        profile: any,
        done: (error: any, user?: any) => void,
      ) => {
        try {
          // Extract user information from GitHub profile
          const email = profile.emails?.[0]
            ? profile.emails[0].value
            : `${profile.username}@github.com`;

          const userData = {
            email,
            name: profile.displayName || profile.username,
            provider: 'github' as const,
            providerId: profile.id,
            avatar: profile.photos?.[0] ? profile.photos[0].value : undefined,
          };

          // Create or update user
          const user = await userStorage.createUser(userData);

          logger.info(
            { userId: user.id, provider: 'github' },
            'User authenticated via GitHub',
          );
          done(null, user);
        } catch (error) {
          logger.error({ error }, 'GitHub authentication error');
          done(error);
        }
      },
    ),
  );
};

/**
 * Configure Passport with Google OAuth strategy
 */
export const configureGoogleStrategy = (): void => {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const callbackURL =
    process.env.GOOGLE_CALLBACK_URL ||
    'http://localhost:5001/api/auth/google/callback';

  if (!clientID || !clientSecret) {
    logger.warn('Google OAuth credentials not configured');
    return;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID,
        clientSecret,
        callbackURL,
        scope: ['profile', 'email'],
      },
      async (
        accessToken: string,
        refreshToken: string,
        profile: any,
        done: (error: any, user?: any) => void,
      ) => {
        try {
          // Extract user information from Google profile
          const email = profile.emails?.[0] ? profile.emails[0].value : '';

          if (!email) {
            logger.error('No email provided by Google');
            return done(new Error('Email is required'));
          }

          const userData = {
            email,
            name: profile.displayName || email.split('@')[0],
            provider: 'google' as const,
            providerId: profile.id,
            avatar: profile.photos?.[0] ? profile.photos[0].value : undefined,
          };

          // Create or update user
          const user = await userStorage.createUser(userData);

          logger.info(
            { userId: user.id, provider: 'google' },
            'User authenticated via Google',
          );
          done(null, user);
        } catch (error) {
          logger.error({ error }, 'Google authentication error');
          done(error);
        }
      },
    ),
  );
};

/**
 * Serialize user for session
 */
passport.serializeUser((user: any, done: (err: any, id?: string) => void) => {
  done(null, user.id);
});

/**
 * Deserialize user from session
 */
passport.deserializeUser(
  async (id: string, done: (err: any, user?: User | null) => void) => {
    try {
      const user = await userStorage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  },
);

/**
 * Initialize Passport strategies
 */
export const initializePassport = (): void => {
  configureGitHubStrategy();
  configureGoogleStrategy();
  logger.info('Passport authentication strategies initialized');
};

export default passport;
