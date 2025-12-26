import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { fromNodeHeaders } from "better-auth/node";
import type { RequestHandler } from "express";
import { db } from "./db";
import { storage } from "./storage";
import * as schema from "@shared/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.authUser,
      session: schema.authSession,
      account: schema.authAccount,
      verification: schema.authVerification,
    },
  }),
  baseURL: process.env.REPL_SLUG 
    ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
    : "http://localhost:5000",
  secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },
  user: {
    additionalFields: {
      firstName: {
        type: "string",
        required: false,
      },
      lastName: {
        type: "string",
        required: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await storage.upsertUser({
            id: user.id,
            email: user.email,
            firstName: (user as any).firstName || user.name?.split(' ')[0] || null,
            lastName: (user as any).lastName || user.name?.split(' ').slice(1).join(' ') || null,
            profileImageUrl: user.image || null,
          });
        },
      },
    },
  },
  trustedOrigins: [
    "https://simulchess.com",
    "https://www.simulchess.com",
    process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` : "",
  ].filter(Boolean),
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;

// Middleware to check if user is authenticated
export const isAuthenticated: RequestHandler = async (req: any, res, next) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session?.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Attach user info to request for compatibility with existing routes
    req.user = {
      claims: {
        sub: session.user.id,
        email: session.user.email,
        first_name: session.user.name?.split(' ')[0] || '',
        last_name: session.user.name?.split(' ').slice(1).join(' ') || '',
      }
    };
    req.session = session;

    return next();
  } catch (error) {
    console.error("Auth error:", error);
    return res.status(401).json({ message: "Unauthorized" });
  }
};
