-- CreateTable
CREATE TABLE "AxiomConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "leadId" TEXT,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AxiomConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AxiomMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "toolCalls" JSONB,
    "toolResults" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AxiomMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AxiomConversation_userId_idx" ON "AxiomConversation"("userId");

-- CreateIndex
CREATE INDEX "AxiomConversation_leadId_idx" ON "AxiomConversation"("leadId");

-- CreateIndex
CREATE INDEX "AxiomMessage_conversationId_idx" ON "AxiomMessage"("conversationId");

-- AddForeignKey
ALTER TABLE "AxiomMessage" ADD CONSTRAINT "AxiomMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AxiomConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
