-- CreateTable
CREATE TABLE "omr_upload" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "flatJobId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "exerciseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "omr_upload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "omr_upload_flatJobId_key" ON "omr_upload"("flatJobId");

-- CreateIndex
CREATE UNIQUE INDEX "omr_upload_exerciseId_key" ON "omr_upload"("exerciseId");

-- CreateIndex
CREATE INDEX "omr_upload_userId_idx" ON "omr_upload"("userId");

-- AddForeignKey
ALTER TABLE "omr_upload" ADD CONSTRAINT "omr_upload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "omr_upload" ADD CONSTRAINT "omr_upload_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercise"("id") ON DELETE SET NULL ON UPDATE CASCADE;
