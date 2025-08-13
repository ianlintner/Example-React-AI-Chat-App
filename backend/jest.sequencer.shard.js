/**
 * Jest custom sequencer to shard tests across parallel CI jobs.
 * Usage (CI):
 *  - Set JEST_TOTAL_SHARDS to the total number of parallel jobs
 *  - Set JEST_SHARD_INDEX to the 0-based index for this job
 * Without these env vars, all tests run as normal.
 */
const TestSequencer = require('@jest/test-sequencer').default;
const crypto = require('crypto');

class ShardSequencer extends TestSequencer {
  sort(tests) {
    const total = parseInt(process.env.JEST_TOTAL_SHARDS || '1', 10);
    const index = parseInt(process.env.JEST_SHARD_INDEX || '0', 10);

    let selected = tests;

    if (
      Number.isFinite(total) &&
      total > 1 &&
      Number.isFinite(index) &&
      index >= 0 &&
      index < total
    ) {
      selected = tests.filter(test => {
        const hash = crypto
          .createHash('md5')
          .update(test.path)
          .digest('hex');
        const n = parseInt(hash.slice(0, 8), 16);
        return n % total === index;
      });
    }

    // Preserve Jest's default ordering on the selected subset
    return super.sort(selected);
  }
}

module.exports = ShardSequencer;
