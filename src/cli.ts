import { runSimulation } from './simulator/runner';
import { writeResults } from './storage/results-writer';
import { createDefaultConfig } from './config';
import { computeAggregateMetrics, formatComparison } from './statistics/metrics';

const config = createDefaultConfig();

const result = runSimulation(config);
const outputDir = writeResults(result, config);

console.log('Hanabi Simulator — simulation complete.');
console.log(`Results written to ${outputDir}`);

for (const r of result.results) {
  const m = computeAggregateMetrics(r);
  console.log(
    `  ${r.name}: avg ${m.avgScore.toFixed(2)} ± ${m.stdError.toFixed(2)}, ` +
      `perfect ${(m.perfectRate * 100).toFixed(1)}%`
  );
}

if (result.results.length === 2) {
  console.log('\nComparison:');
  console.log(
    formatComparison(
      result.results[0].name,
      result.results[1].name,
      result.results[0],
      result.results[1]
    )
  );
}
