import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { fromNodeHeaders } from "better-auth/node";
import type { RequestHandler } from "express";
import { db } from "./db";
import { storage } from "./storage";
import * as schema from "@shared/schema";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = "noreply@simulchess.com";

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
  // Use BETTER_AUTH_URL for production (simulchess.com), fall back to Replit dev URL or localhost
  baseURL: process.env.BETTER_AUTH_URL 
    || (process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` : "http://localhost:5000"),
  secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    sendResetPassword: async ({ user, url }) => {
      try {
        await resend.emails.send({
          from: FROM_EMAIL,
          to: user.email,
          subject: "Reset your SimulChess password",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1a1a1a;">Reset Your Password</h2>
              <p>Hi ${user.name || "there"},</p>
              <p>You requested to reset your password for your SimulChess account.</p>
              <p>Click the button below to set a new password:</p>
              <a href="${url}" style="display: inline-block; background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">Reset Password</a>
              <p>Or copy and paste this link into your browser:</p>
              <p style="color: #666; word-break: break-all;">${url}</p>
              <p>This link will expire in 1 hour.</p>
              <p>If you didn't request this, you can safely ignore this email.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
              <p style="color: #999; font-size: 12px;">SimulChess - Professional Chess Training</p>
            </div>
          `,
        });
        console.log(`Password reset email sent to ${user.email}`);
      } catch (error) {
        console.error("Failed to send password reset email:", error);
        throw new Error("Failed to send password reset email");
      }
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: false, // Disabled to ensure fresh user data is fetched on each request
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
    "http://localhost:5000",
    // Replit dev URLs with wildcards
    "https://*.replit.dev",
    "https://*.repl.co",
  ],
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

    // Resolve the actual users table data (may differ from Better Auth session for migrated users)
    let userId = session.user.id;
    let firstName = session.user.name?.split(' ')[0] || '';
    let lastName = session.user.name?.split(' ').slice(1).join(' ') || '';
    const email = session.user.email;
    
    // Look up user in database by email to get the correct ID and profile data
    if (email) {
      const dbUser = await storage.getUserByEmail(email);
      if (dbUser) {
        userId = dbUser.id;
        firstName = dbUser.firstName || firstName;
        lastName = dbUser.lastName || lastName;
      }
    }

    // Attach user info to request for compatibility with existing routes
    req.user = {
      claims: {
        sub: userId,
        email: email,
        first_name: firstName,
        last_name: lastName,
      }
    };
    req.session = session;

    return next();
  } catch (error) {
    console.error("Auth error:", error);
    return res.status(401).json({ message: "Unauthorized" });
  }
};
