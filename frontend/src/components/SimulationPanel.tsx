import type {Run,Simulation,Study} from '../types';
import {colors,kinds,noDemand,pct,scenarioName,titles,travel} from '../presentation';

const bins=['0–1','1–2','2–5','5–10','10–20','20–60','60+'];
export function SimulationPanel({simulation,runs,study,active}:{simulation:Simulation;runs:Run[];study:Study|null;active:string}){
 const ordered=kinds.flatMap(kind=>runs.filter(r=>r.kind===kind));
 return <section className="panel simulation" aria-label="Paired simulation results"><span className="eyebrow">PAIRED MONTE CARLO VALIDATION</span><h2>{simulation.trials_requested.toLocaleString()} sampled incidents per scenario</h2><p>Seed {simulation.seed}. Every configuration uses the same incident sample within a scenario. Sampled coverage below is separate from weighted coverage above.</p><div className="table-scroll" tabIndex={0} role="region" aria-label="Sampled travel statistics; scroll horizontally for all columns"><table><caption>Sampled results · {scenarioName(study,active)}</caption><thead><tr><th scope="col">Configuration</th><th scope="col">Sampled coverage</th><th scope="col">Mean</th><th scope="col">Median</th><th scope="col">p90</th><th scope="col">p95</th><th scope="col">Unreachable</th><th scope="col">Reachable-only mean</th></tr></thead><tbody>{ordered.map(r=>{
  const m=simulation.configurations[r.run_id]?.scenarios[active];
  return m?<tr key={r.run_id}><th scope="row">{titles[r.kind]}</th><td data-testid={`${r.kind}-sampled`}>{noDemand(m)?'No demand':pct(m.coverage)}</td><td>{travel(m.mean_s,m)}</td><td>{travel(m.median_s,m)}</td><td>{travel(m.p90_s,m)}</td><td>{travel(m.p95_s,m)}</td><td>{noDemand(m)?'No demand':pct(m.unreachable_share)}</td><td>{travel(m.reachable_mean_s,m,true)}</td></tr>:null;
 })}</tbody></table></div><p className="hint">Unbounded means unreachable incidents make that statistic infinite. No demand means zero incidents were sampled. The reachable-only mean excludes unreachable incidents.</p>
 <h3>Travel-time distribution · reachable incidents</h3><p className="hint">Bins in minutes. Bar lengths show each bin as a share of all sampled incidents on a 0–100% scale. Unreachable incidents are reported above, outside these bins.</p><div className="histogram">{ordered.map(r=>{
  const m=simulation.configurations[r.run_id]?.scenarios[active];
  return m?<section key={r.run_id}><h4 style={{color:colors[r.kind]}}>{titles[r.kind]}</h4>{m.histogram.counts.map((count,i)=><div className="hist-row" key={i}><span>{bins[i]} min</span><div className="bar-track" aria-hidden="true"><div style={{width:pct(count/Math.max(1,m.incidents)),background:colors[r.kind]}}/></div><strong>{count.toLocaleString()}</strong></div>)}</section>:null;
 })}</div><h3>Sampled scenario summaries</h3>{ordered.map(r=>{
  const s=simulation.configurations[r.run_id]?.summary;
  return s?<p key={r.run_id} data-testid={`${r.kind}-sample-summary`}>{titles[r.kind]}: average {pct(s.average_coverage)} · minimum {pct(s.minimum_coverage)} · worst {scenarioName(study,s.worst_scenario)}</p>:null;
 })}<details><summary>Simulation reproducibility</summary><pre>{JSON.stringify({simulation_id:simulation.simulation_id,sample_hashes:simulation.sample_hashes},null,2)}</pre></details></section>;
}
