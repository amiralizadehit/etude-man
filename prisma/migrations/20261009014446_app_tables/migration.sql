-- CreateEnum
CREATE TYPE "ExerciseSource" AS ENUM ('upload', 'seed', 'drill');

-- CreateTable
CREATE TABLE "exercise" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "musicXml" TEXT NOT NULL,
    "source" "ExerciseSource" NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "sample" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "note_event" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "noteIndex" INTEGER NOT NULL,
    "expectedMidi" INTEGER NOT NULL,
    "playedMidi" INTEGER NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "timestampMs" INTEGER NOT NULL,

    CONSTRAINT "note_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "exercise_userId_idx" ON "exercise"("userId");

-- CreateIndex
CREATE INDEX "attempt_userId_idx" ON "attempt"("userId");

-- CreateIndex
CREATE INDEX "attempt_exerciseId_idx" ON "attempt"("exerciseId");

-- CreateIndex
CREATE INDEX "note_event_attemptId_idx" ON "note_event"("attemptId");

-- AddForeignKey
ALTER TABLE "exercise" ADD CONSTRAINT "exercise_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise" ADD CONSTRAINT "exercise_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "exercise"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt" ADD CONSTRAINT "attempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt" ADD CONSTRAINT "attempt_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_event" ADD CONSTRAINT "note_event_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
