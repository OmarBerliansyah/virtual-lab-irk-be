# Gunakan image official Bun (sesuai package.json kamu)
FROM oven/bun:1 as base
WORKDIR /usr/src/app

# Install dependencies
# (COPY semua file package dulu biar cache layer docker optimal)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy sisa source code
COPY . .

ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"

# Generate Prisma Client (Wajib ada biar database konek)
RUN bunx prisma generate

# Expose port (sesuai settingan Hono kamu)
EXPOSE 8000

# Jalankan aplikasi langsung dengan Bun
CMD ["bun", "run", "src/index.ts"]