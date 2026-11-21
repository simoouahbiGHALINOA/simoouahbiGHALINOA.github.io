CREATE TABLE "protected_users" (
    "id" TEXT NOT NULL,
    "githubId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT,
    "email" TEXT,
    "avatarUrl" TEXT,
    "profileUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "protected_users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "protected_user_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "protected_user_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "protected_users_githubId_key" ON "protected_users"("githubId");
CREATE UNIQUE INDEX "protected_user_sessions_tokenHash_key" ON "protected_user_sessions"("tokenHash");
CREATE INDEX "protected_user_sessions_userId_idx" ON "protected_user_sessions"("userId");
CREATE INDEX "protected_user_sessions_expiresAt_idx" ON "protected_user_sessions"("expiresAt");

ALTER TABLE "protected_user_sessions"
ADD CONSTRAINT "protected_user_sessions_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "protected_users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
