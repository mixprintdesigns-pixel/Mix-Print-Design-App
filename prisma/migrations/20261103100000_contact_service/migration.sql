-- Contact form: which service the visitor is asking about. Add-only.
ALTER TABLE "ContactMessage" ADD COLUMN "service" TEXT;
