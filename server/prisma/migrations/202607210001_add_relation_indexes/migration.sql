-- Add indexes for production list and relation lookups.
CREATE INDEX "Game_isActive_createdAt_idx" ON "Game"("isActive", "createdAt");
CREATE INDEX "Room_ownerId_idx" ON "Room"("ownerId");
CREATE INDEX "RoomPlayer_userId_idx" ON "RoomPlayer"("userId");
CREATE INDEX "Match_roomId_idx" ON "Match"("roomId");
CREATE INDEX "Match_gameId_idx" ON "Match"("gameId");
CREATE INDEX "MatchPlayer_userId_idx" ON "MatchPlayer"("userId");
