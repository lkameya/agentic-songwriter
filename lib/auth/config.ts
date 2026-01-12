import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from '@/lib/db/prisma';

/**
 * NextAuth configuration
 * Supports optional Google OAuth authentication
 */
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
  ],
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  callbacks: {
    async session({ session, user }) {
      // Add user ID to session
      // Note: user is only available with database strategy
      if (session.user && user) {
        session.user.id = user.id;
      }
      return session;
    },
    async signIn({ user, account, profile }) {
      // Allow all sign-ins (no restrictions)
      return true;
    },
  },
  session: {
    strategy: 'database', // Use database sessions (required for Prisma adapter)
  },
  // Allow unauthenticated access (guest mode)
  // Authentication is optional
  debug: process.env.NODE_ENV === 'development', // Enable debug in development
};
