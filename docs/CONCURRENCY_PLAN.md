# Concurrency Control Plan

## Overview

Strategi hybrid untuk menangani concurrent updates pada aplikasi Virtual Lab IRK.

## Strategi per Area

| Area | Route | Strategi | Behavior saat Konflik |
|------|-------|----------|----------------------|
| Admin | `admin.ts` (Users) | OCC Standar | 409 Error → refresh manual |
| Admin | `assistants.ts` (Profile) | OCC Standar | 409 Error → refresh manual |
| Assistant | `tasks.ts` | OCC + Queue | Auto-merge → semua sukses |
| Assistant | `events.ts` | OCC + Queue | Auto-merge → semua sukses |

## 1. OCC Standar (Admin Area)

Digunakan untuk fitur dengan traffic rendah (Admin Panel, Assistant Profile).

### Alur:
1. Frontend mengirim `version` dari data yang sedang diedit
2. Backend cek apakah `version` cocok dengan database
3. Jika cocok → update sukses, version di-increment
4. Jika tidak cocok → return 409 Conflict, user harus refresh

### Kode Pattern:
```typescript
const result = await prisma.$transaction(async (tx) => {
  const existing = await tx.user.findFirst({
    where: { id, version: currentVersion }
  });
  
  if (!existing) {
    const userExists = await tx.user.findUnique({ where: { id } });
    if (!userExists) throw new Error('NOT_FOUND');
    throw new Error('VERSION_CONFLICT');
  }
  
  return tx.user.update({
    where: { id },
    data: { ...updateData, version: { increment: 1 } }
  });
});
```

## 2. OCC + Request Queue (Assistant Area)

Digunakan untuk fitur dengan traffic tinggi (Tasks, Events).

### Konsep:
- Menggunakan `KeyedMutex` untuk serialize request per ID
- Request yang datang bersamaan akan diproses satu per satu
- Auto-merge: request dengan version lama tetap dieksekusi di atas data terbaru

### Alur:
```
Request A & B (Edit Task #123) datang bersamaan
              ↓
      ┌─────────────────┐
      │   taskMutex     │
      │   Key: "123"    │
      └─────────────────┘
              ↓
  ┌───────────┬───────────┐
  │ Request A │ Request B │
  │ (Proses)  │ (Antri)   │
  └───────────┴───────────┘
              ↓
  A selesai (Ver 0→1), B mulai
              ↓
  B cek: DB Ver 1, User Ver 0
  → Auto-merge triggered
  → Update tetap jalan (Ver 1→2)
              ↓
  ✅ Kedua user dapat sukses
```

### KeyedMutex (`src/lib/queue.ts`):
```typescript
export class KeyedMutex {
  private locks: Map<string, Promise<void>> = new Map();

  async run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const currentLock = this.locks.get(key) || Promise.resolve();
    
    let resolveNext: () => void;
    const nextLock = new Promise<void>((resolve) => {
      resolveNext = resolve;
    });
    
    this.locks.set(key, nextLock);

    try {
      await currentLock;
      return await fn();
    } finally {
      resolveNext!();
      if (this.locks.get(key) === nextLock) {
        this.locks.delete(key);
      }
    }
  }
}

export const taskMutex = new KeyedMutex();
export const eventMutex = new KeyedMutex();
```

### Kode Pattern:
```typescript
const task = await taskMutex.run(id, async () => {
  const currentTask = await prisma.task.findUnique({ where: { id } });
  
  if (!currentTask) throw new Error('TASK_NOT_FOUND');

  if (currentTask.version > userVersion) {
    console.log(`[TaskQueue] Auto-merge for Task ${id}`);
  }

  return prisma.task.update({
    where: { id },
    data: { ...updateData, version: { increment: 1 } }
  });
});
```

## Skenario Contoh

### Skenario: Dua Asisten Edit Task Bersamaan

**State Awal:**
- Task "Laporan" (Version: 0, Status: To Do, Priority: Low)

**Asisten A:** Ubah status → "In Progress" (mengirim version: 0)  
**Asisten B:** Ubah priority → "High" (mengirim version: 0)

**Eksekusi:**
1. A & B masuk hampir bersamaan
2. `taskMutex` serialize: A diproses, B antri
3. **A selesai:** Status = In Progress, Version = 1
4. **B diproses:** 
   - DB version (1) > User version (0)
   - Auto-merge triggered
   - Priority = High, Version = 2
5. **Hasil:** Status = In Progress, Priority = High

**Outcome:** Kedua asisten sukses tanpa error.

## Database Schema

```prisma
model User {
  version Int @default(0)
  // ... fields lainnya
}

model Assistant {
  version Int @default(0)
  // ... fields lainnya
}

model Task {
  version Int @default(0)
  // ... fields lainnya
}

model Event {
  version Int @default(0)
  // ... fields lainnya
}
```

## Frontend Requirement

Semua update request harus menyertakan `version` dari data yang sedang diedit:

```typescript
// Contoh update task
updateTaskMutation.mutate({
  id: task.id,
  task: {
    ...taskData,
    version: task.version  // Wajib
  }
});
```

## Error Codes

| Code | Meaning | Response |
|------|---------|----------|
| 400 | `VERSION_REQUIRED` | Version tidak dikirim |
| 404 | Not Found | Data tidak ditemukan |
| 409 | `CONFLICT` | Version mismatch (OCC standar only) |
