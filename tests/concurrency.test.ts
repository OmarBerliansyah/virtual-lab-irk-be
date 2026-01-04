/**
 * Concurrency Control Tests (OCC + Queue)
 * 
 * Test Scenarios:
 * 1. Smart Merge (Beda Field) - Dua user edit field berbeda
 * 2. Overwrite (Sama Field) - Dua user edit field yang sama
 * 3. Stale Request (High Latency) - Request dengan versi sangat lama
 * 4. Ghost (Delete vs Update) - Race condition delete dan update
 * 5. Queue Overflow (Spamming) - Multiple rapid requests
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { KeyedMutex, taskMutex, eventMutex } from '../src/lib/queue';

// ============================================================================
// Unit Tests: KeyedMutex Class
// ============================================================================

describe('KeyedMutex - Unit Tests', () => {
  let mutex: KeyedMutex;

  beforeEach(() => {
    mutex = new KeyedMutex();
  });

  it('should execute single task without blocking', async () => {
    const result = await mutex.run('task-1', async () => {
      return 'completed';
    });
    
    expect(result).toBe('completed');
    expect(mutex.isLocked('task-1')).toBe(false);
  });

  it('should serialize concurrent tasks with same key', async () => {
    const executionOrder: number[] = [];
    
    const task1 = mutex.run('same-key', async () => {
      await delay(50);
      executionOrder.push(1);
      return 1;
    });

    const task2 = mutex.run('same-key', async () => {
      executionOrder.push(2);
      return 2;
    });

    const task3 = mutex.run('same-key', async () => {
      executionOrder.push(3);
      return 3;
    });

    await Promise.all([task1, task2, task3]);

    // Tasks should execute in order due to queue
    expect(executionOrder).toEqual([1, 2, 3]);
  });

  it('should allow parallel execution for different keys', async () => {
    const executionOrder: string[] = [];
    const startTime = Date.now();

    const taskA = mutex.run('key-A', async () => {
      await delay(50);
      executionOrder.push('A');
      return 'A';
    });

    const taskB = mutex.run('key-B', async () => {
      await delay(50);
      executionOrder.push('B');
      return 'B';
    });

    await Promise.all([taskA, taskB]);
    const elapsed = Date.now() - startTime;

    // Both should run in parallel, so total time ~50ms not ~100ms
    expect(elapsed).toBeLessThan(100);
    expect(executionOrder).toContain('A');
    expect(executionOrder).toContain('B');
  });

  it('should handle errors without breaking the queue', async () => {
    const results: string[] = [];

    const task1 = mutex.run('error-key', async () => {
      throw new Error('Task 1 failed');
    }).catch(() => results.push('error-1'));

    const task2 = mutex.run('error-key', async () => {
      results.push('success-2');
      return 'ok';
    });

    await Promise.all([task1, task2]);

    // Task 2 should still execute even after Task 1 fails
    expect(results).toContain('error-1');
    expect(results).toContain('success-2');
  });

  it('should report correct lock status', async () => {
    expect(mutex.isLocked('test-key')).toBe(false);
    expect(mutex.getActiveLocksCount()).toBe(0);

    const taskPromise = mutex.run('test-key', async () => {
      await delay(100);
      return 'done';
    });

    // Check while task is running
    await delay(10);
    expect(mutex.isLocked('test-key')).toBe(true);
    expect(mutex.getActiveLocksCount()).toBe(1);

    await taskPromise;

    expect(mutex.isLocked('test-key')).toBe(false);
    expect(mutex.getActiveLocksCount()).toBe(0);
  });
});

// ============================================================================
// Scenario Tests: Simulated Concurrency Scenarios
// ============================================================================

describe('Concurrency Scenarios - Simulations', () => {
  
  // Simulated in-memory "database" for testing
  interface MockTask {
    id: string;
    title: string;
    status: string;
    priority: string;
    version: number;
  }

  let mockDb: Map<string, MockTask>;
  let mutex: KeyedMutex;

  // Simulated update function (mimics the real taskMutex.run pattern)
  async function updateTask(
    id: string, 
    userVersion: number, 
    updates: Partial<MockTask>
  ): Promise<MockTask | null> {
    return mutex.run(id, async () => {
      const current = mockDb.get(id);
      if (!current) {
        throw new Error('TASK_NOT_FOUND');
      }

      // Log version mismatch (auto-merge behavior)
      if (current.version > userVersion) {
        console.log(`[Test] Auto-merge: user v${userVersion} -> db v${current.version}`);
      }

      // Apply updates on top of current data (merge)
      const updated: MockTask = {
        ...current,
        ...updates,
        version: current.version + 1
      };

      mockDb.set(id, updated);
      return updated;
    });
  }

  async function deleteTask(id: string): Promise<boolean> {
    return mutex.run(id, async () => {
      if (!mockDb.has(id)) {
        throw new Error('TASK_NOT_FOUND');
      }
      mockDb.delete(id);
      return true;
    });
  }

  beforeEach(() => {
    mockDb = new Map();
    mutex = new KeyedMutex();
    
    // Setup initial task
    mockDb.set('task-1', {
      id: 'task-1',
      title: 'Laporan',
      status: 'To Do',
      priority: 'low',
      version: 1
    });
  });

  // -------------------------------------------------------------------------
  // Skenario 1: Konflik Jinak (Beda Field) — "The Smart Merge"
  // -------------------------------------------------------------------------
  describe('Scenario 1: Smart Merge (Different Fields)', () => {
    it('should merge changes when users edit different fields', async () => {
      // User A changes status
      const updateA = updateTask('task-1', 1, { status: 'In Progress' });
      
      // User B changes priority (also with version 1)
      const updateB = updateTask('task-1', 1, { priority: 'high' });

      await Promise.all([updateA, updateB]);

      const finalTask = mockDb.get('task-1')!;
      
      // Both changes should be preserved
      expect(finalTask.status).toBe('In Progress');
      expect(finalTask.priority).toBe('high');
      expect(finalTask.version).toBe(3); // 1 -> 2 -> 3
    });

    it('should preserve original title when only status and priority change', async () => {
      const updateA = updateTask('task-1', 1, { status: 'Done' });
      const updateB = updateTask('task-1', 1, { priority: 'medium' });

      await Promise.all([updateA, updateB]);

      const finalTask = mockDb.get('task-1')!;
      expect(finalTask.title).toBe('Laporan'); // Unchanged
    });
  });

  // -------------------------------------------------------------------------
  // Skenario 2: Konflik Keras (Sama Field) — "The Overwrite"
  // -------------------------------------------------------------------------
  describe('Scenario 2: Last Write Wins (Same Field)', () => {
    it('should let last processed request win when editing same field', async () => {
      const executionOrder: string[] = [];

      // User A wants status = 'In Progress'
      const updateA = mutex.run('task-1', async () => {
        await delay(50); // Simulate slower processing
        const current = mockDb.get('task-1')!;
        const updated = { ...current, status: 'In Progress', version: current.version + 1 };
        mockDb.set('task-1', updated);
        executionOrder.push('A');
        return updated;
      });

      // User B wants status = 'Done'
      const updateB = mutex.run('task-1', async () => {
        const current = mockDb.get('task-1')!;
        const updated = { ...current, status: 'Done', version: current.version + 1 };
        mockDb.set('task-1', updated);
        executionOrder.push('B');
        return updated;
      });

      await Promise.all([updateA, updateB]);

      const finalTask = mockDb.get('task-1')!;
      
      // Due to queue, A runs first (even though it's slower), then B
      expect(executionOrder).toEqual(['A', 'B']);
      expect(finalTask.status).toBe('Done'); // B wins (last write)
      expect(finalTask.version).toBe(3);
    });
  });

  // -------------------------------------------------------------------------
  // Skenario 3: Si Lambat (High Latency) — "The Stale Request"
  // -------------------------------------------------------------------------
  describe('Scenario 3: Stale Request (High Latency)', () => {
    it('should apply stale update on top of current data', async () => {
      // Simulate multiple updates happened (version went from 1 to 10)
      mockDb.set('task-1', {
        id: 'task-1',
        title: 'Laporan',
        status: 'Done',
        priority: 'high',
        version: 10
      });

      // Stale request comes with version 1, only changing title
      const result = await updateTask('task-1', 1, { title: 'Laporan Penting' });

      expect(result!.title).toBe('Laporan Penting');
      expect(result!.status).toBe('Done'); // Preserved from v10
      expect(result!.priority).toBe('high'); // Preserved from v10
      expect(result!.version).toBe(11);
    });

    it('should not lose intermediate updates when stale request arrives', async () => {
      // Version progression: 1 -> 2 -> 3 -> 4
      await updateTask('task-1', 1, { status: 'In Progress' }); // v2
      await updateTask('task-1', 2, { priority: 'medium' });    // v3
      await updateTask('task-1', 3, { title: 'Updated Title' }); // v4

      // Very stale request (version 1) updates only status
      const result = await updateTask('task-1', 1, { status: 'Done' });

      expect(result!.version).toBe(5);
      expect(result!.status).toBe('Done');
      expect(result!.priority).toBe('medium'); // Kept from v3
      expect(result!.title).toBe('Updated Title'); // Kept from v4
    });
  });

  // -------------------------------------------------------------------------
  // Skenario 4: Hantu (Delete vs Update) — "The Ghost"
  // -------------------------------------------------------------------------
  describe('Scenario 4: Delete vs Update Race', () => {
    it('should return error when updating deleted task (delete first)', async () => {
      let updateError: Error | null = null;

      // Delete runs first
      const deletePromise = deleteTask('task-1');
      
      // Small delay to ensure delete is queued first
      await delay(5);
      
      // Update runs after
      const updatePromise = updateTask('task-1', 1, { title: 'New Title' })
        .catch(err => {
          updateError = err;
          return null;
        });

      await Promise.all([deletePromise, updatePromise]);

      expect(mockDb.has('task-1')).toBe(false);
      expect(updateError).not.toBeNull();
      expect(updateError!.message).toBe('TASK_NOT_FOUND');
    });

    it('should delete successfully even after update (update first)', async () => {
      const results: string[] = [];

      // Update runs first
      const updatePromise = mutex.run('task-1', async () => {
        await delay(20); // Take some time
        const current = mockDb.get('task-1')!;
        mockDb.set('task-1', { ...current, title: 'Updated', version: 2 });
        results.push('updated');
        return true;
      });

      // Delete queued after
      const deletePromise = mutex.run('task-1', async () => {
        mockDb.delete('task-1');
        results.push('deleted');
        return true;
      });

      await Promise.all([updatePromise, deletePromise]);

      expect(results).toEqual(['updated', 'deleted']);
      expect(mockDb.has('task-1')).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Skenario 5: Queue Overflow (Spamming)
  // -------------------------------------------------------------------------
  describe('Scenario 5: Queue Overflow (Rapid Fire)', () => {
    it('should handle 100 rapid updates without corruption', async () => {
      const numUpdates = 100;
      const promises: Promise<MockTask | null>[] = [];

      // Fire 100 updates at once
      for (let i = 0; i < numUpdates; i++) {
        promises.push(
          updateTask('task-1', 1, { title: `Update ${i}` })
        );
      }

      await Promise.all(promises);

      const finalTask = mockDb.get('task-1')!;
      
      // Version should be 1 + 100 = 101
      expect(finalTask.version).toBe(numUpdates + 1);
      
      // Title should be from one of the updates (last one processed)
      expect(finalTask.title).toMatch(/^Update \d+$/);
    });

    it('should maintain data integrity under spam conditions', async () => {
      const numUpdates = 50;
      const promises: Promise<MockTask | null>[] = [];

      // Alternate between status and priority updates
      for (let i = 0; i < numUpdates; i++) {
        if (i % 2 === 0) {
          promises.push(updateTask('task-1', 1, { status: `Status-${i}` }));
        } else {
          promises.push(updateTask('task-1', 1, { priority: `Priority-${i}` }));
        }
      }

      await Promise.all(promises);

      const finalTask = mockDb.get('task-1')!;
      
      // Version should increment for each update
      expect(finalTask.version).toBe(numUpdates + 1);
      
      // Both fields should have valid values
      expect(finalTask.status).toBeDefined();
      expect(finalTask.priority).toBeDefined();
    });

    it('should process queue in FIFO order', async () => {
      const processingOrder: number[] = [];

      const promises = Array.from({ length: 10 }, (_, i) =>
        mutex.run('task-1', async () => {
          processingOrder.push(i);
          return i;
        })
      );

      await Promise.all(promises);

      // Should be processed in order: 0, 1, 2, ..., 9
      expect(processingOrder).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });
  });
});

// ============================================================================
// Integration Tests: Real Mutex Instances
// ============================================================================

describe('Real Mutex Instances', () => {
  it('taskMutex should be a KeyedMutex instance', () => {
    expect(taskMutex).toBeInstanceOf(KeyedMutex);
    expect(typeof taskMutex.run).toBe('function');
    expect(typeof taskMutex.isLocked).toBe('function');
  });

  it('eventMutex should be a KeyedMutex instance', () => {
    expect(eventMutex).toBeInstanceOf(KeyedMutex);
    expect(typeof eventMutex.run).toBe('function');
    expect(typeof eventMutex.isLocked).toBe('function');
  });

  it('taskMutex and eventMutex should be independent', async () => {
    const results: string[] = [];

    // Both can run in parallel because they're different mutex instances
    const taskRun = taskMutex.run('shared-id', async () => {
      await delay(50);
      results.push('task');
      return 'task';
    });

    const eventRun = eventMutex.run('shared-id', async () => {
      await delay(50);
      results.push('event');
      return 'event';
    });

    const startTime = Date.now();
    await Promise.all([taskRun, eventRun]);
    const elapsed = Date.now() - startTime;

    // Should run in parallel (~50ms), not serial (~100ms)
    expect(elapsed).toBeLessThan(100);
    expect(results).toHaveLength(2);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  let mutex: KeyedMutex;

  beforeEach(() => {
    mutex = new KeyedMutex();
  });

  it('should handle empty key', async () => {
    const result = await mutex.run('', async () => 'empty-key-result');
    expect(result).toBe('empty-key-result');
  });

  it('should handle special characters in key', async () => {
    const specialKey = 'task/123?query=test&foo=bar';
    const result = await mutex.run(specialKey, async () => 'special-key-result');
    expect(result).toBe('special-key-result');
  });

  it('should handle async function that returns undefined', async () => {
    const result = await mutex.run('test', async () => undefined);
    expect(result).toBeUndefined();
  });

  it('should handle async function that returns null', async () => {
    const result = await mutex.run('test', async () => null);
    expect(result).toBeNull();
  });

  it('should handle rejection with non-Error objects', async () => {
    try {
      await mutex.run('test', async () => {
        throw 'string error';
      });
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error).toBe('string error');
    }

    // Queue should still work after string throw
    const result = await mutex.run('test', async () => 'recovered');
    expect(result).toBe('recovered');
  });

  it('should clean up lock after error', async () => {
    try {
      await mutex.run('cleanup-test', async () => {
        throw new Error('Intentional error');
      });
    } catch {
      // Expected
    }

    // Lock should be cleaned up
    expect(mutex.isLocked('cleanup-test')).toBe(false);
  });

  it('should handle concurrent operations on many different keys', async () => {
    const numKeys = 100;
    const promises: Promise<string>[] = [];

    for (let i = 0; i < numKeys; i++) {
      promises.push(
        mutex.run(`key-${i}`, async () => {
          await delay(Math.random() * 10);
          return `result-${i}`;
        })
      );
    }

    const results = await Promise.all(promises);
    
    expect(results).toHaveLength(numKeys);
    expect(mutex.getActiveLocksCount()).toBe(0);
  });
});

// ============================================================================
// Utility Functions
// ============================================================================

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
