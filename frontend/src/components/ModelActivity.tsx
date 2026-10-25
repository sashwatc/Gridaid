import type {Evaluation} from '../api';
import type {Config,Study} from '../types';
import {pct} from '../presentation';

export function ModelActivity({study,config,phase='',evaluation}:{study:Study|null;config:Config|null;phase?:string;evaluation?:Evaluation|null}){
 const requested=!!config&&config.demand_model!=='population';
 const synthetic=study?.dataset.id==='fixture';
 const weighted=!!config&&(config.demand_model==='ml_risk'||config.demand_model==='blended'&&config.blend<1);
 const active=requested&&weighted&&!!study?.dataset.ml_validated;
 const matching=evaluation?.model_version===study?.dataset.model_version;
 const estimator=matching&&evaluation?.selected_by_validation_mae==='random_forest'?'Random forest':matching&&evaluation?.selected_by_validation_mae==='poisson'?'Poisson regression':'Evaluated incident forecast';
 const title=!study||!config?'Loading calculation inputs':active?`${estimator} ${config.demand_model==='blended'&&config.blend>0?'+ population':'forecast'}`:requested&&!study.dataset.ml_validated?'ML unavailable for this study':synthetic?'Synthetic population model':'Census population model';
 return <section className={`model-activity ${phase?'model-running':''}`} aria-label="Calculation model" data-testid="calculation-model" data-ml-active={active} aria-live="polite">
  <div className="model-activity-heading"><span className="model-activity-icon" aria-hidden="true">{active?'✦':'◉'}</span><div><span className="model-kicker">{phase?'CALCULATING WITH':'CALCULATION INPUTS'}</span><strong>{title}</strong></div><span className={`model-badge ${active?'ml-active':''}`}>{active?'ML inputs':study?'No ML':'Loading'}</span></div>
  {phase&&<p className="model-phase" data-testid="calculation-phase"><span className="model-live-dot"/>{phase}</p>}
  {study&&config&&<p>{active?config.demand_model==='blended'?`${pct(config.blend)} population + ${pct(1-config.blend)} predicted incident weight.`:'Uses normalized predicted incident counts as demand weights.':requested&&!study.dataset.ml_validated?'Choose population or switch to the evaluated Iowa study.':requested?'100% population. The ML forecast has zero weight and does not affect this calculation.':synthetic?'Uses the teaching fixture’s invented roads and population. No ML forecast.':'Uses 2020 Census population, directed road travel and location optimization.'}</p>}
  {active?<><p className="model-forecast-note">January 2024 forecast · precomputed predictions applied to this calculation. No live model training.</p><details><summary>ML model and limits</summary><p>Version: {study?.dataset.model_version}. Evaluated for the original Iowa study only. This is a historical transportation forecast, not current emergency risk.</p></details></>:study?.dataset.id==='quad_cities'?<details><summary>Why isn’t ML active here?</summary><p>No evaluated incident model covers this Iowa/Illinois region. Your plan uses real population and road data.</p><a href="/?view=advanced&dataset=iowa&demand=blended">Explore the evaluated Iowa ML demo ↗</a></details>:null}
 </section>;
}
